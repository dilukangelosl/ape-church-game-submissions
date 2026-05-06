"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Cinzel } from "next/font/google";
import { entryScreenCopy } from "./config/outcomes";
import {
    formatChartFrequency,
    formatChartMultiplier,
    outcomesBySortOrder,
} from "./config/outcomeResolve";
import OutcomeImage from "./OutcomeImage";
import "./my-game.styles.css";

const fantasyCaps = Cinzel({
    subsets: ["latin"],
    weight: ["600", "700"],
    display: "swap",
});

export interface ManifestOverlayProps {
    open: boolean;
    onClose: () => void;
}

const ManifestOverlay: React.FC<ManifestOverlayProps> = ({
    open,
    onClose,
}) => {
    if (!open) {
        return null;
    }

    return (
        <div
            className={`cast-entry-overlay cast-entry-overlay--visible cast-entry-overlay--codex pointer-events-auto ${fantasyCaps.className}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cast-manifest-title"
        >
            <div className="cast-parchment cast-parchment--manifest cast-codex cast-entry-animate-in">
                <div className="cast-parchment__rim cast-codex__rim" aria-hidden />
                <div className="cast-parchment__inner cast-parchment__inner--manifest cast-codex__inner">
                    <header className="cast-codex__masthead shrink-0">
                        <div className="cast-codex__masthead-top">
                            <h1
                                id="cast-manifest-title"
                                className="cast-codex__title"
                            >
                                {entryScreenCopy.codexTitle}
                            </h1>
                            <button
                                type="button"
                                className="cast-parchment-btn cast-parchment-btn--ghost cast-codex__back"
                                onClick={onClose}
                            >
                                {entryScreenCopy.codexBack}
                            </button>
                        </div>
                    </header>
                    <div className="cast-codex__scroll">
                        <ul className="cast-codex-grid">
                            {outcomesBySortOrder.map((o) => (
                                <li
                                    key={o.id}
                                    className={cn(
                                        "cast-codex-entry",
                                        o.id === "koko_monster" &&
                                            "cast-codex-entry--koko",
                                    )}
                                >
                                    <div className="cast-codex-entry__frame">
                                        <OutcomeImage
                                            outcome={o}
                                            alt={o.displayName}
                                            width={128}
                                            height={128}
                                            portraitScale={
                                                o.id === "koko_monster"
                                                    ? 1
                                                    : undefined
                                            }
                                            className="cast-codex-entry__img mx-auto max-h-[min(112px,30dvh)] max-w-full w-auto object-contain"
                                        />
                                    </div>
                                    <div className="cast-codex-entry__ledger">
                                        <h2 className="cast-codex-entry__name">
                                            {o.displayName}
                                        </h2>
                                        <div className="cast-codex-entry__badges">
                                            <span className="cast-codex-badge cast-codex-badge--tier">
                                                {o.tier}
                                            </span>
                                            <span className="cast-codex-badge cast-codex-badge--type">
                                                {o.type}
                                            </span>
                                        </div>
                                        <dl className="cast-codex-entry__stats">
                                            <div className="cast-codex-stat">
                                                <dt className="cast-codex-stat__k">
                                                    {
                                                        entryScreenCopy.codexStatMultiplier
                                                    }
                                                </dt>
                                                <dd className="cast-codex-stat__v">
                                                    {formatChartMultiplier(
                                                        o.multiplier,
                                                    )}
                                                </dd>
                                            </div>
                                            <div className="cast-codex-stat">
                                                <dt className="cast-codex-stat__k">
                                                    {
                                                        entryScreenCopy.codexStatFrequency
                                                    }
                                                </dt>
                                                <dd className="cast-codex-stat__v">
                                                    {formatChartFrequency(
                                                        o.frequency,
                                                    )}
                                                </dd>
                                            </div>
                                        </dl>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManifestOverlay;
