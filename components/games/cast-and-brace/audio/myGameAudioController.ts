import {
    MAIN_MENU_MUSIC_SRC,
    SOUND_CONFIG,
    type SoundId,
} from "./audioConfig";

const safePlay = (el: HTMLAudioElement): void => {
    void el.play().catch(() => {
        /* autoplay blocked or missing file — ignore */
    });
};

/**
 * Lightweight HTMLAudioElement-based mixer for one game mount.
 * Ambient starts only after {@link MyGameAudioController.unlockFromGesture}.
 * No throws from public methods; safe under autoplay restrictions.
 */
const MAIN_MENU_MUSIC_VOLUME = 0.34;

export class MyGameAudioController {
    private unlocked = false;
    /** When true, loop {@link MAIN_MENU_MUSIC_SRC} instead of lake ambient. */
    private mainMenuMusicDesired = false;
    private mainMenuAudio: HTMLAudioElement | null = null;
    private ambient: HTMLAudioElement | null = null;
    private ambientPlayAttempted = false;
    private tension: HTMLAudioElement | null = null;
    /** Single reel channel — responsive restarts without polyphonic stacking. */
    private reelClick: HTMLAudioElement | null = null;
    private menuSelect: HTMLAudioElement | null = null;
    /** Bite sting — pooled + preloaded so it fires immediately when the phase flips. */
    private biteSignal: HTMLAudioElement | null = null;
    private disposed = false;
    private visibilityHooked = false;
    private readonly onDocumentVisibility = (): void => {
        if (this.disposed || !this.unlocked) {
            return;
        }
        if (document.visibilityState === "visible") {
            void this.tryStartAmbient();
            void this.tryStartMainMenuMusic();
        }
    };

    /** Call from a user gesture (pointer/tap) or immediately after one. */
    unlockFromGesture(): void {
        if (this.disposed) {
            return;
        }
        this.unlocked = true;
        if (!this.visibilityHooked) {
            this.visibilityHooked = true;
            document.addEventListener(
                "visibilitychange",
                this.onDocumentVisibility,
            );
        }
        void this.tryStartAmbient();
        void this.tryStartMainMenuMusic();
        this.preloadBiteSignal();
    }

    /**
     * Warm the bite clip during `waiting` (or after first unlock) so `playBiteSignal` has no decode gap.
     */
    preloadBiteSignal(): void {
        if (this.disposed || this.biteSignal !== null) {
            return;
        }
        const def = SOUND_CONFIG.bite_signal;
        const el = new Audio(def.src);
        el.preload = "auto";
        el.volume = def.volume;
        this.biteSignal = el;
        void el.load();
    }

    /** Pooled bite sting — call at the same instant as `waiting` → `bite`. */
    playBiteSignal(): void {
        if (this.disposed) {
            return;
        }
        const def = SOUND_CONFIG.bite_signal;
        if (this.biteSignal === null) {
            const el = new Audio(def.src);
            el.preload = "auto";
            el.volume = def.volume;
            this.biteSignal = el;
        }
        const el = this.biteSignal;
        el.volume = def.volume;
        try {
            el.currentTime = 0;
        } catch {
            /* ignore */
        }
        safePlay(el);
    }

    /**
     * Drive main-menu loop: `true` while the entry parchment is open, `false` otherwise.
     * Lake ambient stays paused while menu music is active.
     */
    setMainMenuMusicDesired(desired: boolean): void {
        if (this.disposed) {
            return;
        }
        this.mainMenuMusicDesired = desired;
        if (!desired) {
            this.pauseMainMenuMusic();
            void this.tryStartAmbient();
            return;
        }
        void this.tryStartMainMenuMusic();
    }

    /**
     * Keeps the lake loop running across phases after audio was unlocked
     * (handles tab backgrounding, failed first `play()`, etc.).
     */
    ensureLakeAmbient(): void {
        void this.tryStartAmbient();
    }

    /** Lake loop only after an explicit user-gesture unlock. */
    private tryStartAmbient(): void {
        if (this.disposed || !this.unlocked) {
            return;
        }
        if (this.mainMenuMusicDesired) {
            return;
        }
        if (this.ambientPlayAttempted && this.ambient && !this.ambient.paused) {
            return;
        }
        const def = SOUND_CONFIG.lake_ambient_loop;
        if (this.ambient === null) {
            const el = new Audio(def.src);
            el.loop = def.loop === true;
            el.preload = "auto";
            el.volume = def.volume;
            this.ambient = el;
        }
        this.ambientPlayAttempted = true;
        if (this.ambient) {
            safePlay(this.ambient);
        }
    }

    private pauseMainMenuMusic(): void {
        if (this.mainMenuAudio === null) {
            return;
        }
        this.mainMenuAudio.pause();
    }

