import { randomBytes } from "crypto";

export function generateShareToken(): string {
  return randomBytes(9).toString("base64url");
}
