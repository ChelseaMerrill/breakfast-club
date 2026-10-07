import { NoAccess } from "@/components/no-access";

// Rendered when a page or action calls forbidden() (see src/lib/dal.ts).
export default function Forbidden() {
  return (
    <main className="flex-1 px-4 py-8">
      <NoAccess />
    </main>
  );
}
