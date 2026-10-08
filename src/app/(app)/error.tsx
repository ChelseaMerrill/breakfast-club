"use client";

import { useEffect } from "react";
import { PillButton } from "@/components/bc";
import { Oops } from "@/components/oops";

// Errors inside a signed-in page: the nav stays, the page shows this instead.
export default function AppError({
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
    <Oops
      title="Oops"
      message="Something went wrong loading this page. It's usually a hiccup — try again."
      reference={error.digest}
      action={
        <PillButton type="button" onClick={() => retry()} className="px-6 py-2.5 text-[13px]">
          Try again
        </PillButton>
      }
    />
  );
}
