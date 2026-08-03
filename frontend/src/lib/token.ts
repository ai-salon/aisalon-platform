/**
 * Checks whether the backend-issued JWT stored in the NextAuth session has
 * expired. The NextAuth cookie is rolling (re-issued on activity) but the
 * backend token has an absolute 30-day expiry, so an active session can
 * outlive its backend token — every API call then 401s while the UI still
 * looks signed in. Callers use this to invalidate the session instead.
 *
 * Missing token → expired (the session is unusable without one).
 * Malformed token or no exp claim → not expired (let the backend decide).
 */
export function backendTokenExpired(accessToken: unknown): boolean {
  if (typeof accessToken !== "string" || accessToken === "") return true;
  try {
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return false;
    // atob (browser + Node 16+) so this works in both the NextAuth server
    // callbacks and client components like SessionGuard.
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === "number" && Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}
