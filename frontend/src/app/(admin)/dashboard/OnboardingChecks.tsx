"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type OnboardingChecks = Record<string, boolean>;

interface ChecksContext {
  checks: OnboardingChecks;
  setCheck: (key: string, done: boolean) => void;
}

const Ctx = createContext<ChecksContext | null>(null);

/** Holds the signed-in user's saved Getting Started checks (users.onboarding_checks). */
export function OnboardingChecksProvider({
  initial,
  children,
}: {
  initial?: OnboardingChecks;
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const [checks, setChecks] = useState<OnboardingChecks>(initial ?? {});

  const apply = useCallback((key: string, done: boolean) => {
    setChecks((prev) => {
      const next = { ...prev };
      if (done) next[key] = true;
      else delete next[key];
      return next;
    });
  }, []);

  const setCheck = useCallback(
    (key: string, done: boolean) => {
      apply(key, done);
      if (!token) return;
      const rollback = () => {
        apply(key, !done);
        toast.error("Couldn't save that check — please try again.");
      };
      fetch(`${API_URL}/admin/me/onboarding-checks`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ key, done }),
      })
        .then((r) => {
          if (!r.ok) rollback();
        })
        .catch(rollback);
    },
    [token, apply]
  );

  return <Ctx.Provider value={{ checks, setCheck }}>{children}</Ctx.Provider>;
}

/** Read the saved check for `key`; without a key (or provider) state is local and unsaved. */
export function useOnboardingCheck(key?: string): [boolean, (done: boolean) => void] {
  const ctx = useContext(Ctx);
  const [local, setLocal] = useState(false);
  if (key && ctx) return [!!ctx.checks[key], (done) => ctx.setCheck(key, done)];
  return [local, setLocal];
}

export function useOnboardingChecks(): OnboardingChecks {
  return useContext(Ctx)?.checks ?? {};
}
