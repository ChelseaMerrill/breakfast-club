"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

// Left nav from the design; collapses to a hamburger menu on phones (decision #24).
// Items appear as their milestones land: Place order (M6), Kitchen view (M6),
// Payments (M5).
const MEMBER_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
];
const ORGANIZER_ITEMS = [
  { href: "/admin/events", label: "Thursdays" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/settings", label: "Settings" },
];

function Brand() {
  return (
    <div>
      <div className="font-heading text-2xl leading-none uppercase">🥞 Breakfast Club</div>
      <div className="mt-1 text-xs text-muted-foreground">Thursdays at 108 State</div>
    </div>
  );
}

export function NavLinks({ name, isOrganizer }: { name: string; isOrganizer: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = isOrganizer ? [...MEMBER_ITEMS, ...ORGANIZER_ITEMS] : MEMBER_ITEMS;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Phone top bar */}
      <div className="flex items-center justify-between border-b-4 border-border bg-card px-4 py-3 md:hidden">
        <Brand />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="app-nav"
          onClick={() => setOpen((o) => !o)}
          className="cursor-pointer rounded-full border-2 border-border px-3.5 py-1.5 text-sm font-bold"
        >
          {open ? "✕ Close" : "☰ Menu"}
        </button>
      </div>

      <nav
        id="app-nav"
        className={cn(
          "flex-col gap-1 bg-card py-5 md:sticky md:top-0 md:flex md:h-screen md:w-[232px] md:flex-none md:overflow-auto md:border-r-4 md:border-border",
          open ? "flex border-b-4 border-border" : "hidden",
        )}
      >
        <div className="hidden px-5 pb-3.5 md:block">
          <Brand />
        </div>
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "border-l-[3px] px-5 py-2.5 text-sm text-foreground no-underline hover:text-foreground",
                active
                  ? "border-primary bg-[rgb(255_198_41/50%)] font-bold text-destructive hover:text-destructive"
                  : "border-transparent font-light",
              )}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="mt-auto px-5 pt-6 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">{name}</div>
          <form action={signOutAction}>
            <button type="submit" className="cursor-pointer font-semibold text-destructive">
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
