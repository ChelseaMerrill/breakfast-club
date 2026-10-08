import { Suspense } from "react";
import { Mascots } from "@/components/mascots";
import { NavLinks } from "@/components/nav-links";
import { getCurrentMember } from "@/lib/dal";
import { currentThursdayId } from "@/lib/kitchen";

// Shell for every signed-in page: the design's left nav + main column.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <Suspense fallback={<div className="hidden md:block md:w-[232px] md:flex-none" />}>
        <AppNav />
      </Suspense>
      <main className="relative isolate min-w-0 flex-1 px-4 pt-8 pb-20 md:px-[clamp(16px,calc((100vw-232px)*0.11),160px)]">
        <Suspense>
          <Mascots />
        </Suspense>
        {children}
      </main>
    </div>
  );
}

async function AppNav() {
  // Session first: it makes this request-time, so the date lookup isn't prerendered.
  const member = await getCurrentMember();
  const thursdayId = await currentThursdayId();
  return <NavLinks name={member.name} isOrganizer={member.isOrganizer} thursdayId={thursdayId} />;
}
