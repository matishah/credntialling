// Permission catalogue. Roles are just named sets of these keys, editable by admins.
// Kept free of server-only imports so client components can render the labels.

export const PERMISSIONS = {
  "practices.view_all": "See every practice (otherwise only practices assigned to the user)",
  "practices.edit": "Create and edit practices and providers",
  "enrollments.edit": "Update enrollments, log follow-ups, change statuses",
  "sensitive.view": "Reveal SSN and date of birth",
  "logins.view": "Reveal portal passwords",
  "logins.edit": "Add and change portal logins",
  "documents.manage": "Upload and delete documents (viewing them needs sensitive.view)",
  "invoicing.manage": "Mark enrollments invoiced / paid",
  "payers.edit": "Edit the payer directory",
  "import.run": "Import spreadsheets",
  "users.manage": "Manage users, roles and practice assignments",
  "audit.view": "View the audit log",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const DEFAULT_ROLES: { name: string; description: string; permissions: Permission[] }[] = [
  {
    name: "Admin",
    description: "Full access",
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "Credentialing Manager",
    description: "Runs the department; sees all practices",
    permissions: [
      "practices.view_all",
      "practices.edit",
      "enrollments.edit",
      "sensitive.view",
      "logins.view",
      "logins.edit",
      "documents.manage",
      "invoicing.manage",
      "payers.edit",
      "import.run",
    ],
  },
  {
    name: "Credentialing Specialist",
    description: "Works the practices assigned to them",
    permissions: ["enrollments.edit", "logins.view", "sensitive.view", "documents.manage"],
  },
  {
    name: "Billing",
    description: "Sees all practices, handles invoicing only",
    permissions: ["practices.view_all", "invoicing.manage"],
  },
  {
    name: "Viewer",
    description: "Read-only access to assigned practices",
    permissions: [],
  },
];
