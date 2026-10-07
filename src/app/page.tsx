import { Suspense } from "react";
import Link from "next/link";
import { signOut } from "@/auth";
import { Card, PageTitle } from "@/components/bc";
import { getCurrentMember } from "@/lib/dal";

const PROVIDER_LABEL = { google: "Google", slack: "Slack", "dev-login": "dev sign-in" } as const;

// Placeholder home. The real Home screen — RSVP, menu, your order, my sponsorships — lands in M3–M6.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <PageTitle>This Thursday</PageTitle>
      <Suspense fallback={<div className="h-10" />}>
        <Greeting />
      </Suspense>
      <Card>
        <p className="font-heading text-3xl text-destructive uppercase">🥞 Breakfast Club</p>
        <p className="text-muted-foreground">
          Pancakes. Friends. Thursday. Menus, sponsors, RSVPs and orders are on their way.
        </p>
      </Card>
    </main>
  );
}

async function Greeting() {
  const member = await getCurrentMember();
  const initials = member.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }

  return (
    <div className="flex items-center gap-3">
      {member.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Slack avatar URL
        <img src={member.image} alt="" className="size-10 rounded-full border-2 border-border" />
      ) : (
        <div className="flex size-10 items-center justify-center rounded-full bg-secondary font-bold">
          {initials}
        </div>
      )}
      <div className="flex-1">
        <p className="font-bold">Hi, {member.name.split(" ")[0]}</p>
        <p className="text-xs text-muted-foreground">
          Signed in with {PROVIDER_LABEL[member.provider]}
          {member.isOrganizer && (
            <>
              {" · "}
              <Link href="/admin">Organizer area →</Link>
            </>
          )}
        </p>
      </div>
      <form action={doSignOut}>
        <button type="submit" className="cursor-pointer text-sm font-semibold text-destructive">
          Sign out
        </button>
      </form>
    </div>
  );
}
