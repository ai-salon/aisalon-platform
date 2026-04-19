import { notFound } from "next/navigation";
import RoleDetail from "./RoleDetail";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Role = {
  id: string;
  title: string;
  slug: string;
  description: string;
  requirements: string | null;
  time_commitment: string | null;
  chapter_id: string | null;
  chapter_code: string | null;
  chapter_name: string | null;
};

export default async function VolunteerRoleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await fetch(`${API_URL}/volunteer-roles/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) notFound();
  const role: Role = await res.json();
  return <RoleDetail role={role} />;
}
