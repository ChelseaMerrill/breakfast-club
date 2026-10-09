import { describe, expect, it } from "vitest";
import { defaultOrderingMessage, escapeSlackText, orderingOpenMessage } from "./ordering-post";

describe("defaultOrderingMessage", () => {
  it("mentions the day's item and Customize", () => {
    expect(defaultOrderingMessage("Waffles")).toBe(
      "Ordering is open! It's Waffles today. Place your order in Breakfast Club, and use Customize to tell me how you'd like it.",
    );
    expect(defaultOrderingMessage(null)).toContain("Customize");
  });
});

describe("orderingOpenMessage", () => {
  it("posts Chelsea's words with a Place your order button", () => {
    const msg = orderingOpenMessage(
      "  Eggs today! Scrambled or fried — say which in Customize.  ",
      {
        appUrl: "https://breakfast-club-nine.vercel.app/",
        eventId: "evt1",
      },
    );
    expect(msg.text).toBe(":pancakes: Eggs today! Scrambled or fried — say which in Customize.");
    const json = JSON.stringify(msg.blocks);
    expect(json).toContain("Place your order");
    expect(json).toContain("https://breakfast-club-nine.vercel.app/order/evt1");
  });

  it("escapes Slack markup so the text shows as typed", () => {
    expect(escapeSlackText("Ham & cheese <or> egg")).toBe("Ham &amp; cheese &lt;or&gt; egg");
    const msg = orderingOpenMessage("<!channel> eggs", { eventId: "e" });
    expect(JSON.stringify(msg.blocks)).not.toContain("<!channel>");
    expect(msg.text).not.toContain("<!channel>");
  });

  it("works without APP_URL (no button)", () => {
    expect(orderingOpenMessage("Hi", { eventId: "e" }).blocks).toHaveLength(1);
  });
});
