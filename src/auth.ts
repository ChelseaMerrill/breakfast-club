import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Slack from "next-auth/providers/slack";
import { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { isAllowedEmail, isOrganizer, type Identity } from "@/lib/organizers";
import { channelMembership, needsChannelRecheck } from "@/lib/slack-channel";

// Sign-in (docs/open-questions.md #41): Google SSO for now; Slack turns on once
// AUTH_SLACK_ID / AUTH_SLACK_SECRET exist.
export const slackEnabled = Boolean(process.env.AUTH_SLACK_ID && process.env.AUTH_SLACK_SECRET);

// Local-dev-only "Sign in as…" picker (decision #32). `next build` always runs with
// NODE_ENV=production, so this provider can't exist in a deployed app.
const devLoginEnabled = process.env.NODE_ENV === "development";

const roleFor = (who: Identity) => (isOrganizer(who) ? Role.ORGANIZER : Role.MEMBER);

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/signin", error: "/signin" },
  providers: [
    // AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET. `hd` only pre-selects the work account;
    // the domain is enforced in the signIn callback.
    Google({ authorization: { params: { hd: "jahnelgroup.com", prompt: "select_account" } } }),
    ...(slackEnabled ? [Slack] : []),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev-login",
            name: "Sign in as…",
            credentials: { memberId: {} },
            async authorize({ memberId }) {
              const member = await db.member.findUnique({ where: { id: String(memberId) } });
              if (!member?.slackUserId?.startsWith("SEED_")) return null; // seed members only
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
      if (account?.provider === "google") {
        return isAllowedEmail(profile?.email, profile?.email_verified as boolean | undefined)
          ? true
          : "/signin?error=NotAllowedDomain";
      }
      if (account?.provider === "slack") {
        const slackUserId = profile?.["https://slack.com/user_id"];
        if (typeof slackUserId === "string" && (await channelMembership.isMember(slackUserId))) {
          return true;
        }
        return "/signin?error=NotInChannel";
      }
      return account?.provider === "dev-login";
    },

    async jwt({ token, account, profile, user }) {
      // First call after a successful sign-in.
      if (account?.provider === "google" && profile?.email) {
        const email = profile.email.toLowerCase();
        const fields = {
          name: String(profile.name ?? email),
          avatarUrl: typeof profile.picture === "string" ? profile.picture : null,
          role: roleFor({ email }),
        };
        const member = await db.member.upsert({
          where: { email },
          update: fields,
          create: { email, ...fields },
        });
        return { ...token, memberId: member.id, email, provider: "google" };
      }
      if (account?.provider === "slack" && profile) {
        const slackUserId = String(profile["https://slack.com/user_id"]);
        const email = typeof profile.email === "string" ? profile.email.toLowerCase() : null;
        const fields = {
          name: String(profile.name ?? "Member"),
          email,
          avatarUrl: typeof profile.picture === "string" ? profile.picture : null,
          role: roleFor({ email, slackUserId }),
        };
        const member = await db.member.upsert({
          where: { slackUserId },
          update: fields,
          create: { slackUserId, ...fields },
        });
        return {
          ...token,
          memberId: member.id,
          email,
          slackUserId,
          provider: "slack",
          channelCheckedAt: Date.now(),
        };
      }
      if (account?.provider === "dev-login" && user?.id && user.slackUserId) {
        return {
          ...token,
          memberId: user.id,
          slackUserId: user.slackUserId,
          provider: "dev-login",
        };
      }

      // Every later session read.
      if (token.provider === "dev-login" && !devLoginEnabled) return null;
      if (token.provider === "slack" && needsChannelRecheck(token.channelCheckedAt)) {
        if (!token.slackUserId || !(await channelMembership.isMember(token.slackUserId))) {
          return null; // left #108state: signs them out
        }
        token.channelCheckedAt = Date.now();
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.memberId;
      // Organizer status is read from env on every request, so editing
      // ORGANIZER_EMAILS / ORGANIZER_SLACK_IDS takes effect immediately.
      session.user.role = roleFor({ email: token.email, slackUserId: token.slackUserId });
      session.user.provider = token.provider;
      return session;
    },
  },
});
