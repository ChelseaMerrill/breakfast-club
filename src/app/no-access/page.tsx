import { NoAccess } from "@/components/no-access";

// Target of the 403 rewrite in src/proxy.ts.
export default function NoAccessPage() {
  return <NoAccess />;
}
