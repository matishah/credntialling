"use server";

// Practices, providers, credentials, portal logins and payers.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertProviderAccess, audit, can, canSeePractice, ForbiddenError, requirePermission } from "@/lib/auth";
import { required, safe, str, UserError, type ActionState } from "@/lib/action";
import { decrypt, encrypt } from "@/lib/crypto";
import { readDocRows, saveDocuments } from "@/lib/documents";
import { CREDENTIAL, HISTORY } from "@/lib/labels";
import type { CredentialType, HistoryKind } from "@/lib/db/schema";

const { practices, providers, practiceProviders, credentials, portalLogins, payers, userPractices, providerHistory } = schema;

const encryptSsn = (ssn: string | null) => (ssn ? { ssnEnc: encrypt(ssn), ssnLast4: ssn.replace(/\D/g, "").slice(-4) } : {});

const practiceFields = (fd: FormData) => ({
  name: required(fd, "name", "Practice name"),
  groupNpi: str(fd, "groupNpi"),
  taxId: str(fd, "taxId"),
  serviceAddress: str(fd, "serviceAddress"),
  billingAddress: str(fd, "billingAddress"),
  phone: str(fd, "phone"),
  fax: str(fd, "fax"),
  email: str(fd, "email"),
  clientSheetUrl: str(fd, "clientSheetUrl"),
  notes: str(fd, "notes"),
});

export async function savePractice(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId = "";
  const res = await safe(async () => {
    const user = await requirePermission("practices.edit");
    const id = str(fd, "id");
    const data = practiceFields(fd);
    if (id) {
      if (!canSeePractice(user, id)) throw new ForbiddenError();
      await db.update(practices).set(data).where(eq(practices.id, id));
      await audit(user.id, "update", "practice", id);
    } else {
      const [row] = await db.insert(practices).values(data).returning({ id: practices.id });
      createdId = row.id;
      if (user.practiceIds !== null) await db.insert(userPractices).values({ userId: user.id, practiceId: row.id });
      await audit(user.id, "create", "practice", row.id);
    }
    revalidatePath("/", "layout");
  });
  if (createdId) redirect(`/practices/${createdId}`);
  return res;
}

const providerFields = (fd: FormData) => ({
  name: required(fd, "name", "Provider name"),
  degree: str(fd, "degree"),
  otherNames: str(fd, "otherNames"),
  npi: str(fd, "npi"),
  specialty: str(fd, "specialty"),
  taxonomyCode: str(fd, "taxonomyCode"),
  dob: str(fd, "dob"),
  gender: str(fd, "gender"),
  placeOfBirth: str(fd, "placeOfBirth"),
  citizenship: str(fd, "citizenship"),
  languages: str(fd, "languages"),
  email: str(fd, "email"),
  phone: str(fd, "phone"),
  homeAddress: str(fd, "homeAddress"),
  caqhId: str(fd, "caqhId"),
  pecosId: str(fd, "pecosId"),
  medicareId: str(fd, "medicareId"),
  medicaidId: str(fd, "medicaidId"),
  boardCertification: str(fd, "boardCertification"),
  notes: str(fd, "notes"),
});

export async function saveProvider(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId = "";
  const res = await safe(async () => {
    const user = await requirePermission("practices.edit");
    const id = str(fd, "id");
    const data = providerFields(fd);
    const ssnPatch = encryptSsn(can(user, "sensitive.view") ? str(fd, "ssn") : null);
    const ssn = "ssnEnc" in ssnPatch;
    if (id) {
      await assertProviderAccess(user.practiceIds, id);
      // fields hidden from this user (e.g. DOB without sensitive.view) are absent from the form: leave them alone
      const present = Object.fromEntries(Object.entries(data).filter(([k]) => fd.has(k)));
      await db.update(providers).set({ ...present, ...ssnPatch }).where(eq(providers.id, id));
      await audit(user.id, "update", "provider", id, ssn ? { ssnChanged: true } : undefined);
    } else {
      const practiceId = required(fd, "practiceId");
      if (!canSeePractice(user, practiceId)) throw new ForbiddenError();
      const [row] = await db.insert(providers).values({ ...data, ...ssnPatch }).returning({ id: providers.id });
      await db.insert(practiceProviders).values({ practiceId, providerId: row.id });
      createdId = row.id;
      await audit(user.id, "create", "provider", row.id);
    }
    revalidatePath("/", "layout");
  });
  if (createdId) redirect(`/providers/${createdId}`);
  return res;
}

// ---------- sensitive reveals (always audited) ----------

