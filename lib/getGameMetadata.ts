import fs from 'fs'
import path from 'path'

export interface GameAuthor {
    name: string
    telegram: string
}

/**
 * Desktop layout a game was built for. Mirrors `GameLayout` in
 * ape-church-game-template's myGameConfig.ts.
 *
 * "hud" is the current standard: the game renders its own GameHud frame, which
 * draws the title bar, so the preview route drops its duplicate <h1> and
 * widens the container.
 *
 * OPTIONAL and absent from every game submitted before the HUD existed —
 * `undefined` means the legacy layout, which must keep rendering exactly as it
 * always has. Never make this required.
 */
export type GameLayout = 'hud' | 'two-column' | 'full-size'

export interface GameMetadata {
    team: string
    gameName: string
    displayTitle: string
    description: string
    version: string
    authors: GameAuthor[]
    status: string
    category: string
    tags: string[]
    thumbnail: string
    banner: string
    mainComponent: string
    windowComponent: string
    setupComponent: string
    submittedAt: string
    approvedAt?: string
    /** See GameLayout. Absent on every pre-HUD submission — treat as legacy. */
    layout?: GameLayout
}

export async function getAllGameMetadata(): Promise<GameMetadata[]> {
    const submissionsDir = path.join(process.cwd(), 'submissions')
    const games: GameMetadata[] = []

    if (!fs.existsSync(submissionsDir)) return games

    const partners = fs.readdirSync(submissionsDir)

    for (const partner of partners) {
        const partnerDir = path.join(submissionsDir, partner)
        if (!fs.statSync(partnerDir).isDirectory()) continue

        const gameFolders = fs.readdirSync(partnerDir)

        for (const gameFolder of gameFolders) {
            const metadataPath = path.join(partnerDir, gameFolder, 'metadata.json')
            if (!fs.existsSync(metadataPath)) continue

            const raw = fs.readFileSync(metadataPath, 'utf-8')
            const metadata = JSON.parse(raw) as GameMetadata
            games.push(metadata)
        }
    }

    return games
}

export async function getGameMetadata(team: string, gameName: string): Promise<GameMetadata | null> {
    const metadataPath = path.join(process.cwd(), 'submissions', team, gameName, 'metadata.json')
    if (!fs.existsSync(metadataPath)) return null

    const raw = fs.readFileSync(metadataPath, 'utf-8')
    return JSON.parse(raw) as GameMetadata
}
