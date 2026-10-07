// Small building blocks matching design/Breakfast Club.dc.html.
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Big uppercase title flanked by mint bars ("WELCOME", "THIS THURSDAY"…). */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-7 flex items-center gap-5">
      <div className="h-4 flex-1 rounded-[10px] border-[3px] border-border bg-secondary" />
      <h1 className="text-center font-heading text-4xl uppercase">{children}</h1>
      <div className="h-4 flex-1 rounded-[10px] border-[3px] border-border bg-secondary" />
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-[18px] border-[3px] border-border bg-card p-6 shadow-chunky",
        className,
      )}
      {...props}
    />
  );
}

const pill =
  "inline-flex cursor-pointer items-center justify-center rounded-full border-[3px] border-border px-7 py-3.5 text-[15px] font-bold uppercase shadow-chunky-sm transition-transform active:translate-x-px active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

/** Yellow primary pill ("SIGN IN WITH SLACK", "PLACE YOUR ORDER"). */
export function PillButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button className={cn(pill, "bg-primary text-primary-foreground", className)} {...props} />
  );
}

/** Mint secondary pill ("ADD"). */
export function MintButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button className={cn(pill, "bg-secondary text-secondary-foreground", className)} {...props} />
  );
}
