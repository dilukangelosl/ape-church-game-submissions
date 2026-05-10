"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BOARD_TILE_COUNT, BOARD_COLUMNS } from "./minesConfig";

interface MinesWindowProps {
    minePositions: number[];
    revealedTiles: number[];
    explodedMine: number | null;
    isRoundActive: boolean;
    isAutoBetting: boolean;
    isAutoSelectionMode: boolean;
    showAutoSelectedTiles: boolean;
    revealAllTiles: boolean;
    pendingRevealTiles: number[];
    autoSelectedTiles: number[];
    canReveal: boolean;
    onRevealTile: (index: number) => void;
    onToggleAutoTile: (index: number) => void;
    showEndCardGamesNote?: boolean;
    endCardGamesCount?: number;
}

type TileState = "unrevealed" | "gem" | "exploded" | "mine-revealed";

const EXPLOSION_SPRITE_SRC = "/submissions/mines/explosion-sprite.png";
const FIRE_FRAME_SRC = "/submissions/mines/fire_frame.png";
const EXPLOSION_FRAME_COUNT = 64;
const EXPLOSION_COLUMNS = 8;
const EXPLOSION_FPS = 48;
const EXPLOSION_BOMB_PRE_DELAY_MS = 110;
const EXPLOSION_BOMB_POST_DELAY_MS = 120;
const FIRE_FRAME_SPRITE_COUNT = 25;
const FIRE_FRAME_SPRITE_COLUMNS = 5;
const FIRE_FRAME_FPS = 20;

interface ExplosionSpriteProps {
    src: string;
    frameCount: number;
    columns: number;
    fps: number;
    className?: string;
    showManualFireFrame: boolean;
}

type ExplosionPhase = "intro" | "playing" | "outro";

const ExplosionSprite: React.FC<ExplosionSpriteProps> = ({
    src,
    frameCount,
    columns,
    fps,
    className,
    showManualFireFrame,
}) => {
    const [frame, setFrame] = useState(0);
    const [phase, setPhase] = useState<ExplosionPhase>("intro");
    const [imageFailed, setImageFailed] = useState(false);

    const totalFrames = Math.max(1, frameCount);
    const [reachedLastFrame, setReachedLastFrame] = useState(false);
    const isFireBorderVisible = showManualFireFrame && (phase === "outro" || reachedLastFrame);

    useEffect(() => {
        setImageFailed(false);
        const image = new Image();
        image.onload = () => setImageFailed(false);
        image.onerror = () => setImageFailed(true);
        image.src = src;
    }, [src]);

    useEffect(() => {
        setFrame(0);
        setPhase("intro");
        setReachedLastFrame(false);
        const msPerFrame = Math.max(16, Math.round(1000 / Math.max(1, fps)));
        let frameTimer: number | null = null;
        let hideTimer: number | null = null;

        const introTimer = window.setTimeout(() => {
            setPhase("playing");
            frameTimer = window.setInterval(() => {
                setFrame((prev) => {
                    if (prev >= totalFrames - 1) {
                        if (frameTimer !== null) {
                            window.clearInterval(frameTimer);
                            frameTimer = null;
                        }
                        if (hideTimer === null) {
                            setReachedLastFrame(true);
                            hideTimer = window.setTimeout(() => {
                                setPhase("outro");
                            }, EXPLOSION_BOMB_POST_DELAY_MS);
                        }
                        return prev;
                    }
                    return prev + 1;
                });
            }, msPerFrame);
        }, EXPLOSION_BOMB_PRE_DELAY_MS);

        return () => {
            window.clearTimeout(introTimer);
            if (frameTimer !== null) {
                window.clearInterval(frameTimer);
            }
            if (hideTimer !== null) {
                window.clearTimeout(hideTimer);
            }
        };
    }, [fps, totalFrames]);

    const rows = useMemo(() => Math.max(1, Math.ceil(frameCount / Math.max(1, columns))), [frameCount, columns]);
    const col = frame % Math.max(1, columns);
    const row = Math.floor(frame / Math.max(1, columns));

    const xPercent = columns <= 1 ? 0 : (col / (columns - 1)) * 100;
    const yPercent = rows <= 1 ? 0 : (row / (rows - 1)) * 100;

    if (imageFailed) {
        return (
            <img
                src="/submissions/mines/bomb.svg"
                alt="Bomb"
                className="mines-tile-icon mines-tile-exploded-icon"
                draggable={false}
            />
        );
    }

    return (
        <span className="mines-explosion-sequence" data-phase={phase}>
            <img
                src="/submissions/mines/bomb.svg"
                alt="Bomb"
                className="mines-tile-icon mines-explosion-sequence-bomb"
                draggable={false}
            />
            <span
                aria-hidden="true"
                className="mines-fire-frame-border"
                data-visible={isFireBorderVisible ? "true" : "false"}
            />
            <span
                aria-hidden="true"
                className={`mines-explosion-sequence-sprite ${className ?? ""}`.trim()}
                style={{
                    backgroundImage: `url(${src})`,
                    backgroundSize: `${columns * 100}% ${rows * 100}%`,
                    backgroundPosition: `${xPercent}% ${yPercent}%`,
                }}
            />
        </span>
    );
};

