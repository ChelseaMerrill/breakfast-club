import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

type Provider = "slack" | "dev-login";

declare module "next-auth" {
  interface User {
    slackUserId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      provider: Provider;
    } & DefaultSession["user"];
  }
}

// next-auth/jwt only re-exports this; augment the source module.
declare module "@auth/core/jwt" {
  interface JWT {
    memberId: string;
    provider: Provider;
    slackUserId?: string | null;
    channelCheckedAt?: number;
  }
}
