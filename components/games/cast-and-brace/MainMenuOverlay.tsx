"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Cinzel } from "next/font/google";
import { entryScreenCopy, menuLogoPublicPath } from "./config/outcomes";
import "./my-game.styles.css";

const fantasyCaps = Cinzel({
    subsets: ["latin"],
    weight: ["600", "700"],
    display: "swap",
});

export interface MainMenuOverlayProps {
    open: boolean;
    onLetsBrace: () => void;
    onOpenManifest: () => void;
}

const MainMenuOverlay: React.FC<MainMenuOverlayProps> = ({
    open,
    onLetsBrace,
    onOpenManifest,
}) => {
    const [logoFailed, setLogoFailed] = useState(false);

    useEffect(() => {
        if (open) {
            queueMicrotask(() => setLogoFailed(false));
        }
    }, [open]);

    if (!open) {
        return null;
    }

    return (
        <div
            className={`cast-entry-overlay cast-entry-overlay--visible cast-entry-overlay--menu pointer-events-auto ${fantasyCaps.className}`}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
        >
            <div className="cast-parchment cast-parchment--menu cast-entry-animate-in">
                <div className="cast-parchment__rim" aria-hidden />
                <div className="cast-parchment__inner cast-parchment__inner--menu">
                    <div className="cast-parchment__logo-wrap">
                        {!logoFailed ? (
                            <Image
                                src={menuLogoPublicPath()}
                                alt=""
                                width={416}
                                height={144}
                                className="cast-parchment__logo cast-parchment__logo--menu-hero"
                                priority
                                unoptimized
                                onError={() => setLogoFailed(true)}
                            />
                        ) : (
                            <div
                                className="cast-parchment__logo cast-parchment__logo--menu-hero cast-parchment__logo-fallback"
                                aria-hidden
                            />
                        )}
                    </div>
                    <div className="cast-parchment__rule" aria-hidden />
                    <div className="cast-parchment__actions">
                        <div className="cast-parchment__action-block">
                            <button
                                type="button"
                                className="cast-parchment-btn cast-parchment-btn--primary"
                                onClick={onLetsBrace}
                            >
                                <span className="cast-parchment-btn__label">
                                    {entryScreenCopy.primaryCta}
                                </span>
                            </button>
                            <p className="cast-parchment__hint">
                                {entryScreenCopy.primaryCtaHint}
                            </p>
                        </div>
                        <div className="cast-parchment__action-block">
                            <button
                                type="button"
                                className="cast-parchment-btn cast-parchment-btn--secondary"
                                onClick={onOpenManifest}
                            >
                                <span className="cast-parchment-btn__label">
                                    {entryScreenCopy.secondaryCta}
                                </span>
                            </button>
                            <p className="cast-parchment__hint">
                                {entryScreenCopy.secondaryCtaHint}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MainMenuOverlay;
