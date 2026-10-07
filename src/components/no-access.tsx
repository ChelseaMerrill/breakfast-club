import Link from "next/link";
import { Card, PageTitle } from "@/components/bc";

export function NoAccess() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <PageTitle>Organizers only</PageTitle>
      <Card>
        <p>This page is just for Chelsea. Everything you need is on Home and Schedule.</p>
        <Link href="/">Back to Home →</Link>
      </Card>
    </main>
  );
}
