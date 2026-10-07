import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Slack from "next-auth/providers/slack";
import { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { isOrganizer } from "@/lib/organizers";
import { channelMembership, needsChannelRecheck } from "@/lib/slack-channel";

// Local-dev-only "Sign in as…" picker (decision #32). `next build` always runs with
// NODE_ENV=production, so this provider can't exist in a deployed app.
const devLoginEnabled = process.env.NODE_ENV === "development";

const roleFor = (slackUserId: string) => (isOrganizer(slackUserId) ? Role.ORGANIZER : Role.MEMBER);

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/signin", error: "/signin" },
  providers: [
    Slack, // AUTH_SLACK_ID / AUTH_SLACK_SECRET
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev-login",
            name: "Sign in as…",
            credentials: { memberId: {} },
            async authorize({ memberId }) {
              const member = await db.member.findUnique({ where: { id: String(memberId) } });
              if (!member?.slackUserId.startsWith("SEED_")) return null; // seed members only
              return {
                id: member.id,
                name: member.name,
                email: member.email,
                image: member.avatarUrl,
                slackUserId: member.slackUserId,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "slack") return true;
      const slackUserId = profile?.["https://slack.com/user_id"];
      if (typeof slackUserId === "string" && (await channelMembership.isMember(slackUserId))) {
        return true;
      }
      return "/signin?error=NotInChannel";
    },

    async jwt({ token, account, profile, user }) {
      // First call after a successful sign-in.
      if (account?.provider === "slack" && profile) {
        const slackUserId = String(profile["https://slack.com/user_id"]);
        const role = roleFor(slackUserId);
        const fields = {
          name: String(profile.name ?? "Member"),
          email: typeof profile.email === "string" ? profile.email : null,
          avatarUrl: typeof profile.picture === "string" ? profile.picture : null,
          role,
        };
        const member = await db.member.upsert({
          where: { slackUserId },
          update: fields,
          create: { slackUserId, ...fields },
        });
        return {
          ...token,
          memberId: member.id,
          slackUserId,
          role,
          provider: "slack",
          channelCheckedAt: Date.now(),
        };
      }
      if (account?.provider === "dev-login" && user?.id && user.slackUserId) {
        return {
          ...token,
          memberId: user.id,
          slackUserId: user.slackUserId,
          role: roleFor(user.slackUserId),
          provider: "dev-login",
        };
      }

      // Every later session read.
      if (token.provider === "dev-login" && !devLoginEnabled) return null;
      if (token.provider === "slack" && needsChannelRecheck(token.channelCheckedAt)) {
        if (!(await channelMembership.isMember(token.slackUserId))) return null; // signs them out
        return {
          ...token,
          role: roleFor(token.slackUserId),
          channelCheckedAt: Date.now(),
        };
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.memberId;
      session.user.slackUserId = token.slackUserId;
      session.user.role = token.role;
      return session;
    },
  },
});
