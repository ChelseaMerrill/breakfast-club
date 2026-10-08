import { Suspense } from "react";
import Link from "next/link";
import { Card, PageTitle } from "@/components/bc";
import { MenuCard } from "@/components/home/menu-card";
import { MySponsorshipsCard } from "@/components/home/my-sponsorships-card";
import { ThisThursdayCard } from "@/components/home/this-thursday-card";
import { YourOrderCard } from "@/components/home/your-order-card";
import { getCurrentMember } from "@/lib/dal";

const PROVIDER_LABEL = { slack: "Slack", "dev-login": "dev sign-in" } as const;

// Home (design: "This Thursday"). Each card is its own component: RSVP & headcount (M3),
// menu + my sponsorships (M4), your order (M6).
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <PageTitle>This Thursday</PageTitle>
      <Suspense fallback={<div className="h-10" />}>
        <Greeting />
      </Suspense>
      <Suspense
        fallback={
          <Card>
            <p className="text-muted-foreground">Loading this Thursday…</p>
          </Card>
        }
      >
        <ThisThursday />
      </Suspense>
      <MenuCard />
      <Suspense>
        <YourOrderCard />
      </Suspense>
      <MySponsorshipsCard />
    </div>
  );
}

async function ThisThursday() {
  const member = await getCurrentMember();
  return <ThisThursdayCard member={member} />;
}

async function Greeting() {
  const member = await getCurrentMember();
  const initials = member.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
    </div>
  );
}
