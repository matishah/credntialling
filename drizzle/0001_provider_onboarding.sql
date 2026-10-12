CREATE TYPE "public"."history_kind" AS ENUM('education', 'training', 'affiliation', 'work');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid,
	"practice_id" uuid,
	"category" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"expires_on" date,
	"notes" text,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "provider_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"kind" "history_kind" NOT NULL,
	"institution" text NOT NULL,
	"detail" text,
	"location" text,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "issuer" text;--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "coverage" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "degree" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "other_names" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "place_of_birth" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "citizenship" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "languages" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "pecos_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_history" ADD CONSTRAINT "provider_history_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_provider_idx" ON "documents" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "documents_practice_idx" ON "documents" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "provider_history_provider_idx" ON "provider_history" USING btree ("provider_id");--> statement-breakpoint
-- New permission for uploading/deleting documents: grant it to the roles that do credentialing work.
UPDATE "roles" SET "permissions" = "permissions" || '["documents.manage"]'::jsonb WHERE "name" IN ('Admin', 'Credentialing Manager', 'Credentialing Specialist') AND NOT ("permissions" ? 'documents.manage');
