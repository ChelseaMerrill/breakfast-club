import Link from "next/link";
import type { ReactNode } from "react";
import { Card, PageTitle } from "@/components/bc";

/** Shared look for error and not-found pages (design style, no data access). */
export function Oops({
  title,
  message,
  reference,
  action,
}: {
  title: string;
  message: string;
  reference?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <PageTitle>{title}</PageTitle>
      <Card>
        <p>{message}</p>
        <div className="flex flex-wrap items-center gap-4">
          {action}
          <Link href="/">Back to Home →</Link>
        </div>
        {reference && (
          <p className="text-xs text-muted-foreground">
            If this keeps happening, tell Chelsea and mention reference <code>{reference}</code>.
          </p>
        )}
      </Card>
    </div>
  );
}
