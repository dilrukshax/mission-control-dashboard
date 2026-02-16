"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_MC_API_BASE ?? "http://127.0.0.1:3001";
const API_KEY = process.env.NEXT_PUBLIC_MC_API_KEY;

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const streamUrl = API_KEY
      ? `${API_BASE}/api/stream?key=${encodeURIComponent(API_KEY)}`
      : `${API_BASE}/api/stream`;
    const es = new EventSource(streamUrl);

    const refresh = () => {
      router.refresh();
    };

    es.addEventListener("update", refresh);

    return () => {
      es.removeEventListener("update", refresh);
      es.close();
    };
  }, [router]);

  return null;
}