export async function revealSsn(providerId: string): Promise<string | null> {
  const user = await requirePermission("sensitive.view");
  await assertProviderAccess(user.practiceIds, providerId);
  const [p] = await db.select({ ssnEnc: providers.ssnEnc }).from(providers).where(eq(providers.id, providerId));
  await audit(user.id, "reveal_ssn", "provider", providerId);
  return decrypt(p?.ssnEnc);
}

export async function revealPassword(loginId: string): Promise<string | null> {
  const user = await requirePermission("logins.view");
  const [l] = await db.select().from(portalLogins).where(eq(portalLogins.id, loginId));
  if (!l) return null;
  if (l.practiceId && !canSeePractice(user, l.practiceId)) throw new ForbiddenError();
  if (l.providerId) await assertProviderAccess(user.practiceIds, l.providerId);
  await audit(user.id, "reveal_password", "portal_login", loginId, { portal: l.portal });
  return decrypt(l.passwordEnc);
}

export async function saveLogin(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const user = await requirePermission("logins.edit");
    const id = str(fd, "id");
    const providerId = str(fd, "providerId");
    const practiceId = str(fd, "practiceId");
    if (providerId) await assertProviderAccess(user.practiceIds, providerId);
    if (practiceId && !canSeePractice(user, practiceId)) throw new ForbiddenError();
    const password = str(fd, "password");
    const data = {
      portal: required(fd, "portal", "Portal").toUpperCase(),
      url: str(fd, "url"),
      username: str(fd, "username"),
      notes: str(fd, "notes"),
      ...(password ? { passwordEnc: encrypt(password) } : {}),
    };
    if (id) await db.update(portalLogins).set(data).where(eq(portalLogins.id, id));
    else await db.insert(portalLogins).values({ ...data, providerId, practiceId });
    await audit(user.id, id ? "update" : "create", "portal_login", id, { portal: data.portal });
    revalidatePath("/", "layout");
  });
}

export async function deleteLogin(loginId: string) {
  const user = await requirePermission("logins.edit");
  const [l] = await db.select().from(portalLogins).where(eq(portalLogins.id, loginId));
  if (!l) return;
  if (l.practiceId && !canSeePractice(user, l.practiceId)) throw new ForbiddenError();
  if (l.providerId) await assertProviderAccess(user.practiceIds, l.providerId);
  await db.delete(portalLogins).where(eq(portalLogins.id, loginId));
  await audit(user.id, "delete", "portal_login", loginId, { portal: l.portal });
  revalidatePath("/", "layout");
}

// ---------- credentials (license, DEA, ...) ----------

export async function saveCredential(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const user = await requirePermission("practices.edit");
    const providerId = required(fd, "providerId");
    await assertProviderAccess(user.practiceIds, providerId);
    const id = str(fd, "id");
    const data = {
      type: required(fd, "type", "Type") as CredentialType,
      number: str(fd, "number"),
      state: str(fd, "state")?.toUpperCase() ?? null,
      issuer: str(fd, "issuer"),
      coverage: str(fd, "coverage"),
      issuedOn: str(fd, "issuedOn"),
      expiresOn: str(fd, "expiresOn"),
      notes: str(fd, "notes"),
    };
    if (id) await db.update(credentials).set(data).where(and(eq(credentials.id, id), eq(credentials.providerId, providerId)));
    else await db.insert(credentials).values({ ...data, providerId });
    revalidatePath("/", "layout");
  });
}

export async function deleteCredential(id: string) {
  const user = await requirePermission("practices.edit");
  const [c] = await db.select().from(credentials).where(eq(credentials.id, id));
  if (!c) return;
  await assertProviderAccess(user.practiceIds, c.providerId);
  await db.delete(credentials).where(eq(credentials.id, id));
  revalidatePath("/", "layout");
}

// ---------- education, training, affiliations, work history ----------

const isHistoryKind = (k: string | null): k is HistoryKind => !!k && k in HISTORY;

export async function saveHistory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const user = await requirePermission("practices.edit");
    const providerId = required(fd, "providerId");
    await assertProviderAccess(user.practiceIds, providerId);
    const kind = str(fd, "kind");
    if (!isHistoryKind(kind)) throw new UserError("Choose what kind of entry this is");
    await db.insert(providerHistory).values({
      providerId,
      kind,
      institution: required(fd, "institution", HISTORY[kind].institution),
      detail: str(fd, "detail"),
      location: str(fd, "location"),
      startDate: str(fd, "startDate"),
      endDate: str(fd, "endDate"),
    });
    revalidatePath("/", "layout");
  });
}

