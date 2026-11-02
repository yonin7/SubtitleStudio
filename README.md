# SubtitleStudio

Professional subtitle translation & editing desktop app — foreign language → Hebrew, with AI translation, chunk control, and timing tools.

Built with **Electron + React + TypeScript** (via `electron-vite`).

## Architecture

```
src/
├── shared/            # Framework-agnostic, used by main + renderer
│   ├── types/         # Domain + IPC contract (single source of truth)
│   ├── lib/           # Pure logic: parser, writer, timecode, chunks, bridge
│   ├── prompts/       # AI agent prompt builders
│   └── constants.ts   # Defaults + tunables
├── main/              # Electron main process (Node)
│   ├── services/      # settings (electron-store), file I/O, AI providers
│   └── ipc/           # Typed IPC handlers
├── preload/           # Secure context-bridge (window.electronAPI)
└── renderer/          # React UI
    └── src/
        ├── store/     # Zustand app store + orchestration
        ├── lib/       # Translation engine (drives chunk loop via IPC)
        ├── components/
        └── features/  # editor · chunkMap · settings
```

Design principles: **one source of truth** (subtitles live in a single flat
array; chunks reference index ranges), **shared types** across processes, and
**pure, testable core logic** separated from UI and I/O.

## Prerequisites

- Node.js 20+ (developed on 22)
- API keys (free): [Google Gemini](https://ai.google.dev), optionally
  [Groq](https://console.groq.com) and [TMDB](https://www.themoviedb.org/settings/api).

## Setup

```bash
npm install
cp .env.example .env   # then fill in your keys
npm run dev            # launch the app with HMR
```

Keys live only in `.env` (git-ignored) and are read exclusively by the main
process — never exposed to the renderer.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run the app in development with hot reload |
| `npm run build` | Type-check-free bundle of all three processes |
| `npm run typecheck` | `tsc --noEmit` across the project |
| `npm test` | Run the Vitest unit suite |
| `npm run package:win` / `:mac` / `:linux` | Build distributables |

## Status

**Phase 1 (MVP) — complete:** open SRT/VTT/ASS/SSA, auto-chunk, sequential
AI translation (Gemini → Groq fallback) with continuity bridge, inline RTL
editing, chunk map, and SRT/VTT/TXT/CSV/JSON export.

**Next:** Character Intelligence Agent + metadata providers (AniList / Jikan /
TVMaze / Wikidata / optional TMDB), Director/Glossary/Reviewer agents, session
resume, sync wizard, and QA dashboard.
