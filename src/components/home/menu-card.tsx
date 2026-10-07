import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/bc";
import { getCurrentMember } from "@/lib/dal";
import { sponsorSummary } from "@/lib/sponsorship-display";
import { getHomeMenu } from "@/lib/sponsorships";
import { cn } from "@/lib/utils";

/** Home *Menu* card: this Thursday's item and who's sponsoring it (design: Home → Menu). */
export function MenuCard() {
  return (
    <Card className="gap-3 p-[22px]" aria-labelledby="home-menu-title">
      <div className="flex items-baseline justify-between">
        <h2 id="home-menu-title" className="text-lg font-bold">
          Menu
        </h2>
        <Link href="/schedule" className="text-[13px]">
          Sponsor an item →
        </Link>
      </div>
      <Suspense fallback={<div className="h-6" />}>
        <MenuRow />
      </Suspense>
    </Card>
  );
}

async function MenuRow() {
  await getCurrentMember();
  const menu = await getHomeMenu();
  const row = "flex justify-between gap-3 border-t border-border/20 pt-2.5 text-sm";

  if (!menu) return <p className={cn(row, "text-muted-foreground")}>No Thursdays scheduled.</p>;
  const { event, item, amountCents } = menu;
  if (event.status === "SKIPPED")
    return (
      <p className={cn(row, "text-muted-foreground")}>
        No breakfast: {event.skipReason ?? "Holiday"}
      </p>
    );
  if (!item) return <p className={cn(row, "text-muted-foreground")}>No menu yet</p>;

  const sponsors = sponsorSummary(item.sponsorships, event.sponsorsNeeded, amountCents);
  return (
    <div className={row}>
      <span className="font-bold">{item.name}</span>
      <span
        className={cn(
          "text-right",
          sponsors.fullySponsored ? "text-foreground" : "text-destructive",
        )}
      >
        {sponsors.text}
      </span>
    </div>
  );
}
