# Prism: Claude Code Session Viewer

Visualize Claude Code sessions in your browser

> Inspired by [openai/euphony](https://github.com/openai/euphony) — a Harmony Chat and Codex Session Viewer. Prism adapts the same idea for the Claude Code ecosystem: drop in a session JSONL file and instantly explore the full conversation timeline.

## Features

| Feature | What it does |
|---------|-------------|
| Claude session parser | Parses Claude Code JSONL session logs into a normalized conversation timeline. |
| Message timeline | Renders user, assistant, tool call, tool result, thinking, and system event messages with role-colored rails and chips. |
| Sidechain detection | Identifies and labels subagent / sidechain messages for multi-agent sessions. |
| Flexible loading | Loads data from local `.jsonl` files, clipboard paste, or remote HTTP(S) URLs. |
| Markdown rendering | Toggleable GFM markdown rendering with DOMPurify sanitization. |
| Focus mode | Filters visible messages by author role, recipient tool, or content type — with an optional strict mode that hides unmatched messages. |
| Metadata inspection | Side panel showing session ID, timestamps, message counts, tool call stats, and full raw JSON for any selected message. |
| Share & export | Copy a shareable URL, copy conversation JSON, or download the session. |
| Subagent meta support | Reads companion `.meta.json` files to display agent ID, type, and description. |
| Preferences | Toggle absolute timestamps, configure focus filters, and adjust the view from a built-in preference panel. |

## Tech Stack

- [Lit](https://lit.dev/) — Web Components
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) — Build tool & dev server
- [Marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify) — Markdown rendering
- [Lucide](https://lucide.dev/) — Icons
- [Vitest](https://vitest.dev/) — Testing

## Get Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Install & Run

```bash
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) — you should see Prism running in your browser.

### Load a Session

1. Click to upload a `.jsonl` file exported from Claude Code (found in `~/.claude/projects/` directories).
2. Or paste JSONL content directly from the clipboard.
3. Or provide a public URL to a hosted JSONL file.

Prism auto-detects Claude Code session events and renders the full conversation timeline.

### Build for Production

```bash
npm run build
```

Static assets are output to `./dist`.

### Run Tests

```bash
npm test
```

## Architecture

```
src/
├── prism-app.ts               # Root application shell & file loading
├── types/prism.ts              # Shared type definitions
├── adapters/claude/parser.ts   # Claude JSONL → NormalizedConversation
├── components/
│   ├── prism-timeline.ts       # Conversation timeline with action bar
│   ├── prism-message-card.ts   # Individual message card
│   ├── prism-message-hidden.ts # Collapsed/hidden message placeholder
│   ├── prism-message-text.ts   # Text renderer (plain / markdown)
│   ├── prism-metadata-panel.ts # Session & message metadata sidebar
│   └── prism-preference-panel.ts # Focus mode & view settings
└── utils/
    ├── markdown.ts             # Marked + DOMPurify pipeline
    └── icons.ts                # Lucide icon helpers
```

## License

MIT
