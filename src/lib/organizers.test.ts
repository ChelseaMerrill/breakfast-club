import { describe, expect, it } from "vitest";
import { isAllowedEmail, isOrganizer } from "./organizers";

describe("isOrganizer", () => {
  const env = { ORGANIZER_EMAILS: " CMerrill@jahnelgroup.com ", ORGANIZER_SLACK_IDS: "U_CHELSEA" };

  it("matches organizer emails, ignoring case and spaces", () => {
    expect(isOrganizer({ email: "cmerrill@jahnelgroup.com" }, env)).toBe(true);
    expect(isOrganizer({ email: "jreyes@jahnelgroup.com" }, env)).toBe(false);
  });

  it("matches organizer Slack IDs", () => {
    expect(isOrganizer({ slackUserId: "U_CHELSEA" }, env)).toBe(true);
    expect(isOrganizer({ slackUserId: "U_JORDAN" }, env)).toBe(false);
  });

  it("is false with nothing configured", () => {
    expect(isOrganizer({ email: "cmerrill@jahnelgroup.com", slackUserId: "U1" }, {})).toBe(false);
    expect(isOrganizer({}, env)).toBe(false);
  });
});

describe("isAllowedEmail", () => {
  it("allows verified jahnelgroup.com addresses by default", () => {
    expect(isAllowedEmail("cmerrill@jahnelgroup.com", true, undefined)).toBe(true);
    expect(isAllowedEmail("CMerrill@JahnelGroup.com", true, undefined)).toBe(true);
  });

  it("refuses other domains, unverified emails and look-alikes", () => {
    expect(isAllowedEmail("someone@gmail.com", true, undefined)).toBe(false);
    expect(isAllowedEmail("cmerrill@jahnelgroup.com", false, undefined)).toBe(false);
    expect(isAllowedEmail("x@evil-jahnelgroup.com", true, undefined)).toBe(false);
    expect(isAllowedEmail("x@jahnelgroup.com.evil.io", true, undefined)).toBe(false);
    expect(isAllowedEmail(undefined, true, undefined)).toBe(false);
  });

  it("uses ALLOWED_EMAIL_DOMAINS when set", () => {
    expect(isAllowedEmail("a@client.com", true, "jahnelgroup.com, client.com")).toBe(true);
    expect(isAllowedEmail("a@jahnelgroup.com", true, "client.com")).toBe(false);
  });
});
