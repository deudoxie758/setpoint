import { signSuggestion, verifySuggestionToken } from "../../src/lib/aiSuggestionToken";

const suggestion = {
  skill: "BLOCK" as const,
  outcome: "POINT_WON" as const,
  confidence: 0.85,
  rationale: "Red jersey #5 blocks the attack at the net.",
};

describe("aiSuggestionToken", () => {
  it("round-trips a signed suggestion back to its original payload", () => {
    const token = signSuggestion(suggestion, "player-1");
    const verified = verifySuggestionToken(token);

    expect(verified).not.toBeNull();
    expect(verified!.skill).toBe("BLOCK");
    expect(verified!.outcome).toBe("POINT_WON");
    expect(verified!.confidence).toBe(0.85);
    expect(verified!.rationale).toBe(suggestion.rationale);
    expect(verified!.playerId).toBe("player-1");
  });

  it("rejects a token whose payload was tampered with", () => {
    const token = signSuggestion(suggestion, "player-1");
    const [payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), skill: "SPIKE" })
    ).toString("base64url");

    expect(verifySuggestionToken(`${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("rejects a token with a mismatched signature", () => {
    const token = signSuggestion(suggestion, "player-1");
    const [payload] = token.split(".");

    expect(verifySuggestionToken(`${payload}.not-a-real-signature`)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifySuggestionToken("not-a-token")).toBeNull();
    expect(verifySuggestionToken("")).toBeNull();
  });

  it("rejects an expired token", () => {
    const realNow = Date.now;
    Date.now = () => realNow() - 11 * 60 * 1000; // issued 11 minutes ago
    const token = signSuggestion(suggestion, "player-1");
    Date.now = realNow;

    expect(verifySuggestionToken(token)).toBeNull();
  });
});
