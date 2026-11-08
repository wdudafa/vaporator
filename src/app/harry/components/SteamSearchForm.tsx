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
    <form onSubmit={handleSubmit} className="profile-search">
      <label className="sr-only" htmlFor="steam-username">Enter Steam username or SteamID</label>
      <input
        id="steam-username"
        type="text"
        value={username}
        placeholder="Enter Steam username or SteamID..."
        onChange={(e) => setUsername(e.target.value)}
      />
      <button type="submit" className="button button-primary">Search</button>
    </form>
  );
}
