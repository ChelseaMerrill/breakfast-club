import { Suspense } from "react";
import Link from "next/link";
import { Card, PageTitle } from "@/components/bc";
import { requireOrganizer } from "@/lib/dal";

// Placeholder for the organizer area; Thursdays (M2), Payments (M5) and Settings (M8) land here.
export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <PageTitle>Organizer</PageTitle>
      <Suspense>
        <OrganizerHome />
      </Suspense>
    </div>
  );
}

async function OrganizerHome() {
  const member = await requireOrganizer();
  return (
    <Card>
      <p className="font-bold">Hi, {member.name}</p>
      <p className="text-muted-foreground">
        Manage Thursdays, Payments and Settings from the menu.
      </p>
      <Link href="/admin/events">Thursdays →</Link>
      <Link href="/admin/payments">Payments →</Link>
    </Card>
  );
}
