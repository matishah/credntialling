"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { audit, canSeePractice, ForbiddenError, requirePermission, type CurrentUser } from "@/lib/auth";
import { required, safe, str, UserError, type ActionState } from "@/lib/action";
import { addDays, todayISO } from "@/lib/dates";
import { STATUS } from "@/lib/labels";
import type { EnrollmentStatus, InvoiceStatus } from "@/lib/db/schema";

const { enrollments, activities } = schema;

async function loadEnrollment(user: CurrentUser, id: string) {
  const [e] = await db.select().from(enrollments).where(eq(enrollments.id, id));
  if (!e || !canSeePractice(user, e.practiceId)) throw new ForbiddenError("Enrollment not found.");
  return e;
}

/** Side effects of a status change, shared by every way a status can change. */
async function applyStatusChange(user: CurrentUser, e: typeof enrollments.$inferSelect, next: EnrollmentStatus) {
  const patch: Partial<typeof enrollments.$inferInsert> = { status: next };
  if (next === "participating") {
    patch.nextFollowUp = null;
    if (e.invoiceStatus === "not_billable") patch.invoiceStatus = "ready";
  }
  if (next === "denied" || next === "other_group") patch.nextFollowUp = null;
  await db.update(enrollments).set(patch).where(eq(enrollments.id, e.id));
  await db.insert(activities).values({
    enrollmentId: e.id,
    userId: user.id,
    occurredOn: todayISO(),
    kind: "status",
    note: `Status: ${STATUS[e.status].label} → ${STATUS[next].label}`,
  });

  // Group approved -> unblock individual enrollments that were waiting on it.
  if (next === "participating") {
    const waiting = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.dependsOnId, e.id), eq(enrollments.status, "waiting")));
    for (const w of waiting) {
      await db
        .update(enrollments)
        .set({ status: "not_started", nextFollowUp: todayISO() })
        .where(eq(enrollments.id, w.id));
      await db.insert(activities).values({
        enrollmentId: w.id,
        userId: user.id,
        occurredOn: todayISO(),
        kind: "status",
        note: "Group enrollment approved – ready to start this enrollment",
      });
    }
  }
}

const STATUSES = Object.keys(STATUS) as EnrollmentStatus[];

export async function logActivity(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const user = await requirePermission("enrollments.edit");
    const e = await loadEnrollment(user, required(fd, "enrollmentId"));
    const note = required(fd, "note", "Note");
    const kind = str(fd, "kind") ?? "note";
    const occurredOn = str(fd, "occurredOn") ?? todayISO();
    await db.insert(activities).values({
      enrollmentId: e.id,
      userId: user.id,
      occurredOn,
      kind,
      note,
      refNumber: str(fd, "refNumber"),
    });

    const patch: Partial<typeof enrollments.$inferInsert> = { nextFollowUp: str(fd, "nextFollowUp") };
    if (kind === "submitted" && !e.submittedOn) patch.submittedOn = occurredOn;
    if (kind === "submitted" && e.status === "not_started") patch.status = "in_process";
    await db.update(enrollments).set(patch).where(eq(enrollments.id, e.id));

    const newStatus = str(fd, "status") as EnrollmentStatus | null;
    if (newStatus && STATUSES.includes(newStatus) && newStatus !== (patch.status ?? e.status))
      await applyStatusChange(user, { ...e, ...patch } as typeof e, newStatus);

    revalidatePath("/", "layout");
    return "Logged";
  });
}

export async function updateEnrollment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const user = await requirePermission("enrollments.edit");
    const e = await loadEnrollment(user, required(fd, "enrollmentId"));
    await db
      .update(enrollments)
      .set({
        payerProviderId: str(fd, "payerProviderId"),
        effectiveDate: str(fd, "effectiveDate"),
        submittedOn: str(fd, "submittedOn"),
        nextFollowUp: str(fd, "nextFollowUp"),
        statusNote: str(fd, "statusNote"),
        assignedToId: str(fd, "assignedToId"),
      })
      .where(eq(enrollments.id, e.id));
    const status = str(fd, "status") as EnrollmentStatus | null;
    if (status && STATUSES.includes(status) && status !== e.status) {
      const [fresh] = await db.select().from(enrollments).where(eq(enrollments.id, e.id));
      await applyStatusChange(user, fresh, status);
    }
    revalidatePath("/", "layout");
  });
}

export async function snoozeFollowUp(enrollmentId: string, days: number) {
  const user = await requirePermission("enrollments.edit");
  const e = await loadEnrollment(user, enrollmentId);
  const next = addDays(todayISO(), days);
  await db.update(enrollments).set({ nextFollowUp: next }).where(eq(enrollments.id, e.id));
  await db.insert(activities).values({
    enrollmentId: e.id,
    userId: user.id,
    occurredOn: todayISO(),
    kind: "note",
    note: `Follow-up moved to ${next}`,
  });
  revalidatePath("/", "layout");
}

export async function setInvoiceStatus(enrollmentId: string, status: InvoiceStatus) {
  const user = await requirePermission("invoicing.manage");
  const e = await loadEnrollment(user, enrollmentId);
  await db
    .update(enrollments)
    .set({ invoiceStatus: status, invoicedOn: status === "invoiced" ? todayISO() : e.invoicedOn })
    .where(eq(enrollments.id, e.id));
  await audit(user.id, "invoice_status", "enrollment", e.id, { from: e.invoiceStatus, to: status });
  revalidatePath("/", "layout");
}

export async function createEnrollment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let newId = "";
  const res = await safe(async () => {
    const user = await requirePermission("enrollments.edit");
    const practiceId = required(fd, "practiceId");
    if (!canSeePractice(user, practiceId)) throw new ForbiddenError();
    const providerId = str(fd, "providerId");
    const payerId = required(fd, "payerId", "Payer");
    const type = providerId ? "individual" : "group";
    const dup = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.practiceId, practiceId),
          eq(enrollments.payerId, payerId),
          eq(enrollments.type, type),
          providerId ? eq(enrollments.providerId, providerId) : undefined,
        ),
      );
    if (dup.length && (type === "group" || providerId)) throw new UserError("That enrollment already exists.");
    const [row] = await db
      .insert(enrollments)
      .values({
        practiceId,
        providerId,
        payerId,
        type,
        status: "not_started",
        nextFollowUp: todayISO(),
        assignedToId: user.id,
      })
      .returning({ id: enrollments.id });
    newId = row.id;
    await audit(user.id, "create", "enrollment", row.id);
  });
  if (newId) redirect(`/enrollments/${newId}`);
  return res;
}
