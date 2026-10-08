import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Card, PageTitle } from "@/components/bc";
import { getCurrentMember } from "@/lib/dal";
import { PAYMENT_METHODS, VENMO_HANDLE, VENMO_URL } from "@/lib/payment-info";

// App Guide: how to use Breakfast Club (linked at the bottom of the nav). Everything is static
// except the organizer section, which only Chelsea sees.

const WEEK = [
  { when: "Tuesday 10–11am", what: "A reminder posts in #108state with the menu and sponsors." },
  { when: "By Wednesday 5pm", what: "RSVP I'm in or Not this week." },
  { when: "Thursday morning", what: "Chelsea opens ordering. Place your order." },
  { when: "When it's ready", what: "Slack messages you. Grab your breakfast." },
];

const STAGES = [
  { label: "Placed", color: "var(--bc-placed)" },
  { label: "Cooking", color: "var(--bc-cooking)" },
  { label: "Ready", color: "var(--bc-ready)" },
  { label: "Picked up", color: "var(--bc-picked-up)" },
];

const FAQ = [
  {
    q: "I didn't RSVP. Can I still eat?",
    a: "Yes. While ordering is open you can order as a walk-in, and you'll be counted.",
  },
  {
    q: "I'm bringing a client or a guest.",
    a: "Tell Chelsea. She adds their order by name in the kitchen queue, so they don't need an account.",
  },
  {
    q: "Why can't someone sign in?",
    a: "Only members of #108state can sign in. Ask to be added to the channel, then try again.",
  },
  {
    q: "How do I pay for a sponsorship?",
    a: `Each sponsor gives Chelsea $30, by ${PAYMENT_METHODS}. She marks it paid, and you'll see Paid ✓. Payment status is only visible to you and Chelsea; it's never posted in Slack.`,
  },
  {
    q: 'I didn\'t get the "ready" message.',
    a: "Check the Breakfast Club app's Messages tab in Slack. Your order status on Home and the kitchen queue updates either way.",
  },
];

