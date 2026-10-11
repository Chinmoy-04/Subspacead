"use client";

import { ReactLenis } from "lenis/react";
import { MotionConfig } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

export function SmoothScroll({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {!reduced && (
        <ReactLenis
          root
          options={{
            autoRaf: true,
            lerp: 0.1,
            anchors: { offset: -80 },
            allowNestedScroll: true,
          }}
        />
      )}
      {children}
    </MotionConfig>
  );
}
