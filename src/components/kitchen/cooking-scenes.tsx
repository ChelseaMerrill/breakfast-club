"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { COOKING_SCENES } from "./cooking-art";

/**
 * Design: while ordering is open, four cooking scenes sit under the kitchen columns and take
 * turns (10s each); the active one animates, the others dim. Hidden on phones (decision #24).
 */
export function CookingScenes() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((s) => (s + 1) % COOKING_SCENES.length), 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div aria-hidden className="mt-14 hidden md:block">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        {COOKING_SCENES.map((svg, k) => (
          <div
            key={k}
            className={cn(
              "cooking-scene flex justify-center transition-opacity duration-400",
              k === stage ? "opacity-100" : "opacity-40",
            )}
            style={{ "--play": k === stage ? "running" : "paused" } as CSSProperties}
            // Static SVG markup generated from the design file (cooking-art.ts), not user input.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ))}
      </div>
      <div className="cooking-belt" />
    </div>
  );
}
