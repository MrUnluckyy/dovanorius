"use client";
import { useState } from "react";

export default function ProductUrlParser() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/parser?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      console.log("Parsed product metadata:", data); // <--- LOGS EVERYTHING
    } catch (err) {
      console.error("Error parsing product:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-2">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste product URL..."
        className="border rounded p-2 w-full"
      />
      <button
        onClick={handleFetch}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Fetching..." : "Parse Product"}
      </button>
    </div>
  );
}
