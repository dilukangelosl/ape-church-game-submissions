import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getGameMetadata } from '@/lib/getGameMetadata'
import StatusBadge from '@/components/shared/StatusBadge'
import { cn } from '@/lib/utils'

interface Props {
    params: Promise<{ partner: string; game: string }>
    children: React.ReactNode
}

export default async function GameLayout({ params, children }: Props) {
    const { partner, game } = await params
    const metadata = await getGameMetadata(partner, game)
    const title = metadata?.displayTitle ?? game

    // Games built on the HUD render their own bordered frame with a title bar
    // in it, so this route must not stack a second title above it, and the
    // frame wants the full width. Everything else — including every game
    // submitted before the HUD existed, which has no `layout` field — keeps
    // the original chrome untouched.
    const isHud = metadata?.layout === 'hud'

    return (
        <div
            className={cn(
                'w-full max-w-6xl mx-auto',
                // Match the platform's HUD page shell: give back half the
                // container gutter and raise the cap so the stage is the same
                // width reviewers will see in production.
                isHud && 'lg:-mx-6 lg:w-auto lg:max-w-[1488px]'
            )}
        >
            <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to all game submissions
            </Link>

            {/* HUD games: the status badge still belongs to the review chrome,
                but the title comes from the game's own HUD bar. */}
            {isHud ? (
                metadata?.status && (
                    <div className="mb-1 sm:mb-2">
                        <StatusBadge status={metadata.status} />
                    </div>
                )
            ) : (
                <div className="flex items-center gap-3 mb-1 sm:mb-2">
                    <h1 className="text-3xl font-semibold">{title}</h1>
                    {metadata?.status && <StatusBadge status={metadata.status} />}
                </div>
            )}

            {metadata?.authors && metadata.authors.length > 0 && (
                <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
                    by{' '}
                    {metadata.authors.map((a, i) => (
                        <span key={a.telegram ?? a.name}>
                            {i > 0 && ', '}
                            {a.telegram ? (
                                <a
                                    href={`https://t.me/${a.telegram}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    {a.name}
                                </a>
                            ) : (
                                a.name
                            )}
                        </span>
                    ))}
                    {metadata.version && (
                        <span className="ml-2 text-xs text-muted-foreground/60">
                            v{metadata.version}
                        </span>
                    )}
                </p>
            )}

            {children}
        </div>
    )
}
