import { describe, expect, it } from "vitest";
import { checkCronAuth } from "./cron-auth";

describe("checkCronAuth", () => {
  it("accepts only the exact bearer secret", () => {
    expect(checkCronAuth("Bearer s3cret", "s3cret")).toBe("ok");
    expect(checkCronAuth("Bearer wrong", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth("Bearer s3cret2", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth("s3cret", "s3cret")).toBe("unauthorized");
    expect(checkCronAuth(null, "s3cret")).toBe("unauthorized");
  });

  it("fails closed when CRON_SECRET isn't set", () => {
    expect(checkCronAuth("Bearer ", undefined)).toBe("not-configured");
    expect(checkCronAuth("Bearer ", "")).toBe("not-configured");
    expect(checkCronAuth(null, undefined)).toBe("not-configured");
  });
});
