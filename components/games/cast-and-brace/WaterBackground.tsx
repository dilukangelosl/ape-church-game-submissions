"use client";

import React from "react";
import Image from "next/image";

const imgShared = {
    sizes: "100vw" as const,
    className: "emerald-pixel-bg object-cover object-left-bottom",
    priority: true,
    unoptimized: true,
};

/**
 * Three stacked layers: base → clouds (animated) → dock.
 * Only the clouds layer drifts; main and dock stay fixed.
 */
const WaterBackground: React.FC = () => (
    <div className="emerald-scene-bg pointer-events-none absolute inset-0 overflow-hidden">
        <div className="emerald-water-parallax z-0">
            <Image src="/submissions/cast-and-brace/bg_main.png" alt="" fill {...imgShared} />
        </div>
        <div className="emerald-water-parallax z-[1]">
            <div className="emerald-clouds-drift absolute inset-0">
                <div className="emerald-clouds-scroll-track">
                    <div className="emerald-clouds-scroll-tile">
                        <Image
                            src="/submissions/cast-and-brace/bg_clouds.png"
                            alt=""
                            fill
                            {...imgShared}
                        />
                    </div>
                    <div className="emerald-clouds-scroll-tile">
                        <Image
                            src="/submissions/cast-and-brace/bg_clouds.png"
                            alt=""
                            fill
                            {...imgShared}
                        />
                    </div>
                </div>
            </div>
        </div>
        <div className="emerald-water-parallax emerald-dock-offset z-[2]">
            <Image src="/submissions/cast-and-brace/bg_dock.png" alt="" fill {...imgShared} />
        </div>
    </div>
);

export default WaterBackground;
