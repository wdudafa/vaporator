"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function SteamSearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState(searchParams.get("username") || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    router.push(`?username=${encodeURIComponent(username.trim())}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
      <div className="relative grow">
        {!username && (
          <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 dark:text-gray-500 text-md">
            Enter Steam username or SteamID...
          </span>
        )}
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent text-black dark:text-white"
        />
      </div>
      <button
        type="submit"
        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
