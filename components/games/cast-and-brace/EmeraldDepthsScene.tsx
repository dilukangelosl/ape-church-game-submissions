"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
    BITE_WORD_BEFORE_REEL_MS,
    CHARACTER_CAST_GIF,
    CHARACTER_CAST_GIF_DURATION_MS,
    CHARACTER_CAST_IDLE_SPRITE,
    CHARACTER_FEET_ANCHOR_PX,
    CHARACTER_IDLE_SPRITE,
    GIMBOZ_SPRITE,
    MY_GAME_BG_PIXEL_HEIGHT,
    MY_GAME_BG_PIXEL_WIDTH,
    type FishPlatformResult,
    type FishingPhase,
} from "./myGameConfig";
import CatchRevealPanel from "./CatchRevealPanel";
import IdleFishSchool from "./IdleFishSchool";
import WaterBackground from "./WaterBackground";
import WaterParticles from "./WaterParticles";
import { cn } from "@/lib/utils";
import { sumGifGraphicControlDelaysMs } from "./lib/gifDuration";
import "./my-game.styles.css";

const BOBBER_CAUGHT_FISH_SRC = "/submissions/cast-and-brace/driftborn_minnow.png";

type CastProfile = {
    depthPx: number;
    angleDeg: number;
    slackCurveX: number;
};

function createCastProfile(seed: number): CastProfile {
    // Deterministic per-cast profile so replay of the same cast key stays stable.
    let state = (seed ^ 0x9e3779b9) >>> 0;
    const nextUnit = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };

    const rawDepthPx = (156 + nextUnit() * 88) * 2 * 0.8;
    /** Keep line + bobber inside the frame when rotated (depth was absolute px while artboard scales). */
    const depthPx = Math.min(rawDepthPx, MY_GAME_BG_PIXEL_HEIGHT * 0.76);
    const angleDeg = (-48 + nextUnit() * 20) * 1.1;
    const slackCurveX = 26 + nextUnit() * 20;
    return { depthPx, angleDeg, slackCurveX };
}

export interface EmeraldDepthsSceneProps {
    fishingPhase: FishingPhase;
    castAnimKey: number;
    sceneLayoutKey: number;
    /** Layout RNG for idle school — stable across rounds so fish/band do not reset on replay. */
    fishSchoolSeed: number;
    onCastComplete: () => void;
    onReelMeterTap: () => void;
    onReelComplete: () => void;
    reelPullStarted: boolean;
    revealPayout: number | null;
    revealBet: number;
    platformResult: FishPlatformResult | null;
    /** With cast GIF / rod motion (start of `casting` while line not yet deployed). */
    onCastWhoosh?: () => void;
    /** When the line deploys into the water after the cast GIF (hook entry). */
    onHookWaterEntry?: () => void;
    /** KoKo jackpot catch-reveal video `ended` — advance to Ape Church results. */
    onKokoCatchRevealVideoEnded?: () => void;
}

