# Ape Church Game Submissions

This repository is the **intake and preview platform** for games built by Ape Church partners. Submitted games are reviewed here and, once approved, manually integrated into the live platform.

You can browse all submitted games at **[submissions.ape.church](https://submissions.ape.church)** *(update with your Vercel URL)*.

---

## Before You Start

You will need:
- A GitHub account
- Your game built using the official game template
- All assets compressed and ready (WebP or PNG, MP3 or OGG — no WAV files)

Game template: **[ape-church-game-template](https://github.com/ape-church/ape-church-game-template)**

---

## Submission Flow

### Step 1 — Build your game using the template

Go to the game template repository and click **"Use this template"** → **"Create a new repository"**. This creates a clean copy in your GitHub account.

Build your game inside the template. The files you will submit are:

```
components/games/your-game-name/     ← your game components
public/submissions/your-game-name/   ← your game assets
```

Follow all lifecycle and structure requirements in the template README before submitting.

---

### Step 2 — Fork this repository

Fork `ape-church-game-submissions` into your GitHub account. Your PR will come from this fork.

---

### Step 3 — Add your game files

In your fork, add exactly these files — nothing else:

```
components/
  games/
    your-game-name/
      YourGame.tsx
      YourGameWindow.tsx
      YourGameSetupCard.tsx
      yourGameConfig.ts       ← optional, for game configuration constants
      ... (any other game components)

public/
  submissions/
    your-game-name/
      card.png          ← REQUIRED, 1:1 aspect ratio (e.g. 512x512)
      banner.png        ← REQUIRED, 2:1 aspect ratio (e.g. 1024x512)
      ... (other assets)

submissions/
  your-team-name/
    your-game-name/
      metadata.json   ← REQUIRED, see schema below
```

> **One game per PR.** Do not include files from multiple games in a single pull request.

**Using an AI agent to copy your files?**

If you're using Claude Code, Cursor, or another AI coding agent, you can ask it to copy your files automatically. Clone this submissions repo locally, open your agent inside it, and send this prompt:

```
I have a game I built in the Ape Church game template repo.
It is located at: [path to your template repo on your machine]
e.g. ../my-game-repo or /Users/yourname/projects/my-game-repo

My game name is: [your-game-name] (kebab-case)
My team name is: [your-team-name] (kebab-case)

Please copy the following files from my template repo into
this submissions repo in the correct structure:

From template:
  components/my-game/ → components/games/[your-game-name]/
  public/my-game/ → public/submissions/[your-game-name]/
  metadata.json → submissions/[your-team-name]/[your-game-name]/metadata.json

Do not copy any other files. After copying, confirm what
was moved and check that the folder names match exactly.
```

**`my-game` vs `app/` — what to rename, what not to touch**

- In the **template repo**, the sample game folder is often named `components/my-game/` (and `public/my-game/`). That name is only a **placeholder**. When you submit here, your game must live under `components/games/<your-game-slug>/` and assets under `public/submissions/<your-game-slug>/`, matching `metadata.json`.
- In **your game’s own files** (everything under `components/games/<your-game-slug>/`), update **static asset URLs** to `/submissions/<your-game-slug>/...`. Do not ship paths that still say `/my-game/` — those will 404 on the preview site.
- **"Do not modify `app/` / `lib/`"** (when the template says that) refers to **platform wiring** the this app uses to load games. Those directories are **not part of your submission** (see [Do Not Include](#do-not-include) below). It does **not** mean you cannot edit your game components; it means maintainers integrate your game separately. Your `.tsx` files under `components/games/<slug>/` are yours to change freely, including imports and asset paths.

After the agent runs, verify the structure matches the file tree above before moving on.

---

### Step 4 — Review your metadata.json

Your `metadata.json` was copied over from the template in the previous step. Open `submissions/your-team-name/your-game-name/metadata.json` and verify:

- All fields are filled in with your game's actual information
- `team` and `gameName` match your folder names exactly
- `submittedAt` is updated to today's date in `YYYY-MM-DD` format
- `status` is `"pending"` — do not change this
- `revenueShare` is filled out with correct names, telegram usernames, and ERC-20 addresses
- All `share` values add up to exactly 100
- `address` must be a valid ERC-20 address to receive Ape Coin — double-check this carefully, payments are sent to this address automatically
- `layout` is `"hud"` if your game is built on the Game HUD (see below)

---

### Step 4b — Declare your layout

If your game is built on the **Game HUD** — the platform's standard desktop layout, and what the template ships by default — add this to `metadata.json`:

```json
"layout": "hud"
```

That tells the preview site your game draws its own framed HUD with a title bar in it, so this site drops its duplicate page title and widens the container to give the stage its full production width.

The field is **optional**. Leave it out and your game renders in the legacy layout exactly as before — every game submitted before the HUD existed does this and nothing about them changed. Valid values are `hud`, `two-column` and `full-size`; the latter two are legacy and will produce a warning on your PR asking you to explain why the HUD doesn't fit.

One thing to keep in sync: on the HUD the title comes from **your game config** (the `title` you pass to `GameHud`, normally `game.title`), not from `displayTitle` in `metadata.json` — the same as on the live platform. Make the two match, or reviewers will see a different name in the frame than on the submissions index.

Your game ports across unchanged: `components/shared/GameHud.tsx` here is API-identical to the template's, and `hudMode` is supported on both `GameWindow` and `WideGameWindow`. The one thing to check is that you import shared components with the `@/` alias — `import GameHud from '@/components/shared/GameHud'`, never `'../shared/GameHud'`, which stops resolving once your folder moves under `components/games/`.

The full layout spec is `docs/GAME-HUD.md` in the template repo.

---

### Step 5 — Open a Pull Request

Open a PR from your fork to the `main` branch of this repository.

**PR title format:** `[Team Name] Game Name` — e.g. `[Balloons] Ape Strong`

When you open the PR, automated checks will run immediately. All checks must pass before your submission will be reviewed. If a check fails, the error message will tell you exactly what to fix.

---

## Review Process

1. Automated checks run on your PR — fix any failures before waiting for review
2. Our team reviews your code and leaves feedback directly on the PR
3. Make any requested changes in your fork — the PR updates automatically
4. Once approved, our team merges the PR and your game appears on the preview site
5. Approved games are manually integrated into the live platform

> Merging a PR does not guarantee production deployment. Approval and live launch are separate steps.

---

## For reviewers

These steps are for **maintainers** who need to check out a submission PR locally, fix or verify something, and push updates as an integration branch on `origin` (for CI or handoff), without merging the contributor’s fork directly.

1. **Fetch the PR into a local branch.** Replace `<PR_NUMBER>` with the GitHub pull request number. Replace `review/<short-name>` with a local branch label you will recognize (often the game slug in kebab-case).

   ```bash
   git fetch origin pull/<PR_NUMBER>/head:review/<short-name>
   git checkout review/<short-name>
   ```

   Example for PR `5` and a local branch `review/asen-vox-pai-gow`:

   ```bash
   git fetch origin pull/5/head:review/asen-vox-pai-gow
   git checkout review/asen-vox-pai-gow
   ```

   *Note* — `npm run dev` regenerates `lib/gameRegistry.ts` automatically (via the `predev` hook) so new submissions appear locally. Production builds do the same via `prebuild`. Do not commit `lib/gameRegistry.ts`; it is overwritten on every dev/build.

2. **Make your changes**, then commit and **push the same local branch to a feature branch on `origin`** (adjust the remote branch name to match your team’s naming, e.g. `feat/add-<game-slug>`):

   ```bash
   git add path/to/changed-file
   git commit -m "fix: short description of the change"
   git push origin review/<short-name>:refs/heads/feat/add-<game-slug>
   ```

   Example mirroring a local `review/dead-draw` branch to `feat/add-dead-draw`:

   ```bash
   git add submissions/example-team/dead-draw/metadata.json
   git commit -m "fix: correct metadata.json closing bracket"
   git push origin review/dead-draw:refs/heads/feat/add-dead-draw
   ```

The `git push origin local:refs/heads/remote` form creates (or updates) the named branch on `origin` from your current local branch tip without renaming your local checkout.

---

## Do Not Include

The following will cause your PR checks to fail:

- `package.json`, `package-lock.json`
- `next.config.ts` or `next.config.js`
- `tsconfig.json`
- Any files in `app/`, `lib/`, or `components/games/shared/`
- `.wav` audio files (use MP3 or OGG)

---

## Questions or Issues

If you have questions while building or run into submission issues:

- **Email:** [ministry@ape.church](mailto:ministry@ape.church)
- **Telegram:** [https://t.me/+wgoE4TSxxcM5Njdh](https://t.me/+wgoE4TSxxcM5Njdh)
- **Discord:** [https://discord.gg/3Jxeeqt59W](https://discord.gg/3Jxeeqt59W)

When reaching out, include your PR link and a description of the issue.
