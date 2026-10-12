import { requireUser, can } from "@/lib/auth";
import { listPractices } from "@/lib/queries";
import { NoAccess, PageHeader } from "@/components/ui";
import { OnboardProviderForm } from "@/components/onboard-form";

export const metadata = { title: "Onboard provider" };

export default async function OnboardProviderPage(props: PageProps<"/providers/new">) {
  const user = await requireUser();
  if (!can(user, "practices.edit")) return <NoAccess />;
  const sp = await props.searchParams;
  const practiceId = typeof sp.practiceId === "string" ? sp.practiceId : undefined;
  const practices = await listPractices(user);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        crumbs={[{ href: "/providers", label: "Providers" }]}
        title="Onboard a provider"
        subtitle="Everything for one provider's credentialing file in one place. Only the practice and name are required – fill in the rest now or later from their page."
      />
      <OnboardProviderForm
        practices={practices.map((p) => ({ id: p.id, name: p.name }))}
        practiceId={practices.some((p) => p.id === practiceId) ? practiceId : undefined}
        canSeeSensitive={can(user, "sensitive.view")}
        canEditLogins={can(user, "logins.edit")}
        canUploadDocs={can(user, "documents.manage")}
      />
    </div>
  );
}
