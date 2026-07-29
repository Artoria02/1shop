"use client";

import { useState, useEffect } from "react";

export function CountdownTimer({ expireAt }: { expireAt: string | Date | null }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expireAt) return;

    const target = new Date(expireAt).getTime();

    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining(0);
        return;
      }
      setRemaining(diff);
    }

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [expireAt]);

  if (remaining === null || remaining <= 0) return null;

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const tenths = Math.floor((remaining % 1000) / 100);

  const pad = (n: number) => String(n).padStart(2, "0");

  const formatted = hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${tenths}`
    : `${pad(minutes)}:${pad(seconds)}.${tenths}`;

  return (
    <span style={{ color: "#e00", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
      {formatted}
    </span>
  );
}
