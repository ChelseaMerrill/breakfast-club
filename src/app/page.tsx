// Placeholder home (M0). The real Home screen — RSVP, menu, your order, my sponsorships — lands in M3–M6.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-7 px-4 py-8">
      <div className="flex items-center gap-5">
        <div className="h-4 flex-1 rounded-[10px] border-[3px] border-border bg-secondary" />
        <h1 className="font-heading text-4xl uppercase">This Thursday</h1>
        <div className="h-4 flex-1 rounded-[10px] border-[3px] border-border bg-secondary" />
      </div>

      <section className="flex flex-col gap-3 rounded-[18px] border-[3px] border-border bg-card p-6 shadow-chunky">
        <p className="font-heading text-3xl uppercase text-destructive">🥞 Breakfast Club</p>
        <p className="text-muted-foreground">
          Pancakes. Friends. Thursday. The app is being set up — menus, sponsors, RSVPs and orders
          are on their way.
        </p>
      </section>
    </main>
  );
}