const FishingCastLine: React.FC<{
    phase: FishingPhase;
    castAnimKey: number;
    castProfile: CastProfile;
    /** After cast GIF finishes (cast-idle shows); false keeps line at 0 during GIF. */
    deployCastLine: boolean;
    linePullActive: boolean;
    onCastComplete: () => void;
    onReelComplete: () => void;
}> = ({
    phase,
    castAnimKey,
    castProfile,
    deployCastLine,
    linePullActive,
    onCastComplete,
    onReelComplete,
}) => {
    const castNotifiedRef = useRef(false);
    const reelNotifiedRef = useRef(false);
    const isCasting = phase === "casting";
    const showRetracted = phase === "reveal";
    const showRetractAnim = phase === "reeling" && linePullActive;
    const wispyDrift =
        !isCasting && !showRetracted && !showRetractAnim;

    const castLinePayingOut = isCasting && deployCastLine;

    /** Hook / bobber only after the line is in the water; hidden during cast GIF prep and on reveal. */
    const showBobberInWater =
        (deployCastLine || phase !== "casting") && phase !== "reveal";

    /** Silhouette only after reel meter is full — pinned to bobber for line-in retract. */
    const showBobberCaughtFish = showBobberInWater && showRetractAnim;

    /** Curved slack in water until the fish takes the hook; then taut straight line. */
    const useSlackLine = phase === "casting" || phase === "waiting";

    const handleCastAnimEnd = useCallback(
        (e: React.AnimationEvent<HTMLDivElement>) => {
            if (e.animationName !== "emerald-cast-height") {
                return;
            }
            if (castNotifiedRef.current) {
                return;
            }
            castNotifiedRef.current = true;
            onCastComplete();
        },
        [onCastComplete]
    );

    const handleReelAnimEnd = useCallback(
        (e: React.AnimationEvent<HTMLDivElement>) => {
            if (e.animationName !== "emerald-cast-retract-kf") {
                return;
            }
            if (reelNotifiedRef.current) {
                return;
            }
            reelNotifiedRef.current = true;
            onReelComplete();
        },
        [onReelComplete]
    );

    let lineClass: string;
    if (useSlackLine) {
        if (isCasting && !deployCastLine) {
            lineClass =
                "emerald-cast-line-cast-prep emerald-cast-line-wispy emerald-cast-line-wispy-slack";
        } else if (isCasting && deployCastLine) {
            lineClass =
                "emerald-cast-line-animate-slack emerald-cast-line-wispy emerald-cast-line-wispy-slack";
        } else {
            lineClass =
                "emerald-cast-line-deployed-slack emerald-cast-line-wispy emerald-cast-line-wispy-slack";
        }
    } else if (showRetracted) {
        lineClass = "emerald-cast-line-retracted emerald-cast-line-wispy";
    } else if (showRetractAnim) {
        lineClass = "emerald-cast-line-reeling emerald-cast-line-wispy";
    } else {
        lineClass = "emerald-cast-line-deployed emerald-cast-line-wispy";
    }

    const gradId = `emerald-cast-line-grad-${castAnimKey}`;

    const slackLineKey = useSlackLine
        ? isCasting && !deployCastLine
            ? `cast-hold-${castAnimKey}`
            : isCasting && deployCastLine
              ? `cast-out-${castAnimKey}`
              : `slack-${castAnimKey}-${phase}`
        : `taut-${castAnimKey}-${phase}`;

    const lineNode = useSlackLine ? (
        <div
            key={slackLineKey}
            className={`${lineClass}${wispyDrift ? " emerald-cast-line-wispy-drift" : ""}`}
            onAnimationEnd={
                castLinePayingOut
                    ? handleCastAnimEnd
                    : showRetractAnim
                      ? handleReelAnimEnd
                      : undefined
            }
        >
            <svg
                className="h-full w-full"
                viewBox="0 0 42 1000"
                preserveAspectRatio="none"
                aria-hidden
            >
                <defs>
                    <linearGradient
                        id={gradId}
                        x1="21"
                        y1="0"
                        x2="21"
                        y2="1000"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop
                            offset="0%"
                            stopColor="rgba(255, 255, 255, 0.95)"
                        />
                        <stop
                            offset="35%"
                            stopColor="rgba(224, 242, 254, 0.75)"
                        />
                        <stop
                            offset="68%"
                            stopColor="rgba(125, 211, 252, 0.45)"
                        />
                        <stop
                            offset="100%"
                            stopColor="rgba(56, 189, 248, 0.2)"
                        />
                    </linearGradient>
                </defs>
                <path
                    className="emerald-cast-slack-path"
                    d={`M 21 0 Q ${castProfile.slackCurveX.toFixed(2)} 500 21 1000`}
                    fill="none"
                    stroke={`url(#${gradId})`}
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    vectorEffect="nonScalingStroke"
                />
            </svg>
        </div>
    ) : (
        <div
            className={`${lineClass}${wispyDrift ? " emerald-cast-line-wispy-drift" : ""}`}
            onAnimationEnd={
                showRetractAnim ? handleReelAnimEnd : undefined
            }
        />
    );

    return (
        <div
            key={castAnimKey}
            className="flex w-full flex-col items-center"
            style={
                {
                    ["--emerald-cast-height" as string]: `${(
                        (castProfile.depthPx / MY_GAME_BG_PIXEL_HEIGHT) *
                        100
                    ).toFixed(3)}cqh`,
                } as React.CSSProperties
            }
        >
            {/* No rod-swing transform during cast — it used negative Y + rotation and snapped off the rod at phase change. */}
            <div className="flex w-full flex-col items-center">
                {lineNode}
                {showBobberInWater ? (
                    <div
                        className={cn(
                            "relative mt-0 flex flex-col items-center",
                            phase === "bite" && "emerald-hook-bite-jerk",
                        )}
                    >
                        <div className="emerald-cast-bobber-cluster">
                            {showBobberCaughtFish ? (
                                <Image
                                    src={BOBBER_CAUGHT_FISH_SRC}
                                    alt=""
                                    width={32}
                                    height={24}
                                    className="emerald-cast-bobber-caught-fish emerald-cast-bobber-caught-fish-img emerald-fish-silhouette pointer-events-none h-auto w-8"
                                    unoptimized
                                    aria-hidden
                                />
                            ) : null}
                            <div className="emerald-cast-hook" aria-hidden />
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

const BiteThenReelFlashAlert: React.FC = () => {
    const [prompt, setPrompt] = useState<"bite" | "reel">("bite");

    useEffect(() => {
        const id = window.setTimeout(() => {
            setPrompt("reel");
        }, BITE_WORD_BEFORE_REEL_MS);
        return () => window.clearTimeout(id);
    }, []);

    return (
        <div className="emerald-bite-alert-root pointer-events-none absolute inset-0 z-[25] flex items-center justify-center">
            <span className="emerald-sr-only" aria-live="assertive" role="status">
                {prompt === "bite" ? "Bite!" : "Reel!"}
            </span>
            {prompt === "bite" ? (
                <span
                    className="emerald-bite-alert-text font-nohemia text-4xl font-black tracking-[0.35em] text-white drop-shadow-[0_0_24px_rgba(251,113,133,0.95)] min-[480px]:text-6xl sm:tracking-[0.42em]"
                    aria-hidden
                >
                    BITE
                </span>
            ) : (
                <span
                    className="emerald-reel-flash-alert-text font-nohemia text-4xl font-black tracking-[0.35em] text-white min-[480px]:text-6xl sm:tracking-[0.42em]"
                    aria-hidden
                >
                    REEL
                </span>
            )}
        </div>
    );
};

const EmeraldDepthsScene: React.FC<EmeraldDepthsSceneProps> = ({
    fishingPhase,
    castAnimKey,
    sceneLayoutKey,
    fishSchoolSeed,
    onCastComplete,
    onReelMeterTap,
    onReelComplete,
    reelPullStarted,
    revealPayout,
    revealBet,
    platformResult,
    onCastWhoosh,
    onHookWaterEntry,
    onKokoCatchRevealVideoEnded,
}) => {
    const castGifDurationMsRef = useRef<number | null>(null);
    const [castLineReady, setCastLineReady] = useState(false);
    const castWhooshFiredForKeyRef = useRef<number>(-1);
    const hookSplashFiredForKeyRef = useRef<number>(-1);
    const prevFishingPhaseRef = useRef<FishingPhase>(fishingPhase);
    const [postCastFeetSettle, setPostCastFeetSettle] = useState(false);

    useEffect(() => {
        let alive = true;
        void (async () => {
            try {
                const res = await fetch(CHARACTER_CAST_GIF);
                const buf = await res.arrayBuffer();
                const ms =
                    sumGifGraphicControlDelaysMs(buf) ??
                    CHARACTER_CAST_GIF_DURATION_MS;
                if (alive) {
                    castGifDurationMsRef.current = ms;
                }
            } catch {
                if (alive) {
                    castGifDurationMsRef.current = CHARACTER_CAST_GIF_DURATION_MS;
                }
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (fishingPhase !== "casting") {
            queueMicrotask(() => setCastLineReady(false));
            return;
        }
        queueMicrotask(() => setCastLineReady(false));
        const ms =
            castGifDurationMsRef.current ?? CHARACTER_CAST_GIF_DURATION_MS;
        const tid = window.setTimeout(() => {
            setCastLineReady(true);
        }, ms) as unknown as number;
        return () => {
            window.clearTimeout(tid);
        };
    }, [fishingPhase, castAnimKey]);

    /** Cast whoosh — first frame of casting while the character cast GIF is showing. */
    useEffect(() => {
        if (fishingPhase !== "casting" || castLineReady) {
            return;
        }
        if (castWhooshFiredForKeyRef.current === castAnimKey) {
            return;
        }
        castWhooshFiredForKeyRef.current = castAnimKey;
        onCastWhoosh?.();
    }, [fishingPhase, castLineReady, castAnimKey, onCastWhoosh]);

    /** Hold feet perfectly still briefly after leaving `casting` so drift + layout don’t pop together. */
    useEffect(() => {
        const prev = prevFishingPhaseRef.current;
        prevFishingPhaseRef.current = fishingPhase;
        if (prev !== "casting" || fishingPhase === "casting") {
            return;
        }
        queueMicrotask(() => setPostCastFeetSettle(true));
        const tid = window.setTimeout(() => {
            setPostCastFeetSettle(false);
        }, 420) as unknown as number;
        return () => {
            window.clearTimeout(tid);
            queueMicrotask(() => setPostCastFeetSettle(false));
        };
    }, [fishingPhase]);

    /** Hook splash — line is released into the water when deploy starts (right after GIF). */
    useEffect(() => {
        if (fishingPhase !== "casting" || !castLineReady) {
            return;
        }
        if (hookSplashFiredForKeyRef.current === castAnimKey) {
            return;
        }
        hookSplashFiredForKeyRef.current = castAnimKey;
        onHookWaterEntry?.();
    }, [fishingPhase, castLineReady, castAnimKey, onHookWaterEntry]);

    const showLine = fishingPhase !== "idle";
    const showAmbientFx =
        fishingPhase !== "idle" && fishingPhase !== "reveal";

    /** Cast GIF until one full cycle elapses; then cast-idle + line deploy on the same frame. */
    const showCastCharacterGif =
        fishingPhase === "casting" && !castLineReady;
    const showCastIdleSprite =
        fishingPhase === "waiting" ||
        fishingPhase === "bite" ||
        fishingPhase === "reeling" ||
        (fishingPhase === "casting" && castLineReady);

    const showBiteAlert = fishingPhase === "bite";

    /** Same school motion for all water phases; color only idle + reveal (after catch). */
    const showHorizontalFishSchool =
        fishingPhase === "idle" ||
        fishingPhase === "casting" ||
        fishingPhase === "waiting" ||
        fishingPhase === "bite" ||
        fishingPhase === "reeling" ||
        fishingPhase === "reveal";
    const fishSchoolSilhouette =
        fishingPhase !== "idle" && fishingPhase !== "reveal";
    const reelTapOpen =
        fishingPhase === "reeling" && !reelPullStarted;
    const castProfile = createCastProfile((sceneLayoutKey * 911 + castAnimKey * 131) >>> 0);

    const reelTapOpenRef = useRef(reelTapOpen);
    const onReelMeterTapRef = useRef(onReelMeterTap);

    const [gimbozPopped, setGimbozPopped] = useState(false);

    useEffect(() => {
        if (fishingPhase !== "casting") {
            return;
        }
        let cancelled = false;
        queueMicrotask(() => setGimbozPopped(true));
        const hideId = window.setTimeout(() => {
            if (cancelled) {
                return;
            }
            setGimbozPopped(false);
        }, 1100) as unknown as number;
        return () => {
            cancelled = true;
            window.clearTimeout(hideId);
            queueMicrotask(() => setGimbozPopped(false));
        };
    }, [fishingPhase, castAnimKey]);

    useEffect(() => {
        reelTapOpenRef.current = reelTapOpen;
    }, [reelTapOpen]);
    useEffect(() => {
        onReelMeterTapRef.current = onReelMeterTap;
    }, [onReelMeterTap]);

    /** No full-screen <button> — it flashes focus/tap highlights when spammed. */
    const handleScenePointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!reelTapOpenRef.current) {
                return;
            }
            if (e.button !== 0) {
                return;
            }
            onReelMeterTapRef.current();
        },
        []
    );

    useEffect(() => {
        if (!reelTapOpen) {
            return;
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onReelMeterTapRef.current();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [reelTapOpen]);

    const artboardStyle = {
        aspectRatio: `${MY_GAME_BG_PIXEL_WIDTH} / ${MY_GAME_BG_PIXEL_HEIGHT}`,
        width: `min(100cqw, calc(100cqh * ${MY_GAME_BG_PIXEL_WIDTH} / ${MY_GAME_BG_PIXEL_HEIGHT}))`,
        maxHeight: "100cqh",
    } as const;

    /** cqw/cqh = % of artboard width/height (`.emerald-scene-artboard` is `container-type: size`). */
    const characterFeetStyle = {
        left: `calc(${(CHARACTER_FEET_ANCHOR_PX.x / MY_GAME_BG_PIXEL_WIDTH) * 100}cqw + 7cqw)`,
        bottom: `calc(${((MY_GAME_BG_PIXEL_HEIGHT - CHARACTER_FEET_ANCHOR_PX.y) / MY_GAME_BG_PIXEL_HEIGHT) * 100}cqh + 7.5cqh)`,
    } as const;

    return (
        <div
            className={`emerald-depths-root relative flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-lg sm:rounded-xl${reelTapOpen ? " emerald-depths-reel-tapping" : ""}`}
            onPointerDown={reelTapOpen ? handleScenePointerDown : undefined}
        >
            <div
                className="emerald-scene-artboard max-w-full rounded-[inherit]"
                style={artboardStyle}
            >
                <WaterBackground />
                <div
                    className="pointer-events-none absolute bottom-[calc(5%_-_10%_+_7%_-_1.5%)] left-[2%] z-[5] w-[min(11vw,46px)] overflow-hidden min-[480px]:bottom-[max(0%,calc(4%_-_10%_+_7%_-_1.5%))] min-[480px]:left-[2.5%] sm:bottom-[calc(4.5%_-_10%_+_7%_-_1.5%)]"
                    style={{
                        height:
                            "min(calc(min(11vw, 46px) * 109 / 89 / 2), clamp(24px, 6vw, 29px))",
                    }}
                    aria-hidden
                >
                    <div
                        className={`emerald-gimboz-pop-inner w-full shrink-0${gimbozPopped ? " emerald-gimboz-pop-inner--visible" : ""}`}
                    >
                        <Image
                            src={GIMBOZ_SPRITE}
                            alt=""
                            width={89}
                            height={109}
                            className="block h-auto w-full object-contain object-left-top [image-rendering:pixelated]"
                            unoptimized
                        />
                    </div>
                </div>
                {showAmbientFx && <WaterParticles />}
                {showHorizontalFishSchool && (
                    <IdleFishSchool
                        schoolSeed={fishSchoolSeed}
                        silhouette={fishSchoolSilhouette}
                    />
                )}
                {fishingPhase === "bite" && (
                    <div className="emerald-bite-flash" aria-hidden />
                )}
                {showBiteAlert && <BiteThenReelFlashAlert />}
                {fishingPhase === "reveal" && revealPayout !== null && (
                    <CatchRevealPanel
                        payout={revealPayout}
                        betAmount={revealBet}
                        platformResult={platformResult}
                        onKokoCatchRevealVideoEnded={onKokoCatchRevealVideoEnded}
                    />
                )}
                {showLine && (
                    <div
                        className="emerald-cast-pivot pointer-events-none absolute z-[8] w-[6.897cqw] min-w-[6.897cqw] shrink-0"
                        style={
                            {
                                left: "31.15cqw",
                                top: "28.85cqh",
                                ["--cast-rotate-deg" as string]:
                                    castProfile.angleDeg.toFixed(2),
                            } as React.CSSProperties
                        }
                        aria-hidden
                    >
                        <div
                            className={cn(
                                "w-full",
                                fishingPhase === "reeling" && !reelPullStarted
                                    ? "emerald-reel-tension-shake"
                                    : undefined,
                            )}
                        >
                            <FishingCastLine
                                phase={fishingPhase}
                                castAnimKey={castAnimKey}
                                castProfile={castProfile}
                                deployCastLine={
                                    fishingPhase !== "casting" || castLineReady
                                }
                                linePullActive={reelPullStarted}
                                onCastComplete={onCastComplete}
                                onReelComplete={onReelComplete}
                            />
                        </div>
                    </div>
                )}
                <div
                    className="pointer-events-none absolute z-10 w-[24cqw] leading-none"
                    style={characterFeetStyle}
                    aria-hidden
                >
                    {/* Fixed aspect + bottom alignment so GIF vs PNG height differences do not shift the angler. */}
                    <div className="relative aspect-[300/298] w-full">
                        <div
                            className={cn(
                                "emerald-character-water-drift absolute inset-0 flex min-h-0 items-end justify-start overflow-hidden",
                                fishingPhase === "casting" &&
                                    "emerald-character-water-drift--casting",
                                postCastFeetSettle &&
                                    "emerald-character-water-drift--post-cast-settle",
                            )}
                        >
                            {showCastCharacterGif ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    key={castAnimKey}
                                    src={CHARACTER_CAST_GIF}
                                    alt="Angler"
                                    width={300}
                                    height={298}
                                    className="block h-full w-full min-h-0 shrink-0 object-contain object-left-bottom drop-shadow-md [image-rendering:pixelated]"
                                />
                            ) : showCastIdleSprite ? (
                                <Image
                                    key={`cast-idle-${castAnimKey}`}
                                    src={CHARACTER_CAST_IDLE_SPRITE}
                                    alt="Angler"
                                    width={300}
                                    height={298}
                                    className="block h-full w-full min-h-0 shrink-0 object-contain object-left-bottom drop-shadow-md [image-rendering:pixelated]"
                                    unoptimized
                                />
                            ) : (
                                <Image
                                    src={CHARACTER_IDLE_SPRITE}
                                    alt="Angler"
                                    width={300}
                                    height={298}
                                    className="block h-full w-full min-h-0 shrink-0 object-contain object-left-bottom drop-shadow-md [image-rendering:pixelated]"
                                    unoptimized
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmeraldDepthsScene;
