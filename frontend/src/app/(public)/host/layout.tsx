import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Host a Chapter – Ai Salon",
};

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
