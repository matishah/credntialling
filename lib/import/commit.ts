import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { encrypt } from "../crypto";
import type { ParseResult, ParsedEnrollment } from "./parse";

export type ImportSummary = {
  practicesCreated: number;
  practicesMatched: number;
  providersCreated: number;
  providersMatched: number;
  enrollmentsCreated: number;
  enrollmentsUpdated: number;
  payersCreated: string[];
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Only fills columns that are currently empty, so an import never clobbers edits made in the app. */
function fillEmpty<T extends Record<string, unknown>>(existing: T, incoming: Partial<T>): Partial<T> {
  const patch: Partial<T> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v != null && v !== "" && (existing[k] == null || existing[k] === "")) (patch as Record<string, unknown>)[k] = v;
  }
  return patch;
}

export async function commitImport(
  parsed: ParseResult,
  opts: { fileName: string; fileHash: string; userId: string },
): Promise<ImportSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const summary: ImportSummary = {
    practicesCreated: 0,
    practicesMatched: 0,
    providersCreated: 0,
    providersMatched: 0,
    enrollmentsCreated: 0,
    enrollmentsUpdated: 0,
    payersCreated: [],
  };

  await db.transaction(async (tx) => {
    const payerIds = new Map<string, string>();
    for (const p of await tx.select({ id: schema.payers.id, name: schema.payers.name }).from(schema.payers))
      payerIds.set(p.name.toLowerCase(), p.id);

    const payerId = async (name: string) => {
      const key = name.toLowerCase();
      const hit = payerIds.get(key);
      if (hit) return hit;
      const [row] = await tx.insert(schema.payers).values({ name }).returning({ id: schema.payers.id });
      payerIds.set(key, row.id);
      summary.payersCreated.push(name);
      return row.id;
    };

    for (const pp of parsed.practices) {
      // ---- practice ----
      const matchOn = pp.groupNpi
        ? eq(schema.practices.groupNpi, pp.groupNpi)
        : pp.taxId
          ? eq(schema.practices.taxId, pp.taxId)
          : sql`lower(${schema.practices.name}) = ${pp.name.toLowerCase()}`;
      let [practice] = await tx.select().from(schema.practices).where(matchOn).limit(1);
      const practiceData = {
        name: pp.name,
        groupNpi: pp.groupNpi,
        taxId: pp.taxId,
        serviceAddress: pp.serviceAddress,
        billingAddress: pp.billingAddress,
        phone: pp.phone,
        fax: pp.fax,
        clientSheetUrl: pp.clientSheetUrl,
        notes: pp.notes.join("\n") || null,
      };
      if (practice) {
        summary.practicesMatched++;
        const patch = fillEmpty(practice, practiceData);
        if (Object.keys(patch).length) await tx.update(schema.practices).set(patch).where(eq(schema.practices.id, practice.id));
      } else {
        [practice] = await tx.insert(schema.practices).values(practiceData).returning();
        summary.practicesCreated++;
      }

      const groupIds = new Map<string, string>(); // payer name -> group enrollment id
      for (const g of pp.groupEnrollments) {
        const id = await upsertEnrollment(tx, practice.id, null, await payerId(g.payerName), g, opts.userId, today, summary);
        groupIds.set(g.payerName, id);
      }

      // ---- providers ----
      for (const prov of pp.providers) {
        let [provider] = prov.npi
          ? await tx.select().from(schema.providers).where(eq(schema.providers.npi, prov.npi)).limit(1)
          : await tx
              .select()
              .from(schema.providers)
              .where(sql`lower(${schema.providers.name}) = ${prov.name.toLowerCase()}`)
              .limit(1);
        const ssnDigits = prov.ssn?.replace(/\D/g, "") ?? "";
        const providerData = {
          name: prov.name,
          npi: prov.npi,
          specialty: prov.specialty,
          taxonomyCode: prov.taxonomyCode,
          ssnEnc: encrypt(prov.ssn),
          ssnLast4: ssnDigits ? ssnDigits.slice(-4) : null,
          dob: prov.dob,
          gender: prov.gender,
          email: prov.email,
          phone: prov.phone,
          homeAddress: prov.homeAddress,
          caqhId: prov.caqhId,
          medicareId: prov.medicareId,
          medicaidId: prov.medicaidId,
          boardCertification: prov.boardCertification,
        };
        if (provider) {
          summary.providersMatched++;
          const patch = fillEmpty(provider, providerData);
          if (Object.keys(patch).length) await tx.update(schema.providers).set(patch).where(eq(schema.providers.id, provider.id));
        } else {
          [provider] = await tx.insert(schema.providers).values(providerData).returning();
          summary.providersCreated++;
        }
        await tx
          .insert(schema.practiceProviders)
          .values({ practiceId: practice.id, providerId: provider.id })
          .onConflictDoNothing();

        for (const c of prov.credentials) {
          const exists = await tx
            .select({ id: schema.credentials.id })
            .from(schema.credentials)
            .where(
              and(
                eq(schema.credentials.providerId, provider.id),
                eq(schema.credentials.type, c.type),
                c.number ? eq(schema.credentials.number, c.number) : isNull(schema.credentials.number),
              ),
            )
            .limit(1);
          if (!exists.length)
            await tx.insert(schema.credentials).values({
              providerId: provider.id,
              type: c.type,
              number: c.number,
              issuedOn: c.issuedOn,
              expiresOn: c.expiresOn,
              notes: c.raw,
            });
        }

        for (const l of prov.logins) {
          const exists = await tx
            .select({ id: schema.portalLogins.id })
            .from(schema.portalLogins)
            .where(and(eq(schema.portalLogins.providerId, provider.id), eq(schema.portalLogins.portal, l.portal)))
            .limit(1);
          if (!exists.length)
            await tx.insert(schema.portalLogins).values({
              providerId: provider.id,
              portal: l.portal,
              username: l.username,
              passwordEnc: encrypt(l.password),
            });
        }

        for (const e of prov.enrollments) {
          const id = await upsertEnrollment(tx, practice.id, provider.id, await payerId(e.payerName), e, opts.userId, today, summary);
          const groupId = groupIds.get(e.payerName);
          if (e.status === "waiting" && groupId)
            await tx.update(schema.enrollments).set({ dependsOnId: groupId }).where(eq(schema.enrollments.id, id));
        }
      }
    }

    await tx.insert(schema.imports).values({
      fileName: opts.fileName,
      fileHash: opts.fileHash,
      importedById: opts.userId,
      summary,
    });
    await tx.insert(schema.auditLog).values({
      userId: opts.userId,
      action: "import",
      entity: "file",
      entityId: opts.fileName,
      detail: summary,
    });
  });

  return summary;
}

