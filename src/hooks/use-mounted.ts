"use client";

import { useEffect, useState } from "react";

/** True after the first client render; useful to avoid hydration mismatches. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
