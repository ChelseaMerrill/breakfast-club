import { Suspense } from "react";
import { Mascots } from "@/components/mascots";
import { NavLinks } from "@/components/nav-links";
import { getCurrentMember } from "@/lib/dal";

// Shell for every signed-in page: the design's left nav + main column.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <Suspense fallback={<div className="hidden md:block md:w-[232px] md:flex-none" />}>
        <AppNav />
      </Suspense>
      <main className="relative isolate min-w-0 flex-1 px-4 pt-8 pb-20 md:px-[clamp(16px,calc((100vw-232px)*0.11),160px)]">
        <Mascots />
        {children}
      </main>
    </div>
  );
}

async function AppNav() {
  const member = await getCurrentMember();
  return <NavLinks name={member.name} isOrganizer={member.isOrganizer} />;
}
