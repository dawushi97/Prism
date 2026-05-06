# Prism: Claude Code Session Viewer

Prism is a local-first browser viewer for Claude Code session transcripts. Drop in Claude `.jsonl` files and inspect the full run as a compact timeline with sidechain context, tool calls, markdown rendering, focus filters, and raw metadata.

Live demo: [Prism app](https://dawushi97.github.io/Prism/)

> Inspired by [openai/euphony](https://github.com/openai/euphony), but focused on observed Claude Code session logs rather than Harmony/Codex transcripts.

## What Changed Recently

- Redesigned the app shell around a compact flat UI.
- Added multi-conversation rendering with list and grid layouts.
- Added a draggable Preferences panel with max message height, layout, timestamp, and focus controls.
- Added tri-state Focus Mode for author, recipient, and content type filtering.
- Added markdown rendering with sanitized GFM output.
- Added metadata inspection for sessions and individual messages.
- Added sidechain/subagent handling and companion `.meta.json` support.
- Added a public GitHub Pages build with a preloaded mock session and compact feature overview.

## Features

| Feature | What it does |
| --- | --- |
| Claude session parser | Parses Claude Code JSONL logs into normalized conversations. |
| Timeline viewer | Renders user, assistant, tool call, tool result, thinking, and event messages. |
| Multi-session workspace | Loads several JSONL files and keeps each conversation visible. |
| Sidechain awareness | Labels and filters subagent / sidechain messages. |
| Local file loading | Supports drag-and-drop and local file selection for `.jsonl` and companion `.meta.json` files. |
| Markdown toggle | Switches assistant text between plain text and sanitized markdown. |
| Focus Mode | Includes or excludes messages by role, recipient tool, or content type. |
| Metadata sidebar | Shows message/session raw JSON, counts, warnings, and metadata. |
| Share and export | Copies shareable URLs or conversation JSON, downloads sessions, and opens a render view. |
| GitHub Pages deploy | Builds with Vite and deploys `dist/` through GitHub Actions. |

## Tech Stack

- [Lit](https://lit.dev/) for Web Components
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for dev/build
- [Marked](https://marked.js.org/) and [DOMPurify](https://github.com/cure53/DOMPurify) for markdown
- [Lucide](https://lucide.dev/) icons
- [Vitest](https://vitest.dev/) for parser and UI tests

## Get Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Load A Session

Claude Code session logs are usually stored under Claude project/session directories as `.jsonl` files. In Prism:

1. Drop one or more `.jsonl` files into the header drop area.
2. Or open the actions menu and choose local files.
3. Click `Load` to parse and render the conversations.

If you also have a matching `.meta.json`, load it alongside the JSONL file to populate subagent metadata.

## Preferences

Open Preferences from the settings icon in the header.

- `Max message height`: automatic, no limit, or a custom pixel height.
- `Layout`: list view or grid view, with grid width synced into `?grid=<width>`.
- `Message labels`: toggle absolute timestamps.
- `Focus mode`: include or exclude author roles, recipient tools, and content types.

The panel is draggable and closes with the close button or `Escape`.

## Focus Mode

Focus chips have three states:

- `neutral`: ignored
- `include`: selected with click
- `exclude`: selected with `Shift+Click`

Within one field, multiple includes are ORed. Across fields, active includes are ANDed. Excludes win before includes.

When strict focus is off, non-matching messages stay as folded placeholders. When strict focus is on, non-matching messages are removed from the visible timeline.

## Build And Test

```bash
npm test
npm run build
```

Production assets are written to `dist/`.

## Deploy To GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`.

On every push to `main`, GitHub Actions:

1. installs dependencies with `npm ci`
2. builds the app with `npm run build`
3. uploads `dist/` as a Pages artifact
4. deploys it to GitHub Pages

The Vite base is set to `./` so the static assets work from the project Pages path.

## Architecture

```text
src/
├── prism-app.ts                 # Root application shell, file loading, filters
├── types/prism.ts               # Shared normalized types
├── adapters/claude/parser.ts    # Claude JSONL -> NormalizedConversation
├── components/
│   ├── prism-timeline.ts        # Conversation timeline and actions
│   ├── prism-message-card.ts    # Expanded message renderer
│   ├── prism-message-hidden.ts  # Folded message placeholder
│   ├── prism-message-text.ts    # Plain text / markdown renderer
│   ├── prism-metadata-panel.ts  # Metadata sidebar
│   └── prism-preference-panel.ts # Preferences and focus controls
└── utils/
    ├── markdown.ts              # Marked + DOMPurify pipeline
    └── icons.ts                 # Lucide icon helper
```

## Privacy

Prism parses files in the browser. The app does not upload your session JSONL files to a server as part of normal use.

## License

MIT