export async function deleteHistory(id: string) {
  const user = await requirePermission("practices.edit");
  const [h] = await db.select().from(providerHistory).where(eq(providerHistory.id, id));
  if (!h) return;
  await assertProviderAccess(user.practiceIds, h.providerId);
  await db.delete(providerHistory).where(eq(providerHistory.id, id));
  revalidatePath("/", "layout");
}

// ---------- onboarding: one form -> provider, licenses, background, logins, documents ----------

/** Repeated inputs named `<prefix>_<key>` come back as parallel lists; zip them into row objects. */
function rows<K extends string>(fd: FormData, prefix: string, keys: readonly K[]) {
  const cols = keys.map((k) => fd.getAll(`${prefix}_${k}`).map((v) => (typeof v === "string" && v.trim() ? v.trim() : null)));
  const n = Math.max(0, ...cols.map((c) => c.length));
  return Array.from({ length: n }, (_, i) => Object.fromEntries(keys.map((k, j) => [k, cols[j][i] ?? null])) as Record<K, string | null>);
}

export async function onboardProvider(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let createdId = "";
  const res = await safe(async () => {
    const user = await requirePermission("practices.edit");
    const practiceId = required(fd, "practiceId", "Practice");
    if (!canSeePractice(user, practiceId)) throw new ForbiddenError();

    const data = providerFields(fd);
    const sensitive = can(user, "sensitive.view");
    if (!sensitive) Object.assign(data, { dob: null, homeAddress: null });
    if (data.npi) {
      const [dup] = await db.select({ name: providers.name }).from(providers).where(eq(providers.npi, data.npi));
      if (dup) throw new UserError(`${dup.name} already has NPI ${data.npi} in the app.`);
    }

    // Collect and validate everything before writing anything.
    const creds = rows(fd, "cred", ["type", "number", "state", "issuer", "coverage", "issued", "expires"] as const).filter(
      (r) => r.type && r.type in CREDENTIAL && (r.number || r.issuer || r.expires),
    );
    const history = rows(fd, "hist", ["kind", "institution", "detail", "location", "start", "end"] as const).filter(
      (r) => isHistoryKind(r.kind) && r.institution,
    );
    const logins = can(user, "logins.edit")
      ? rows(fd, "login", ["portal", "username", "password", "url"] as const).filter((r) => r.portal && (r.username || r.password))
      : [];
    const docs = can(user, "documents.manage") ? readDocRows(fd, "provider") : [];

    const providerId = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(providers)
        .values({ ...data, ...encryptSsn(sensitive ? str(fd, "ssn") : null) })
        .returning({ id: providers.id });
      await tx.insert(practiceProviders).values({ practiceId, providerId: p.id });
      if (creds.length)
        await tx.insert(credentials).values(
          creds.map((r) => ({
            providerId: p.id,
            type: r.type as CredentialType,
            number: r.number,
            state: r.state?.toUpperCase() ?? null,
            issuer: r.issuer,
            coverage: r.coverage,
            issuedOn: r.issued,
            expiresOn: r.expires,
          })),
        );
      if (history.length)
        await tx.insert(providerHistory).values(
          history.map((r) => ({
            providerId: p.id,
            kind: r.kind as HistoryKind,
            institution: r.institution!,
            detail: r.detail,
            location: r.location,
            startDate: r.start,
            endDate: r.end,
          })),
        );
      if (logins.length)
        await tx.insert(portalLogins).values(
          logins.map((r) => ({
            providerId: p.id,
            portal: r.portal!.toUpperCase(),
            username: r.username,
            url: r.url,
            passwordEnc: encrypt(r.password),
          })),
        );
      return p.id;
    });
    createdId = providerId;

    await saveDocuments(docs, { providerId }, user.id);
    await audit(user.id, "onboard", "provider", providerId, {
      practiceId,
      credentials: creds.length,
      history: history.length,
      logins: logins.length,
      documents: docs.length,
    });
    revalidatePath("/", "layout");
  });
  if (createdId) redirect(`/providers/${createdId}`);
  return res;
}

// ---------- payers ----------

export async function savePayer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const user = await requirePermission("payers.edit");
    const id = str(fd, "id");
    const turnaround = str(fd, "turnaroundDays");
    const data = {
      name: required(fd, "name", "Payer name"),
      portalUrl: str(fd, "portalUrl"),
      phone: str(fd, "phone"),
      turnaroundDays: turnaround ? Number(turnaround) || null : null,
      requirements: str(fd, "requirements"),
      notes: str(fd, "notes"),
    };
    if (id) await db.update(payers).set(data).where(eq(payers.id, id));
    else await db.insert(payers).values(data);
    await audit(user.id, id ? "update" : "create", "payer", id, { name: data.name });
    revalidatePath("/", "layout");
  });
}
