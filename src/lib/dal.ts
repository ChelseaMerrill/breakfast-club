import "server-only";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";

// Data Access Layer: the server-side source of truth for "who is signed in".
// Call these from Server Components (behind <Suspense>) and at the top of every server action.

export type CurrentMember = {
  id: string;
  name: string;
  image: string | null;
  isOrganizer: boolean;
  provider: "google" | "slack" | "dev-login";
};

export async function getCurrentMember(): Promise<CurrentMember> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const { id, name, image, role, provider } = session.user;
  return {
    id,
    name: name ?? "Member",
    image: image ?? null,
    isOrganizer: role === "ORGANIZER",
    provider,
  };
}

export async function requireOrganizer(): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member.isOrganizer) forbidden();
  return member;
}
