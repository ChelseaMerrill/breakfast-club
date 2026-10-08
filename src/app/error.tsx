"use client";

import { useEffect } from "react";
import { PillButton } from "@/components/bc";
import { Oops } from "@/components/oops";

// Errors outside the signed-in pages, or in their shared layout (e.g. the database is down).
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 px-4 py-8">
      <Oops
        title="Oops"
        message="Breakfast Club couldn't load right now. Give it a moment and try again."
        reference={error.digest}
        action={
          <PillButton type="button" onClick={() => retry()} className="px-6 py-2.5 text-[13px]">
            Try again
          </PillButton>
        }
      />
    </main>
  );
}
