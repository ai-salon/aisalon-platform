import { describe, it, expect } from "vitest";
import { backendTokenExpired } from "./token";

function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.fakesignature`;
}

describe("backendTokenExpired", () => {
  it("returns true for a token whose exp is in the past", () => {
    const token = makeJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) - 60 });
    expect(backendTokenExpired(token)).toBe(true);
  });

  it("returns false for a token whose exp is in the future", () => {
    const token = makeJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(backendTokenExpired(token)).toBe(false);
  });

  it("returns true when the token is missing", () => {
    expect(backendTokenExpired(undefined)).toBe(true);
    expect(backendTokenExpired(null)).toBe(true);
    expect(backendTokenExpired("")).toBe(true);
  });

  it("returns false for a malformed token (lets the backend decide)", () => {
    expect(backendTokenExpired("not-a-jwt")).toBe(false);
    expect(backendTokenExpired("a.b.c")).toBe(false);
  });

  it("returns false for a token without an exp claim", () => {
    const token = makeJwt({ sub: "user-1" });
    expect(backendTokenExpired(token)).toBe(false);
  });
});
