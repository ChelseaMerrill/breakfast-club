import { Suspense } from "react";
import Link from "next/link";
import { Card, PageTitle } from "@/components/bc";
import { requireOrganizer } from "@/lib/dal";

// Placeholder for the organizer area; Thursdays (M2), Payments (M5) and Settings (M8) land here.
export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <PageTitle>Organizer</PageTitle>
      <Suspense>
        <OrganizerHome />
      </Suspense>
    </main>
  );
}

async function OrganizerHome() {
  const member = await requireOrganizer();
  return (
    <Card>
      <p className="font-bold">Hi, {member.name}</p>
      <p className="text-muted-foreground">
        Thursdays, Payments and Settings are coming in the next milestones.
      </p>
      <Link href="/">← Home</Link>
    </Card>
  );
}
