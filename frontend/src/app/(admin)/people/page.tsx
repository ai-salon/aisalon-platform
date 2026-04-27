"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Person {
  id: string;
  username: string | null;
  email: string;
  role: string;
  name: string | null;
  title: string | null;
  is_founder: boolean;
  display_order: number;
  profile_image_url: string | null;
  profile_completed_at: string | null;
  chapter_code: string | null;
  chapter_name: string | null;
}

export default function PeoplePage() {
  const { data: session } = useSession();
  const token = (session as unknown as { accessToken?: string })?.accessToken;
  const [people, setPeople] = useState<Person[]>([]);

  async function refresh() {
    const r = await fetch(`${API_URL}/admin/people`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (r.ok) setPeople(await r.json());
  }

  useEffect(() => {
    if (token) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function update(id: string, patch: Partial<Person>) {
    await fetch(`${API_URL}/admin/people/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">People</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-sm text-salon-muted border-b">
            <th className="py-2">Photo</th>
            <th>Name</th>
            <th>Title</th>
            <th>Role</th>
            <th>Chapter</th>
            <th>Founder</th>
            <th>Order</th>
            <th>Profile</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2">
                {p.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.profile_image_url.startsWith("/") ? `${API_URL}${p.profile_image_url}` : p.profile_image_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                )}
              </td>
              <td>{p.name || p.username || p.email}</td>
              <td>
                <input
                  defaultValue={p.title || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (p.title || "")) {
                      update(p.id, { title: e.target.value });
                    }
                  }}
                  className="border rounded px-2 py-1 text-sm w-full"
                />
              </td>
              <td>{p.role}</td>
              <td>{p.chapter_name || "—"}</td>
              <td>
                <input
                  type="checkbox"
                  checked={p.is_founder}
                  onChange={(e) => update(p.id, { is_founder: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="number"
                  defaultValue={p.display_order}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== p.display_order) update(p.id, { display_order: v });
                  }}
                  className="border rounded px-2 py-1 w-16 text-sm"
                />
              </td>
              <td>{p.profile_completed_at ? "Complete" : "Incomplete"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
