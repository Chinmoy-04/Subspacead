"use client";

import { useEffect, useState } from "react";

export type DataSource = "live" | "bundled";

/** Starts from bundled data, then swaps in the live API response when the backend answers. */
export function useLive<T>(fetcher: () => Promise<T>, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [source, setSource] = useState<DataSource>("bundled");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetcher()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setSource("live");
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, source, loading };
}
