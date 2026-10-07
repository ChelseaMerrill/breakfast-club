import Link from "next/link";
import { Card, PageTitle } from "@/components/bc";

export function NoAccess() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <PageTitle>Organizers only</PageTitle>
      <Card>
        <p>This page is just for Chelsea. Everything you need is on Home and Schedule.</p>
        <Link href="/">Back to Home →</Link>
      </Card>
    </div>
  );
}
