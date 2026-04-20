import { describe, expect, it } from "vite-plus/test";
import { formatDate, humanizeAge } from "../../src/ui/format";

describe("ui/format.humanizeAge", () => {
  const now = new Date("2026-04-20T00:00:00.000Z").getTime();
  const day = 86400000;

  it("returns 'never' for undefined/null", () => {
    expect(humanizeAge(null, now)).toBe("never");
    expect(humanizeAge(undefined, now)).toBe("never");
  });

  it("days", () => {
    expect(humanizeAge(now - 3 * day, now)).toBe("3 days ago");
    expect(humanizeAge(now - 1 * day, now)).toBe("1 day ago");
  });

  it("months", () => {
    expect(humanizeAge(now - 60 * day, now)).toBe("2 months ago");
  });

  it("years", () => {
    expect(humanizeAge(now - 800 * day, now)).toBe("2 years ago");
  });

  it("formatDate", () => {
    expect(formatDate(new Date("2026-04-20T14:33:12.000Z"))).toMatch(/2026-04-20/);
  });
});
