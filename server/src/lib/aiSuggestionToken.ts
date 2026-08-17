import crypto from "crypto";
import { Skill, Outcome } from "@prisma/client";
import { TagSuggestion } from "./aiTagging";

// In-memory, per-process secret. Tokens only need to survive the few minutes
// between a suggestion request and the clip being saved, so a restart
// invalidating in-flight tokens (forcing a re-suggest) is an acceptable
// trade-off for not needing a dedicated persisted secret.
const SECRET = crypto.randomBytes(32).toString("hex");
const TOKEN_TTL_MS = 10 * 60 * 1000;

export interface SignedSuggestion {
  skill: Skill;
  outcome: Outcome;
  confidence: number;
  rationale: string;
  playerId: string;
  issuedAt: number;
}

export function signSuggestion(suggestion: TagSuggestion, playerId: string): string {
  const payload: SignedSuggestion = { ...suggestion, playerId, issuedAt: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySuggestionToken(token: string): SignedSuggestion | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expectedSignature = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (signatureBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  let payload: SignedSuggestion;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  } catch {
    return null;
  }

  if (Date.now() - payload.issuedAt > TOKEN_TTL_MS) return null;
  return payload;
}
