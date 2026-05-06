"use client";

import React from "react";

/** Fixed layout — no RNG; tiny DOM + CSS only. */
const SPECS = [
    { left: 8, top: 48, delay: 0, dur: 7.5 },
    { left: 22, top: 72, delay: 1.1, dur: 9 },
    { left: 78, top: 44, delay: 2.4, dur: 8.2 },
    { left: 55, top: 68, delay: 0.6, dur: 10 },
    { left: 88, top: 58, delay: 3.2, dur: 7.8 },
    { left: 38, top: 52, delay: 1.8, dur: 8.8 },
] as const;

const WaterParticles: React.FC = () => (
    <div
        className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
        aria-hidden
    >
        {SPECS.map((p, i) => (
            <span
                key={i}
                className="emerald-water-particle absolute rounded-full bg-teal-200/25 shadow-[0_0_6px_rgb(153_246_228/0.35)]"
                style={{
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    width: "max(3px, 0.35vw)",
                    height: "max(3px, 0.35vw)",
                    animationDuration: `${p.dur}s`,
                    animationDelay: `${p.delay}s`,
                }}
            />
        ))}
    </div>
);

export default WaterParticles;
