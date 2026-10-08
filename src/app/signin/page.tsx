import { connection } from "next/server";
import { Suspense } from "react";
import { signIn, slackEnabled } from "@/auth";
import { PageTitle, PillButton } from "@/components/bc";
import { db } from "@/lib/db";

const ERRORS: Record<string, string> = {
  NotInChannel:
    "Breakfast Club is for members of #108state. Ask to be added to the channel, then try again.",
  AccessDenied: "That account can't sign in. Ask Chelsea to add your breakfast order by name.",
};

/** Only same-site paths, so the callback can't bounce people to another site. */
function safeCallback(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <main className="mx-auto w-full max-w-[420px] flex-1 px-4 py-8">
      <PageTitle>Welcome</PageTitle>
      <div className="mt-10 flex flex-col items-center gap-5 text-center">
        <p className="font-heading text-[34px] leading-tight uppercase">
          Pancakes. Friends. Thursday.
        </p>
        <p className="text-muted-foreground">
          Menu, sponsors, RSVPs and orders for every Thursday. Sign in with your Jahnel Group Slack
          account.
        </p>
        <Suspense>
          <SignInOptions searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function SignInOptions({ searchParams }: Pick<PageProps<"/signin">, "searchParams">) {
  const params = await searchParams;
  const redirectTo = safeCallback(params.callbackUrl);
  const error = typeof params.error === "string" ? params.error : undefined;
  async function slackSignIn() {
    "use server";
    await signIn("slack", { redirectTo });
  }

  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-[14px] border-2 border-destructive bg-card px-4 py-3 text-sm text-destructive"
        >
          {ERRORS[error] ?? "Something went wrong signing in. Please try again."}
        </p>
      )}
      <form action={slackSignIn}>
        <PillButton type="submit" disabled={!slackEnabled}>
          Sign in with Slack
        </PillButton>
      </form>
      <p className="text-xs text-[var(--bc-brown-faint)]">
        {slackEnabled
          ? "Your name and avatar are pulled from Slack. No password needed."
          : "Slack sign-in isn't set up yet (AUTH_SLACK_ID / AUTH_SLACK_SECRET)."}
      </p>
      {process.env.NODE_ENV === "development" && <DevPicker redirectTo={redirectTo} />}
    </>
  );
}

/** Local dev only (decision #32): sign in as a seed member. */
async function DevPicker({ redirectTo }: { redirectTo: string }) {
  await connection(); // DB read happens at request time, not while prerendering
  const members = await db.member.findMany({
    where: { slackUserId: { startsWith: "SEED_" } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true },
  });

  async function devSignIn(formData: FormData) {
    "use server";
    await signIn("dev-login", { memberId: formData.get("memberId"), redirectTo });
  }

  return (
    <section className="mt-6 w-full rounded-[18px] border-[3px] border-dashed border-border bg-card p-5 text-left">
      <p className="text-xs font-bold uppercase text-muted-foreground">Dev only · Sign in as…</p>
      {members.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">No seed members. Run npm run db:seed.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {members.map((m) => (
          <form key={m.id} action={devSignIn}>
            <input type="hidden" name="memberId" value={m.id} />
            <button
              type="submit"
              className="cursor-pointer rounded-full border-2 border-border px-3.5 py-1.5 text-[13px] hover:bg-primary"
            >
              {m.name}
              {m.role === "ORGANIZER" && " (organizer)"}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
