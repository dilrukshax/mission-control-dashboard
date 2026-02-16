"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_MC_API_BASE ?? "http://127.0.0.1:3001";

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/stream`);

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
