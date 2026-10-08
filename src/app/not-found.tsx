import { Oops } from "@/components/oops";

export default function NotFound() {
  return (
    <main className="flex-1 px-4 py-8">
      <Oops
        title="Not found"
        message="We couldn't find that page. It may be an old link to a Thursday that's gone."
      />
    </main>
  );
}
