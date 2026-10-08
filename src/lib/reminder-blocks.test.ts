import { describe, expect, it } from "vitest";
import { TEST_REMINDER_NOTE, reminderPayload } from "./reminder-blocks";
import { buildReminder, reminderMrkdwn } from "./reminder-message";

const msg = buildReminder({
  date: new Date("2026-10-08T00:00:00Z"),
  orderingEnabled: true,
  item: {
    name: "Waffles",
    sponsorships: [{ teamName: null, sponsorName: null, members: [{ name: "Corbin" }] }],
  },
  sponsorsNeeded: 2,
  amountCents: 3000,
  headcount: 6,
  rsvpDeadline: { weekday: 3, time: "17:00" },
});

describe("reminderPayload", () => {
  it("is a mrkdwn section plus RSVP and Sponsor an item buttons", () => {
    const { text, blocks } = reminderPayload(msg, { appUrl: "https://bc.example.com/" });
    expect(text).toBe(reminderMrkdwn(msg));
    expect(blocks).toEqual([
      { type: "section", text: { type: "mrkdwn", text: reminderMrkdwn(msg) } },
      {
        type: "actions",
        elements: [
          expect.objectContaining({
            type: "button",
            text: { type: "plain_text", text: "RSVP" },
            url: "https://bc.example.com/",
          }),
          expect.objectContaining({
            type: "button",
            text: { type: "plain_text", text: "Sponsor an item" },
            url: "https://bc.example.com/schedule",
          }),
        ],
      },
    ]);
    expect(text).toContain("Waffles — _sponsored by Corbin (needs 1 more)_");
  });

  it("marks a test post clearly", () => {
    const { text, blocks } = reminderPayload(msg, { appUrl: "https://bc.example.com", test: true });
    expect(text.startsWith("[Test] ")).toBe(true);
    expect(blocks[0]).toEqual({
      type: "context",
      elements: [{ type: "mrkdwn", text: expect.stringContaining(TEST_REMINDER_NOTE) }],
    });
  });

  it("leaves the buttons off when APP_URL isn't set", () => {
    const { blocks } = reminderPayload(msg, { appUrl: undefined });
    expect(blocks.map((b) => b.type)).toEqual(["section"]);
  });

  it("never mentions payment status", () => {
    const json = JSON.stringify(reminderPayload(msg, { appUrl: "https://x", test: true }));
    expect(json).not.toMatch(/\bpaid\b|unpaid|outstanding/i);
  });
});
