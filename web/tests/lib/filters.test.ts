import { hasActiveFilters } from "@/lib/filters";

describe("hasActiveFilters", () => {
  it("returns false for an empty filters object", () => {
    expect(hasActiveFilters({})).toBe(false);
  });

  it("returns false when a filter key is present but its value is undefined", () => {
    // FilterBar always sets a key when a select changes, even back to "All" —
    // e.g. { playerId: undefined } — so presence of a key alone must not count.
    expect(hasActiveFilters({ playerId: undefined })).toBe(false);
  });

  it("returns true when a filter has a real value", () => {
    expect(hasActiveFilters({ playerId: "p1" })).toBe(true);
  });

  it("returns false when every present key is undefined", () => {
    expect(hasActiveFilters({ playerId: undefined, skill: undefined, opponent: undefined })).toBe(false);
  });
});
