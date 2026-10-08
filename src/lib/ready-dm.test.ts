import { describe, expect, it } from "vitest";
import { readyDmRecipient, readyMessage } from "./ready-dm";

describe("readyDmRecipient", () => {
  it("DMs members who signed in with Slack", () => {
    expect(readyDmRecipient({ member: { slackUserId: "U03DAK21Y3H" } })).toBe("U03DAK21Y3H");
    expect(readyDmRecipient({ member: { slackUserId: "W012ABC" } })).toBe("W012ABC");
  });

  it("skips guests, seed members and anything that isn't a Slack user ID", () => {
    expect(readyDmRecipient({ member: null })).toBeNull();
    expect(readyDmRecipient({ member: { slackUserId: null } })).toBeNull();
    expect(readyDmRecipient({ member: { slackUserId: "SEED_JORDAN_REYES" } })).toBeNull();
    expect(readyDmRecipient({ member: { slackUserId: "C108STATE" } })).toBeNull();
  });
});

describe("readyMessage", () => {
  it("says what's ready and links to the kitchen queue", () => {
    const msg = readyMessage("Waffles (Blueberry)", {
      appUrl: "https://breakfast-club-nine.vercel.app/",
      eventId: "evt1",
    });
    expect(msg.text).toBe(
      ":fried_egg: Your breakfast is ready! Waffles (Blueberry) — come grab it from the kitchen.",
    );
    expect(JSON.stringify(msg.blocks)).toContain(
      "https://breakfast-club-nine.vercel.app/kitchen/evt1",
    );
  });

  it("works without APP_URL (no button) and without a summary", () => {
    const msg = readyMessage("", { eventId: "evt1" });
    expect(msg.text).toContain("Your order — come grab it");
    expect(msg.blocks).toHaveLength(1);
  });
});
