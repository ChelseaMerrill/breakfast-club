"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { MASCOTS } from "./mascots-art";

// Decorative breakfast stickers down both side margins, as in the design's `decor` layer.
// Placement is seeded by the page, so each page has its own stable arrangement. Drawn only in
// the browser: the (app) layout is prerendered once and shared, so the server can't know the
// page. Purely decorative, so appearing a moment after load is fine. Hidden on phones.

const noop = () => () => {};

function placements(key: string) {
  let seed = 7;
  for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  // Same random sequence as the prototype: it shuffles a 5×3 grid first (unused here).
  const cells: number[] = Array.from({ length: 15 }, (_, i) => i);
  cells.sort(() => rnd() - 0.5);
  const order = MASCOTS.map((_, i) => i).sort(() => rnd() - 0.5);

  return Array.from({ length: 10 }, (_, i) => {
    const left = i < 5;
    const inset = rnd() * 12;
    const top = (i % 5) * 19 + rnd() * 6;
    const scale = 0.8 + rnd() * 0.25;
    const rot = Math.round(rnd() * 44 - 22);
    // Passed as custom properties so the browser applies the values exactly as given.
    return {
      left,
      vars: {
        "--top": `${top.toFixed(2)}%`,
        "--inset": `${inset.toFixed(1)}px`,
        "--scale": scale.toFixed(2),
        "--rot": `${rot}deg`,
        "--src": `url("${MASCOTS[order[i % MASCOTS.length]].src}")`,
      } as CSSProperties,
    };
  });
}

export function Mascots() {
  const pathname = usePathname();
  const inBrowser = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!inBrowser) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden md:block"
    >
      {placements(pathname).map((m, i) => (
        <div
          key={i}
          className={`mascot ${m.left ? "left-[var(--inset)]" : "right-[var(--inset)]"}`}
          style={m.vars}
        />
      ))}
    </div>
  );
}