    private tryStartMainMenuMusic(): void {
        if (this.disposed || !this.unlocked || !this.mainMenuMusicDesired) {
            return;
        }
        if (this.mainMenuAudio !== null && !this.mainMenuAudio.paused) {
            return;
        }
        if (this.mainMenuAudio === null) {
            const el = new Audio(MAIN_MENU_MUSIC_SRC);
            el.loop = true;
            el.preload = "auto";
            el.volume = MAIN_MENU_MUSIC_VOLUME;
            this.mainMenuAudio = el;
        }
        if (this.ambient !== null && !this.ambient.paused) {
            this.ambient.pause();
        }
        if (this.mainMenuAudio) {
            safePlay(this.mainMenuAudio);
        }
    }

    /**
     * One-shot SFX. Does **not** start ambient — ambient is unlock-only.
     */
    playOneShot(id: SoundId): void {
        if (this.disposed) {
            return;
        }
        if (
            id === "lake_ambient_loop" ||
            id === "line_tension_loop" ||
            id === "reel_click" ||
            id === "bite_signal" ||
            id === "menu_select"
        ) {
            return;
        }
        const def = SOUND_CONFIG[id];
        const el = new Audio(def.src);
        el.loop = def.loop === true;
        el.volume = def.volume;
        if (id === "jackpot_win") {
            el.playbackRate = 1.03;
            el.volume = Math.min(1, def.volume);
        }
        safePlay(el);
    }

    /**
     * Single shared reel element: each tap rewinds and plays so layers never pile up.
     * No-op until {@link unlockFromGesture} has run (autoplay-safe).
     */
    /** UI button / chip taps — pooled so rapid clicks don’t allocate. */
    playMenuSelect(): void {
        if (this.disposed) {
            return;
        }
        const def = SOUND_CONFIG.menu_select;
        if (this.menuSelect === null) {
            const el = new Audio(def.src);
            el.preload = "auto";
            this.menuSelect = el;
        }
        const el = this.menuSelect;
        el.volume = def.volume;
        try {
            el.currentTime = 0;
        } catch {
            /* ignore */
        }
        safePlay(el);
    }

    playReelClick(): void {
        if (this.disposed || !this.unlocked) {
            return;
        }
        const def = SOUND_CONFIG.reel_click;
        if (this.reelClick === null) {
            this.reelClick = new Audio(def.src);
            this.reelClick.preload = "auto";
        }
        const el = this.reelClick;
        el.volume = Math.min(
            1,
            def.volume * (0.94 + Math.random() * 0.12),
        );
        el.playbackRate = 0.97 + Math.random() * 0.06;
        try {
            el.currentTime = 0;
        } catch {
            /* ignore */
        }
        safePlay(el);
    }

    /**
     * Starts the tension loop if not already playing. Never stacks or restarts
     * while the same loop instance is audible.
     */
    startLineTension(): void {
        if (this.disposed) {
            return;
        }
        if (this.tension !== null) {
            if (!this.tension.paused) {
                return;
            }
            safePlay(this.tension);
            return;
        }
        const def = SOUND_CONFIG.line_tension_loop;
        const el = new Audio(def.src);
        el.loop = def.loop === true;
        el.preload = "auto";
        el.volume = def.volume;
        this.tension = el;
        safePlay(el);
    }

    stopLineTension(): void {
        if (this.tension === null) {
            return;
        }
        this.tension.pause();
        try {
            this.tension.currentTime = 0;
        } catch {
            /* ignore */
        }
    }

    /**
     * Stops reel tension for reset / phase changes.
     * Ambient keeps running for menu ↔ gameplay continuity.
     */
    resetGameplayAudio(): void {
        this.stopLineTension();
    }

    dispose(): void {
        this.disposed = true;
        if (this.visibilityHooked) {
            this.visibilityHooked = false;
            document.removeEventListener(
                "visibilitychange",
                this.onDocumentVisibility,
            );
        }
        if (this.mainMenuAudio !== null) {
            this.mainMenuAudio.pause();
            this.mainMenuAudio.src = "";
            this.mainMenuAudio = null;
        }
        this.mainMenuMusicDesired = false;
        if (this.ambient !== null) {
            this.ambient.pause();
            this.ambient.src = "";
            this.ambient = null;
        }
        if (this.tension !== null) {
            this.tension.pause();
            this.tension.src = "";
            this.tension = null;
        }
        if (this.reelClick !== null) {
            this.reelClick.pause();
            this.reelClick.src = "";
            this.reelClick = null;
        }
        if (this.menuSelect !== null) {
            this.menuSelect.pause();
            this.menuSelect.src = "";
            this.menuSelect = null;
        }
        if (this.biteSignal !== null) {
            this.biteSignal.pause();
            this.biteSignal.src = "";
            this.biteSignal = null;
        }
        this.unlocked = false;
        this.ambientPlayAttempted = false;
    }
}