async function upsertEnrollment(
  tx: Tx,
  practiceId: string,
  providerId: string | null,
  payerId: string,
  e: ParsedEnrollment,
  userId: string,
  today: string,
  summary: ImportSummary,
): Promise<string> {
  const [existing] = await tx
    .select()
    .from(schema.enrollments)
    .where(
      and(
        eq(schema.enrollments.practiceId, practiceId),
        providerId ? eq(schema.enrollments.providerId, providerId) : isNull(schema.enrollments.providerId),
        eq(schema.enrollments.payerId, payerId),
        eq(schema.enrollments.type, e.type),
      ),
    )
    .limit(1);

  const data = {
    status: e.status,
    statusNote: e.statusNote,
    payerProviderId: e.payerProviderId,
    effectiveDate: e.effectiveDate,
    nextFollowUp: e.nextFollowUp,
    invoiceStatus: e.invoiceStatus,
  };

  let id: string;
  if (existing) {
    // the sheet is the department's latest word on status, so status fields are overwritten
    await tx.update(schema.enrollments).set(data).where(eq(schema.enrollments.id, existing.id));
    id = existing.id;
    summary.enrollmentsUpdated++;
  } else {
    const [row] = await tx
      .insert(schema.enrollments)
      .values({ practiceId, providerId, payerId, type: e.type, ...data })
      .returning({ id: schema.enrollments.id });
    id = row.id;
    summary.enrollmentsCreated++;
  }

  if (e.remark) {
    await tx.insert(schema.activities).values({
      enrollmentId: id,
      userId,
      occurredOn: e.remarkDate ?? today,
      kind: "import",
      note: e.remark,
    });
  }
  return id;
}
