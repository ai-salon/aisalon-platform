"use client";

import { useEffect, useState } from "react";
import { fetchHealth, type HealthResponse } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 py-16">
      <h1 className="text-4xl font-bold">AI Salon Platform</h1>
      <p className="text-lg text-gray-600">
        Community platform for AI Salon chapters worldwide.
      </p>

      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Backend Status
        </h2>
        {error ? (
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-red-700">Disconnected</span>
            <span className="ml-auto text-xs text-gray-400">{error}</span>
          </div>
        ) : health ? (
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-green-700">Connected</span>
            <span className="ml-auto text-xs text-gray-400">
              v{health.version}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 animate-pulse rounded-full bg-yellow-400" />
            <span className="text-gray-500">Connecting...</span>
          </div>
        )}
      </div>
    </div>
  );
}
