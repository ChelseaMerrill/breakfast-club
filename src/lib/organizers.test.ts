import { describe, expect, it } from "vitest";
import { isOrganizer } from "./organizers";

describe("isOrganizer", () => {
  it("matches only the Slack IDs listed in ORGANIZER_SLACK_IDS", () => {
    expect(isOrganizer("U_CHELSEA", " U_CHELSEA ,U_OTHER")).toBe(true);
    expect(isOrganizer("U_OTHER", "U_CHELSEA,U_OTHER")).toBe(true);
    expect(isOrganizer("U_JORDAN", "U_CHELSEA")).toBe(false);
  });

  it("is case-sensitive, like Slack user IDs", () => {
    expect(isOrganizer("u_chelsea", "U_CHELSEA")).toBe(false);
  });

  it("is false with nothing configured or no ID", () => {
    expect(isOrganizer("U_CHELSEA", "")).toBe(false);
    expect(isOrganizer("U_CHELSEA", ",")).toBe(false);
    expect(isOrganizer(null, "U_CHELSEA")).toBe(false);
    expect(isOrganizer(undefined, "U_CHELSEA")).toBe(false);
  });
});