export default function GuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <PageTitle>App guide</PageTitle>
      <p className="text-center text-muted-foreground">
        Everything for Thursday breakfast lives here: who&apos;s coming, who&apos;s sponsoring, and
        your order. Here&apos;s how to use it.
      </p>

      <Card aria-labelledby="week-title">
        <h2 id="week-title" className="font-heading text-2xl uppercase">
          The week at a glance
        </h2>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {WEEK.map((w) => (
            <li
              key={w.when}
              className="grid content-start gap-1 rounded-[14px] border-2 border-border bg-white px-3.5 py-3"
            >
              <span className="font-heading text-[15px] text-destructive uppercase">{w.when}</span>
              <span className="text-sm leading-snug">{w.what}</span>
            </li>
          ))}
        </ol>
      </Card>

      <ol className="flex flex-col gap-[18px]" aria-label="How to use Breakfast Club">
        <Step n={1} title="Sign in with Slack">
          <p>
            Press <Pill>Sign in with Slack</Pill>. Your name and photo come from Slack, so
            there&apos;s no password.
          </p>
          <Note>
            Anyone in <b>#108state</b> can sign in. If it says you need to be in #108state, join the
            channel and try again.
          </Note>
        </Step>

        <Step n={2} title="RSVP on Home">
          <Bullets>
            <li>
              <GuideLink href="/">Home</GuideLink> shows this Thursday: the menu, how many people
              are coming, and who&apos;s in and out.
            </li>
            <li>
              Tap <Pill plain>I&apos;m in</Pill> or <Pill plain>Not this week</Pill>. You can change
              it until <b>Wednesday 5pm ET</b>.
            </li>
            <li>
              After the deadline the buttons lock. Missed it? You can still order on Thursday as a
              walk-in.
            </li>
          </Bullets>
          <Note>
            If a week is skipped (a holiday, say), Home tells you and shows the next breakfast
            instead.
          </Note>
        </Step>

        <Step n={3} title="Sponsor a breakfast (optional)">
          <Bullets>
            <li>
              Each Thursday has one menu item. On <GuideLink href="/schedule">Schedule</GuideLink>{" "}
              (or <i>Sponsor an item</i> on Home), press <Pill>Sponsor this</Pill>.
            </li>
            <li>
              Confirm, and your name goes next to the item. If someone else wants to chip in, they
              press <Pill>Sponsor this</Pill> too.
            </li>
            <li>
              <b>Each sponsor gives Chelsea $30.</b> One sponsor gives $30; if two people sponsor
              the same Thursday, each gives $30.
            </li>
            <li>
              Pay with <b>cash</b> or <b>Venmo</b>{" "}
              <a
                href={VENMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-destructive underline underline-offset-2"
              >
                {VENMO_HANDLE}
              </a>
              . The app only keeps track.
            </li>
            <li>
              <b>My sponsorships</b> on Home shows <i>$30 due</i> or <i>Paid ✓</i>. You can remove
              yours until it&apos;s paid.
            </li>
          </Bullets>
        </Step>

        <Step n={4} title="Order on Thursday morning">
          <Bullets>
            <li>
              Once Chelsea opens ordering, Home shows <Pill>Place your order</Pill> (it&apos;s also{" "}
              <i>Place order</i> in the menu).
            </li>
            <li>
              Tap the item, then use <b>Customize</b> for anything you want changed, like egg style
              or no cheese.
            </li>
            <li>
              Press <Pill>Submit order</Pill>. You&apos;ll land on the <b>Kitchen queue</b>.
            </li>
            <li>
              Need a change? Use <i>Change</i> on Home&apos;s <b>Your order</b> card, or cancel, as
              long as it hasn&apos;t started cooking.
            </li>
          </Bullets>
          <Note>
            Some weeks (bagels, for example) are RSVP only, so there&apos;s nothing to order.
          </Note>
        </Step>

        <Step n={5} title="Watch the kitchen queue and pick up">
          <p>
            The <b>Kitchen queue</b> shows every order moving along:
          </p>
          <p
            className="flex flex-wrap items-center gap-1.5 text-sm font-semibold"
            aria-label="Order stages: Placed, Cooking, Ready, Picked up"
          >
            {STAGES.map((s, i) => (
              <span key={s.label} className="contents">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <span
                  className="rounded-[10px] border-2 border-l-8 border-border bg-white px-2.5 py-0.5"
                  style={{ borderLeftColor: s.color }}
                >
                  {s.label}
                </span>
              </span>
            ))}
          </p>
          <p>
            When yours reaches <b>Ready</b>, the Breakfast Club app sends you a Slack message. Your
            status also shows on Home.
          </p>
        </Step>
      </ol>

      <Card aria-labelledby="faq-title">
        <h2 id="faq-title" className="font-heading text-2xl uppercase">
          Questions
        </h2>
        <div className="flex flex-col gap-3">
          {FAQ.map((f, i) => (
            <details
              key={f.q}
              className={i > 0 ? "border-t-2 border-dashed border-[var(--bc-dot)] pt-3" : ""}
            >
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-1.5 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </Card>

      <Suspense>
        <OrganizerGuide />
      </Suspense>

      <p className="text-center text-sm text-muted-foreground">
        Questions or ideas for the app? Ask Chelsea in #108state.
      </p>
    </div>
  );
}

async function OrganizerGuide() {
  const member = await getCurrentMember();
  if (!member.isOrganizer) return null;
  const items = [
    {
      href: "/admin/events",
      title: "Thursdays",
      text: "The next 8 weeks are created for you. Skip a week (with a reason) or Restore it, switch Ordering enabled off for RSVP-only weeks, and + Add next Thursday to plan further ahead.",
    },
    {
      href: "/schedule",
      title: "Schedule",
      text: "Type each week's menu item, set how many sponsors it needs with − / + (each sponsor gives $30), add a sponsor by name for someone who can't sign in, or remove one with ×.",
    },
    {
      href: null,
      title: "Kitchen queue",
      text: "Open ordering in the morning. Tap a card to move it along; ← Back undoes, Cancel drops a Placed order. Add guests and walk-ins with + Walk-in, Delete picked-up orders, and Close ordering when you're done. Anything left open closes at midnight.",
    },
    {
      href: "/admin/payments",
      title: "Payments",
      text: "Tick Paid as sponsors pay you. Filter by Unpaid, This week or All, and see what's collected and outstanding.",
    },
    {
      href: "/admin/settings",
      title: "Settings",
      text: "Change the sponsorship amount and RSVP deadline, turn the weekly reminder on or off, and press Send test reminder to preview it in #108state.",
    },
  ];
  return (
    <section
      aria-labelledby="org-title"
      className="flex flex-col gap-3.5 rounded-[18px] border-[3px] border-border bg-foreground p-6 text-background shadow-[4px_4px_0_var(--bc-red)]"
    >
      <h2 id="org-title" className="font-heading text-2xl uppercase">
        For Chelsea: running Thursday
      </h2>
      <p className="text-[#f3e3bd]">These pages only appear for the organizer.</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
        {items.map((it) => (
          <div
            key={it.title}
            className="grid min-w-0 content-start gap-1.5 rounded-[14px] border-2 border-[#8a6a55] p-3.5"
          >
            <h3 className="font-heading text-base text-primary uppercase">
              {it.href ? (
                <Link href={it.href} className="text-primary hover:text-background">
                  {it.title}
                </Link>
              ) : (
                it.title
              )}
            </h3>
            <p className="text-[15px] leading-normal text-[#f3e3bd]">{it.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[48px_1fr] sm:gap-4">
      <span
        aria-hidden
        className="grid size-10 place-items-center rounded-full border-[3px] border-border bg-primary font-heading text-lg sm:size-12 sm:text-xl"
      >
        {n}
      </span>
      <Card className="gap-2.5 px-5 py-[18px]">
        <h2 className="font-heading text-lg uppercase">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        {children}
      </Card>
    </li>
  );
}

function GuideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-destructive underline underline-offset-2">
      {children}
    </Link>
  );
}

function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="ml-5 flex list-disc flex-col gap-1.5 marker:text-destructive">{children}</ul>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-[15px] text-muted-foreground">{children}</p>;
}

function Pill({ children, plain = false }: { children: ReactNode; plain?: boolean }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-border px-2.5 text-[13px] font-bold whitespace-nowrap uppercase ${plain ? "bg-white" : "bg-primary"}`}
    >
      {children}
    </span>
  );
}
