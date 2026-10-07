import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    slackUserId?: string;
  }
  interface Session {
    user: {
      id: string;
      slackUserId: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

// next-auth/jwt only re-exports this; augment the source module.
declare module "@auth/core/jwt" {
  interface JWT {
    memberId: string;
    slackUserId: string;
    role: Role;
    provider: "slack" | "dev-login";
    channelCheckedAt?: number;
  }
}
