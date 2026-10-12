import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ---------- enums ----------

export const enrollmentStatus = pgEnum("enrollment_status", [
  "not_started",
  "in_process",
  "waiting", // blocked on another enrollment (e.g. individual waits for group)
  "participating",
  "panel_closed",
  "other_group", // already enrolled with this payer under another group
  "denied",
  "on_hold",
]);

export const enrollmentType = pgEnum("enrollment_type", ["individual", "group"]);

export const invoiceStatus = pgEnum("invoice_status", [
  "not_billable",
  "ready",
  "invoiced",
  "paid",
]);

export const credentialType = pgEnum("credential_type", [
  "state_license",
  "dea",
  "board_certification",
  "malpractice",
  "caqh_attestation",
  "cds",
  "other",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// ---------- access control ----------

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the cookie token; the raw token never touches the database
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ---------- core domain ----------

export const practices = pgTable("practices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  groupNpi: text("group_npi"),
  taxId: text("tax_id"),
  serviceAddress: text("service_address"),
  billingAddress: text("billing_address"),
  phone: text("phone"),
  fax: text("fax"),
  email: text("email"),
  clientSheetUrl: text("client_sheet_url"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const userPractices = pgTable(
  "user_practices",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.practiceId] })],
);

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    degree: text("degree"), // MD, DO, NP, PA, LCSW ...
    otherNames: text("other_names"), // maiden / previously used names, asked on most applications
    npi: text("npi"),
    specialty: text("specialty"),
    taxonomyCode: text("taxonomy_code"),
    ssnEnc: text("ssn_enc"), // AES-GCM, see lib/crypto.ts
    ssnLast4: text("ssn_last4"),
    dob: date("dob"),
    gender: text("gender"),
    placeOfBirth: text("place_of_birth"),
    citizenship: text("citizenship"),
    languages: text("languages"),
    email: text("email"),
    phone: text("phone"),
    homeAddress: text("home_address"),
    caqhId: text("caqh_id"),
    pecosId: text("pecos_id"), // PECOS enrollment ID (I-number)
    medicareId: text("medicare_id"),
    medicaidId: text("medicaid_id"),
    boardCertification: text("board_certification"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("providers_npi_idx").on(t.npi)],
);

export const historyKind = pgEnum("history_kind", ["education", "training", "affiliation", "work"]);

/** Education, residency/fellowship, hospital privileges and work history – the CAQH-style background. */
export const providerHistory = pgTable(
  "provider_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    kind: historyKind("kind").notNull(),
    institution: text("institution").notNull(),
    detail: text("detail"), // degree, program + specialty, privilege type, or job title
    location: text("location"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("provider_history_provider_idx").on(t.providerId)],
);

export const practiceProviders = pgTable(
  "practice_providers",
  {
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.practiceId, t.providerId] })],
);

export const payers = pgTable("payers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  portalUrl: text("portal_url"),
  phone: text("phone"),
  turnaroundDays: integer("turnaround_days"),
  requirements: text("requirements"),
  notes: text("notes"),
  ...timestamps,
});

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id, { onDelete: "cascade" }),
    // null for a group-level enrollment
    providerId: uuid("provider_id").references(() => providers.id, { onDelete: "cascade" }),
    payerId: uuid("payer_id")
      .notNull()
      .references(() => payers.id),
    type: enrollmentType("type").notNull().default("individual"),
    status: enrollmentStatus("status").notNull().default("not_started"),
    statusNote: text("status_note"),
    payerProviderId: text("payer_provider_id"),
    effectiveDate: date("effective_date"),
    submittedOn: date("submitted_on"),
    nextFollowUp: date("next_follow_up"),
    assignedToId: uuid("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
    invoiceStatus: invoiceStatus("invoice_status").notNull().default("not_billable"),
    invoicedOn: date("invoiced_on"),
    dependsOnId: uuid("depends_on_id").references((): AnyPgColumn => enrollments.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    index("enrollments_practice_idx").on(t.practiceId),
    index("enrollments_provider_idx").on(t.providerId),
    index("enrollments_follow_up_idx").on(t.nextFollowUp),
    index("enrollments_status_idx").on(t.status),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    occurredOn: date("occurred_on").notNull(),
    kind: text("kind").notNull().default("note"), // note | call | submitted | email | status | import
    note: text("note").notNull(),
    refNumber: text("ref_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("activities_enrollment_idx").on(t.enrollmentId)],
);

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    type: credentialType("type").notNull(),
    number: text("number"),
    state: text("state"),
    issuer: text("issuer"), // licensing board, certifying board, or malpractice carrier
    coverage: text("coverage"), // malpractice limits, e.g. "$1M / $3M"
    issuedOn: date("issued_on"),
    expiresOn: date("expires_on"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("credentials_expires_idx").on(t.expiresOn)],
);

export const portalLogins = pgTable("portal_logins", {
  id: uuid("id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id").references(() => practices.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id").references(() => providers.id, { onDelete: "cascade" }),
  portal: text("portal").notNull(), // CAQH, PECOS, Availity, ...
  url: text("url"),
  username: text("username"),
  passwordEnc: text("password_enc"),
  notes: text("notes"),
  ...timestamps,
});

/** Uploaded files (CV, license copies, W-9 …). Bytes live encrypted in storage (lib/storage.ts), never in the DB. */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerId: uuid("provider_id").references(() => providers.id, { onDelete: "cascade" }),
    practiceId: uuid("practice_id").references(() => practices.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // see DOCUMENT_CATEGORIES in lib/labels.ts
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    sha256: text("sha256").notNull(),
    expiresOn: date("expires_on"),
    notes: text("notes"),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("documents_provider_idx").on(t.providerId), index("documents_practice_idx").on(t.practiceId)],
);

// ---------- bookkeeping ----------

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const imports = pgTable(
  "imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileName: text("file_name").notNull(),
    fileHash: text("file_hash").notNull(),
    importedById: uuid("imported_by_id").references(() => users.id, { onDelete: "set null" }),
    summary: jsonb("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("imports_hash_idx").on(t.fileHash)],
);

export type EnrollmentStatus = (typeof enrollmentStatus.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];
export type CredentialType = (typeof credentialType.enumValues)[number];
export type HistoryKind = (typeof historyKind.enumValues)[number];
