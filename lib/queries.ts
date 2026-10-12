import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, lte, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db, schema } from "./db";
import type { CurrentUser } from "./auth";
import { addDays, todayISO } from "./dates";
import { OPEN_STATUSES } from "./labels";
import type { EnrollmentStatus, InvoiceStatus } from "./db/schema";

const {
  practices,
  providers,
  practiceProviders,
  payers,
  enrollments,
  activities,
  credentials,
  portalLogins,
  users,
  providerHistory,
  documents,
} = schema;

/** Row-level scope: users without practices.view_all only see assigned practices. */
function practiceScope(user: CurrentUser, column: AnyColumn = enrollments.practiceId): SQL | undefined {
  if (user.practiceIds === null) return undefined;
  if (user.practiceIds.length === 0) return sql`false`;
  return inArray(column, user.practiceIds);
}

const enrollmentColumns = {
  id: enrollments.id,
  status: enrollments.status,
  statusNote: enrollments.statusNote,
  type: enrollments.type,
  payerProviderId: enrollments.payerProviderId,
  effectiveDate: enrollments.effectiveDate,
  nextFollowUp: enrollments.nextFollowUp,
  invoiceStatus: enrollments.invoiceStatus,
  updatedAt: enrollments.updatedAt,
  practiceId: practices.id,
  practiceName: practices.name,
  providerId: providers.id,
  providerName: providers.name,
  payerId: payers.id,
  payerName: payers.name,
  assignedToName: users.name,
  lastNote: sql<string | null>`(select a.note from activities a where a.enrollment_id = ${enrollments.id} order by a.occurred_on desc, a.created_at desc limit 1)`,
};

function enrollmentBase() {
  return db
    .select(enrollmentColumns)
    .from(enrollments)
    .innerJoin(practices, eq(practices.id, enrollments.practiceId))
    .innerJoin(payers, eq(payers.id, enrollments.payerId))
    .leftJoin(providers, eq(providers.id, enrollments.providerId))
    .leftJoin(users, eq(users.id, enrollments.assignedToId));
}
export type EnrollmentRow = Awaited<ReturnType<typeof enrollmentBase>>[number];

// ---------------- Today ----------------

