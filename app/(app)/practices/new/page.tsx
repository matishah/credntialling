import { requireUser, can } from "@/lib/auth";
import { Card, NoAccess, PageHeader } from "@/components/ui";
import { PracticeForm } from "@/components/forms";

export const metadata = { title: "New practice" };

export default async function NewPracticePage() {
  const user = await requireUser();
  if (!can(user, "practices.edit")) return <NoAccess />;
  return (
    <>
      <PageHeader title="New practice" crumbs={[{ href: "/practices", label: "Practices" }]} />
      <Card className="max-w-3xl p-5">
        <PracticeForm />
      </Card>
    </>
  );
}
