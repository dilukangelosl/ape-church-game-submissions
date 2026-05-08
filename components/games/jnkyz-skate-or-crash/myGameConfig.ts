import { Game } from "@/lib/games";

export const myGame: Game = {
    title: "Skate or Crash",
    description: "A crash game where JNKY keeps skating until a sudden wipeout.",
    gameAddress: "0x1234567890123456789012345678901234567890",
    gameBackground: "/submissions/jnkyz-skate-or-crash/background.webp",
    // animatedBackground: "/submissions/jnkyz-skate-or-crash/animated-background.mp4",
    card: "/submissions/jnkyz-skate-or-crash/card.png", // 1:1 aspect ratio (e.g. 512x512)
    banner: "/submissions/jnkyz-skate-or-crash/banner.png", // 2:1 aspect ratio (e.g. 1024x512)
    themeColorBackground: "#22c55e",
    song: "/submissions/jnkyz-skate-or-crash/audio/dark-ripples_main-full.ogg",
    payouts: {
        0: {
            0: {
                0: 10000,
            },
        },
    },
};