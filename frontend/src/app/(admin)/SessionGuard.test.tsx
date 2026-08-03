import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import SessionGuard from "./SessionGuard";

function makeJwt(expSecondsFromNow: number): string {
  const b64 = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + expSecondsFromNow;
  return `${b64({ alg: "HS256" })}.${b64({ sub: "u1", exp })}.sig`;
}

const replace = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({
    push: vi.fn(),
    replace,
    refresh: vi.fn(),
    back: vi.fn(),
  } as unknown as ReturnType<typeof useRouter>);
  vi.mocked(usePathname).mockReturnValue("/users");
});

describe("SessionGuard", () => {
  it("redirects to /login when the session is unauthenticated", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
    } as unknown as ReturnType<typeof useSession>);
    render(<SessionGuard />);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("does not redirect on the login page itself", () => {
    vi.mocked(usePathname).mockReturnValue("/login");
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
    } as unknown as ReturnType<typeof useSession>);
    render(<SessionGuard />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out when the backend token in the session has expired", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: makeJwt(-60) },
      status: "authenticated",
    } as unknown as ReturnType<typeof useSession>);
    render(<SessionGuard />);
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });

  it("does nothing while the backend token is still valid", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: makeJwt(3600) },
      status: "authenticated",
    } as unknown as ReturnType<typeof useSession>);
    render(<SessionGuard />);
    expect(signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out once the token expires while the user stays on the page", () => {
    vi.useFakeTimers();
    try {
      vi.mocked(useSession).mockReturnValue({
        data: { accessToken: makeJwt(30) },
        status: "authenticated",
      } as unknown as ReturnType<typeof useSession>);
      render(<SessionGuard />);
      expect(signOut).not.toHaveBeenCalled();
      vi.advanceTimersByTime(90_000);
      expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
    } finally {
      vi.useRealTimers();
    }
  });
});