export async function getToday(user: CurrentUser) {
  const today = todayISO();
  const scope = practiceScope(user);
  const open = inArray(enrollments.status, OPEN_STATUSES);

  const due = await enrollmentBase()
    .where(and(scope, open, lte(enrollments.nextFollowUp, today)))
    .orderBy(asc(enrollments.nextFollowUp), asc(practices.name))
    .limit(200);

  const upcoming = await enrollmentBase()
    .where(
      and(
        scope,
        open,
        sql`${enrollments.nextFollowUp} > ${today}`,
        lte(enrollments.nextFollowUp, addDays(today, 7)),
      ),
    )
    .orderBy(asc(enrollments.nextFollowUp))
    .limit(100);

  const ready = await enrollmentBase()
    .where(and(scope, eq(enrollments.invoiceStatus, "ready")))
    .orderBy(asc(practices.name))
    .limit(200);

  const expiring = await db
    .selectDistinctOn([credentials.id], {
      id: credentials.id,
      type: credentials.type,
      number: credentials.number,
      expiresOn: credentials.expiresOn,
      providerId: providers.id,
      providerName: providers.name,
    })
    .from(credentials)
    .innerJoin(providers, eq(providers.id, credentials.providerId))
    .innerJoin(practiceProviders, eq(practiceProviders.providerId, providers.id))
    .where(and(practiceScope(user, practiceProviders.practiceId), lte(credentials.expiresOn, addDays(today, 90))))
    .orderBy(credentials.id);
  expiring.sort((a, b) => (a.expiresOn ?? "").localeCompare(b.expiresOn ?? ""));

  const counts = await db
    .select({ status: enrollments.status, n: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(scope)
    .groupBy(enrollments.status);

  return { today, due, upcoming, ready, expiring, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) };
}

// ---------------- Practices ----------------

export async function listPractices(user: CurrentUser) {
  return db
    .select({
      id: practices.id,
      name: practices.name,
      groupNpi: practices.groupNpi,
      taxId: practices.taxId,
      active: practices.active,
      providerCount: sql<number>`(select count(*)::int from practice_providers pp where pp.practice_id = ${practices.id})`,
      total: sql<number>`(select count(*)::int from enrollments e where e.practice_id = ${practices.id})`,
      participating: sql<number>`(select count(*)::int from enrollments e where e.practice_id = ${practices.id} and e.status = 'participating')`,
      inProcess: sql<number>`(select count(*)::int from enrollments e where e.practice_id = ${practices.id} and e.status in ('in_process','waiting','not_started'))`,
      overdue: sql<number>`(select count(*)::int from enrollments e where e.practice_id = ${practices.id} and e.status in ('not_started','in_process','waiting','on_hold','panel_closed') and e.next_follow_up <= ${todayISO()})`,
    })
    .from(practices)
    .where(practiceScope(user, practices.id))
    .orderBy(asc(practices.name));
}

export async function getPractice(user: CurrentUser, id: string) {
  const [practice] = await db
    .select()
    .from(practices)
    .where(and(eq(practices.id, id), practiceScope(user, practices.id)));
  if (!practice) return null;

  const providerRows = await db
    .select({
      id: providers.id,
      name: providers.name,
      npi: providers.npi,
      specialty: providers.specialty,
      total: sql<number>`(select count(*)::int from enrollments e where e.provider_id = ${providers.id} and e.practice_id = ${id})`,
      participating: sql<number>`(select count(*)::int from enrollments e where e.provider_id = ${providers.id} and e.practice_id = ${id} and e.status = 'participating')`,
    })
    .from(practiceProviders)
    .innerJoin(providers, eq(providers.id, practiceProviders.providerId))
    .where(eq(practiceProviders.practiceId, id))
    .orderBy(asc(providers.name));

  const enrollmentRows = await enrollmentBase()
    .where(eq(enrollments.practiceId, id))
    .orderBy(asc(payers.name));

  const logins = await db
    .select({ id: portalLogins.id, portal: portalLogins.portal, username: portalLogins.username, url: portalLogins.url, hasPassword: sql<boolean>`${portalLogins.passwordEnc} is not null` })
    .from(portalLogins)
    .where(eq(portalLogins.practiceId, id));

  return {
    practice,
    providers: providerRows,
    enrollments: enrollmentRows,
    logins,
    documents: await listDocuments(eq(documents.practiceId, id)),
  };
}

// ---------------- Providers ----------------

export async function listProviders(user: CurrentUser) {
  const rows = await db
    .select({
      id: providers.id,
      name: providers.name,
      npi: providers.npi,
      specialty: providers.specialty,
      practiceId: practices.id,
      practiceName: practices.name,
    })
    .from(providers)
    .innerJoin(practiceProviders, eq(practiceProviders.providerId, providers.id))
    .innerJoin(practices, eq(practices.id, practiceProviders.practiceId))
    .where(practiceScope(user, practices.id))
    .orderBy(asc(providers.name));
  const byId = new Map<string, { id: string; name: string; npi: string | null; specialty: string | null; practices: { id: string; name: string }[] }>();
  for (const r of rows) {
    const p = byId.get(r.id) ?? { id: r.id, name: r.name, npi: r.npi, specialty: r.specialty, practices: [] };
    p.practices.push({ id: r.practiceId, name: r.practiceName });
    byId.set(r.id, p);
  }
  return [...byId.values()];
}

export async function getProvider(user: CurrentUser, id: string) {
  const links = await db
    .select({ id: practices.id, name: practices.name })
    .from(practiceProviders)
    .innerJoin(practices, eq(practices.id, practiceProviders.practiceId))
    .where(and(eq(practiceProviders.providerId, id), practiceScope(user, practices.id)));
  if (!links.length) return null;

  const [provider] = await db.select().from(providers).where(eq(providers.id, id));
  if (!provider) return null;
  const { ssnEnc: _omit, ...safe } = provider;

  const practiceIds = links.map((l) => l.id);
  const enrollmentRows = await enrollmentBase()
    .where(
      or(
        eq(enrollments.providerId, id),
        // group enrollments of the provider's practices are shown alongside
        and(isNull(enrollments.providerId), inArray(enrollments.practiceId, practiceIds)),
      ),
    )
    .orderBy(asc(payers.name));

  const creds = await db.select().from(credentials).where(eq(credentials.providerId, id)).orderBy(asc(credentials.expiresOn));
  const logins = await db
    .select({ id: portalLogins.id, portal: portalLogins.portal, username: portalLogins.username, url: portalLogins.url, hasPassword: sql<boolean>`${portalLogins.passwordEnc} is not null` })
    .from(portalLogins)
    .where(eq(portalLogins.providerId, id))
    .orderBy(asc(portalLogins.portal));

  const history = await db
    .select()
    .from(providerHistory)
    .where(eq(providerHistory.providerId, id))
    .orderBy(asc(providerHistory.kind), desc(providerHistory.startDate));

  return {
    provider: { ...safe, hasSsn: !!provider.ssnEnc },
    practices: links,
    enrollments: enrollmentRows,
    credentials: creds,
    logins,
    history,
    documents: await listDocuments(eq(documents.providerId, id)),
  };
}

// ---------------- Documents ----------------

export type DocumentRow = Awaited<ReturnType<typeof listDocuments>>[number];

/** Caller has already checked access to the owning provider / practice. */
async function listDocuments(where: SQL) {
  return db
    .select({
      id: documents.id,
      category: documents.category,
      fileName: documents.fileName,
      size: documents.size,
      expiresOn: documents.expiresOn,
      createdAt: documents.createdAt,
      uploadedBy: users.name,
    })
    .from(documents)
    .leftJoin(users, eq(users.id, documents.uploadedById))
    .where(where)
    .orderBy(asc(documents.category), desc(documents.createdAt));
}

// ---------------- Enrollments ----------------

export type EnrollmentFilters = {
  q?: string;
  status?: EnrollmentStatus | "open";
  payerId?: string;
  practiceId?: string;
  assigned?: "me" | "none";
  invoice?: InvoiceStatus;
  due?: "overdue" | "week";
};

export async function listEnrollments(user: CurrentUser, f: EnrollmentFilters) {
  const today = todayISO();
  const conds: (SQL | undefined)[] = [practiceScope(user)];
  if (f.status === "open") conds.push(inArray(enrollments.status, OPEN_STATUSES));
  else if (f.status) conds.push(eq(enrollments.status, f.status));
  if (f.payerId) conds.push(eq(enrollments.payerId, f.payerId));
  if (f.practiceId) conds.push(eq(enrollments.practiceId, f.practiceId));
  if (f.assigned === "me") conds.push(eq(enrollments.assignedToId, user.id));
  if (f.assigned === "none") conds.push(isNull(enrollments.assignedToId));
  if (f.invoice) conds.push(eq(enrollments.invoiceStatus, f.invoice));
  if (f.due === "overdue") conds.push(lte(enrollments.nextFollowUp, today), inArray(enrollments.status, OPEN_STATUSES));
  if (f.due === "week") conds.push(lte(enrollments.nextFollowUp, addDays(today, 7)), inArray(enrollments.status, OPEN_STATUSES));
  if (f.q) {
    const like = `%${f.q}%`;
    conds.push(
      or(
        ilike(practices.name, like),
        ilike(providers.name, like),
        ilike(payers.name, like),
        ilike(enrollments.payerProviderId, like),
      ),
    );
  }
  return enrollmentBase()
    .where(and(...conds))
    .orderBy(sql`${enrollments.nextFollowUp} asc nulls last`, asc(practices.name), asc(payers.name))
    .limit(500);
}

export async function getEnrollment(user: CurrentUser, id: string) {
  const [row] = await db
    .select({
      ...enrollmentColumns,
      assignedToId: enrollments.assignedToId,
      dependsOnId: enrollments.dependsOnId,
      invoicedOn: enrollments.invoicedOn,
      submittedOn: enrollments.submittedOn,
      payerPortal: payers.portalUrl,
      payerPhone: payers.phone,
      payerRequirements: payers.requirements,
      providerNpi: providers.npi,
      groupNpi: practices.groupNpi,
      taxId: practices.taxId,
    })
    .from(enrollments)
    .innerJoin(practices, eq(practices.id, enrollments.practiceId))
    .innerJoin(payers, eq(payers.id, enrollments.payerId))
    .leftJoin(providers, eq(providers.id, enrollments.providerId))
    .leftJoin(users, eq(users.id, enrollments.assignedToId))
    .where(and(eq(enrollments.id, id), practiceScope(user)));
  if (!row) return null;

  const history = await db
    .select({
      id: activities.id,
      occurredOn: activities.occurredOn,
      kind: activities.kind,
      note: activities.note,
      refNumber: activities.refNumber,
      userName: users.name,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .leftJoin(users, eq(users.id, activities.userId))
    .where(eq(activities.enrollmentId, id))
    .orderBy(desc(activities.occurredOn), desc(activities.createdAt));

  let dependsOn: { id: string; status: EnrollmentStatus; payerName: string } | null = null;
  if (row.dependsOnId) {
    const [d] = await db
      .select({ id: enrollments.id, status: enrollments.status, payerName: payers.name })
      .from(enrollments)
      .innerJoin(payers, eq(payers.id, enrollments.payerId))
      .where(eq(enrollments.id, row.dependsOnId));
    dependsOn = d ?? null;
  }
  return { enrollment: row, history, dependsOn };
}

// ---------------- lookups ----------------

export const listPayers = () => db.select().from(payers).orderBy(asc(payers.name));

export const listActiveUsers = () =>
  db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name));

export async function search(user: CurrentUser, q: string) {
  const like = `%${q}%`;
  const digits = q.replace(/\D/g, "");
  const [practiceHits, providerHits, enrollmentHits] = await Promise.all([
    db
      .select({ id: practices.id, name: practices.name, groupNpi: practices.groupNpi, taxId: practices.taxId })
      .from(practices)
      .where(
        and(
          practiceScope(user, practices.id),
          or(
            ilike(practices.name, like),
            digits.length >= 4 ? ilike(practices.groupNpi, `%${digits}%`) : undefined,
            digits.length >= 4 ? ilike(practices.taxId, `%${digits}%`) : undefined,
          ),
        ),
      )
      .limit(8),
    db
      .selectDistinct({ id: providers.id, name: providers.name, npi: providers.npi, specialty: providers.specialty })
      .from(providers)
      .innerJoin(practiceProviders, eq(practiceProviders.providerId, providers.id))
      .where(
        and(
          practiceScope(user, practiceProviders.practiceId),
          or(
            ilike(providers.name, like),
            digits.length >= 4 ? ilike(providers.npi, `%${digits}%`) : undefined,
            ilike(providers.caqhId, like),
          ),
        ),
      )
      .limit(8),
    q.length >= 3
      ? enrollmentBase()
          .where(and(practiceScope(user), or(ilike(enrollments.payerProviderId, like), ilike(payers.name, like))))
          .limit(8)
      : Promise.resolve([] as EnrollmentRow[]),
  ]);
  return {
    practices: practiceHits,
    providers: providerHits,
    enrollments: enrollmentHits.map((e) => ({
      id: e.id,
      payerName: e.payerName,
      providerName: e.providerName,
      practiceName: e.practiceName,
      payerProviderId: e.payerProviderId,
      status: e.status,
    })),
  };
}
