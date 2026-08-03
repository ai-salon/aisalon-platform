"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { backendTokenExpired } from "@/lib/token";

/**
 * Mounted once in the (admin) layout. Ensures a user whose backend token has
 * expired is actually signed out instead of browsing a zombie session where
 * every API call 401s:
 * - redirects to /login whenever the session becomes unauthenticated
 * - checks the backend token's exp every minute and signs out once it lapses
 */
export default function SessionGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.replace("/login");
    }
  }, [status, pathname, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const check = () => {
      if (backendTokenExpired(accessToken)) {
        signOut({ redirectTo: "/login" });
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [status, accessToken]);

  return null;
}
