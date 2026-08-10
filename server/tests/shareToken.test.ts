import { generateShareToken } from "../src/lib/shareToken";

describe("generateShareToken", () => {
  it("returns a URL-safe string with no padding or slashes", () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(10);
  });

  it("returns a different token on each call", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
  });
});
