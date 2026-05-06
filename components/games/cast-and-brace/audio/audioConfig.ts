/** Packaged SFX under `public/submissions/cast-and-brace/sfx/` (MP3/OGG only). */
const SFX = "/submissions/cast-and-brace/sfx" as const;

/** Entry parchment loop — `public/submissions/cast-and-brace/audio/main_menu_music.mp3`. */
export const MAIN_MENU_MUSIC_SRC =
    "/submissions/cast-and-brace/audio/main_menu_music.mp3";

export type SoundId =
    | "cast_whoosh"
    | "hook_splash_small"
    | "lake_ambient_loop"
    | "fish_swim_pass"
    | "bubble_pop_soft"
    | "bite_signal"
    | "menu_select"
    | "reel_click"
    | "line_tension_loop"
    | "reveal_lose"
    | "reveal_win"
    | "jackpot_win";

export type SoundConfig = {
    id: SoundId;
    src: string;
    loop?: boolean;
    volume: number;
};

export const SOUND_CONFIG: Record<SoundId, SoundConfig> = {
    cast_whoosh: {
        id: "cast_whoosh",
        src: `${SFX}/cast_whoosh.mp3`,
        volume: 0.7,
    },
    hook_splash_small: {
        id: "hook_splash_small",
        src: `${SFX}/hook_splash_small.mp3`,
        volume: 0.65,
    },
    lake_ambient_loop: {
        id: "lake_ambient_loop",
        src: `${SFX}/lake_ambient_loop.mp3`,
        loop: true,
        volume: 0.18,
    },
    fish_swim_pass: {
        id: "fish_swim_pass",
        src: `${SFX}/fish_swim_pass.mp3`,
        volume: 0.22,
    },
    bubble_pop_soft: {
        id: "bubble_pop_soft",
        src: `${SFX}/bubble_pop_soft.mp3`,
        volume: 0.18,
    },
    bite_signal: {
        id: "bite_signal",
        src: `${SFX}/bite_signal.mp3`,
        volume: 0.72,
    },
    menu_select: {
        id: "menu_select",
        src: `${SFX}/menu_select.mp3`,
        volume: 0.42,
    },
    reel_click: {
        id: "reel_click",
        src: `${SFX}/reel_click.mp3`,
        volume: 0.45,
    },
    line_tension_loop: {
        id: "line_tension_loop",
        src: `${SFX}/line_tension_loop.mp3`,
        loop: true,
        volume: 0.32,
    },
    reveal_lose: {
        id: "reveal_lose",
        src: `${SFX}/reveal_lose.mp3`,
        volume: 0.6,
    },
    reveal_win: {
        id: "reveal_win",
        src: `${SFX}/reveal_win.mp3`,
        volume: 0.72,
    },
    jackpot_win: {
        id: "jackpot_win",
        src: `${SFX}/jackpot_win.mp3`,
        volume: 0.9,
    },
};