const getTileState = (
    index: number,
    minePositions: number[],
    revealedTiles: number[],
    explodedMine: number | null,
    revealAllTiles: boolean,
): TileState => {
    if (index === explodedMine) return "exploded";
    if (revealAllTiles && minePositions.includes(index)) return "mine-revealed";
    if (revealAllTiles) return "gem";
    if (revealedTiles.includes(index)) return "gem";
    return "unrevealed";
};

const MinesWindow: React.FC<MinesWindowProps> = ({
    minePositions,
    revealedTiles,
    explodedMine,
    isRoundActive,
    isAutoBetting,
    isAutoSelectionMode,
    showAutoSelectedTiles,
    revealAllTiles,
    pendingRevealTiles,
    autoSelectedTiles,
    canReveal,
    onRevealTile,
    onToggleAutoTile,
    showEndCardGamesNote = false,
    endCardGamesCount = 0,
}) => {
    const isDraggingRef = useRef(false);
    const dragActionRef = useRef<"select" | "deselect">("select");
    const draggedTilesRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        const stop = () => {
            isDraggingRef.current = false;
            draggedTilesRef.current = new Set();
        };
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
        return () => {
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("pointercancel", stop);
        };
    }, []);

    const handleTileAction = (
        index: number,
        isRevealClickable: boolean,
        isSelectClickable: boolean,
    ): void => {
        if (isRevealClickable) {
            onRevealTile(index);
            return;
        }

        if (isSelectClickable) {
            onToggleAutoTile(index);
        }
    };

    React.useEffect(() => {
        const noteId = "mines-end-card-games-note-inline";

        if (!showEndCardGamesNote || endCardGamesCount <= 0) {
            const existing = document.getElementById(noteId);
            existing?.remove();
            return;
        }

        let frameId: number | null = null;
        const maxWaitMs = 1800;
        const startedAt = Date.now();

        const upsertNote = () => {
            const modalCard = document.querySelector(
                ".absolute.inset-0.z-30 .relative.rounded-3xl"
            ) as HTMLElement | null;
            if (!modalCard) {
                if (Date.now() - startedAt < maxWaitMs) {
                    frameId = window.requestAnimationFrame(upsertNote);
                }
                return;
            }

            const payout = modalCard.querySelector(
                "p.font-bold.text-4xl.sm\\:text-5xl.text-primary"
            ) as HTMLElement | null;
            if (!payout) {
                if (Date.now() - startedAt < maxWaitMs) {
                    frameId = window.requestAnimationFrame(upsertNote);
                }
                return;
            }

            let note = modalCard.querySelector(`#${noteId}`) as HTMLParagraphElement | null;
            if (!note) {
                note = document.createElement("p");
                note.id = noteId;
                note.className = "mines-end-card-games-note-inline";
                payout.insertAdjacentElement("afterend", note);
            }

            note.textContent = `(in ${endCardGamesCount} game${endCardGamesCount !== 1 ? "s" : ""})`;
        };

        frameId = window.requestAnimationFrame(upsertNote);

        return () => {
            if (frameId !== null) window.cancelAnimationFrame(frameId);
            document.getElementById(noteId)?.remove();
        };
    }, [showEndCardGamesNote, endCardGamesCount]);

    return (
        <div className="mines-grid-root">
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${BOARD_COLUMNS}, 1fr)`,
                    gridTemplateRows: `repeat(${BOARD_COLUMNS}, minmax(0, 1fr))`,
                    gap: "clamp(8px, 1.2vw, 12px)",
                    width: "100%",
                    height: "100%",
                }}
            >
                {Array.from({ length: BOARD_TILE_COUNT }, (_, i) => {
                    const state = getTileState(i, minePositions, revealedTiles, explodedMine, revealAllTiles);
                    const isRevealClickable = isRoundActive && canReveal && state === "unrevealed" && !isAutoBetting;
                    const isSelectClickable = isAutoSelectionMode && state === "unrevealed";
                    const isManualHoverPreview = !isRoundActive && !isAutoSelectionMode && !isAutoBetting && state === "unrevealed";
                    const isPendingReveal = pendingRevealTiles.includes(i) && state === "unrevealed";
                    const isInteractive = (isRevealClickable && !isPendingReveal) || isSelectClickable;
                    const isAutoSelected = showAutoSelectedTiles && autoSelectedTiles.includes(i);
                    const isManualChosen = !isAutoBetting && !showAutoSelectedTiles && (revealedTiles.includes(i) || i === explodedMine);
                    return (
                        <button
                            key={i}
                            onPointerDown={(event) => {
                                if (!isInteractive) return;
                                event.preventDefault();
                                if (isSelectClickable) {
                                    isDraggingRef.current = true;
                                    dragActionRef.current = autoSelectedTiles.includes(i) ? "deselect" : "select";
                                    draggedTilesRef.current = new Set([i]);
                                }
                                handleTileAction(i, isRevealClickable, isSelectClickable);
                            }}
                            onPointerEnter={() => {
                                if (!isDraggingRef.current || !isAutoSelectionMode || state !== "unrevealed") return;
                                if (draggedTilesRef.current.has(i)) return;
                                draggedTilesRef.current.add(i);
                                const wantSelect = dragActionRef.current === "select";
                                const alreadySelected = autoSelectedTiles.includes(i);
                                if (wantSelect && !alreadySelected) onToggleAutoTile(i);
                                if (!wantSelect && alreadySelected) onToggleAutoTile(i);
                            }}
                            onKeyDown={(event) => {
                                if (!isInteractive) return;
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                handleTileAction(i, isRevealClickable, isSelectClickable);
                            }}
                            disabled={!isInteractive && !isManualHoverPreview}
                            className="mines-tile"
                            data-state={state}
                            data-auto-selected={isAutoSelected ? "true" : "false"}
                            data-auto-mode={showAutoSelectedTiles ? "true" : "false"}
                            data-pending-reveal={isPendingReveal ? "true" : "false"}
                            data-manual-chosen={isManualChosen ? "true" : "false"}
                            aria-label={`Tile ${i + 1}`}
                        >
                            {state === "gem" && (
                                <img
                                    src="/submissions/mines/diamond.svg"
                                    alt="Diamond"
                                    className="mines-tile-icon mines-tile-gem"
                                    draggable={false}
                                />
                            )}
                            {state === "exploded" && (
                                <ExplosionSprite
                                    key={`${i}-explosion`}
                                    src={EXPLOSION_SPRITE_SRC}
                                    frameCount={EXPLOSION_FRAME_COUNT}
                                    columns={EXPLOSION_COLUMNS}
                                    fps={EXPLOSION_FPS}
                                    className="mines-tile-icon mines-explosion-sprite"
                                    showManualFireFrame={!showAutoSelectedTiles && !isAutoBetting}
                                />
                            )}
                            {state === "mine-revealed" && (
                                <img
                                    src="/submissions/mines/bomb.svg"
                                    alt="Bomb"
                                    className="mines-tile-icon mines-tile-mine-icon"
                                    draggable={false}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MinesWindow;
