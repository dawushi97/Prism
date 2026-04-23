# Prism: Claude Code Session Viewer

Visualize Claude Code sessions in your browser

> Inspired by [openai/euphony](https://github.com/openai/euphony) — a Harmony Chat and Codex Session Viewer. Prism adapts the same idea for the Claude Code ecosystem: drop in one or more session JSONL files and instantly explore the full conversation timeline.

## Features

| Feature | What it does |
|---------|-------------|
| Claude session parser | Parses Claude Code JSONL session logs into a normalized conversation timeline. |
| Message timeline | Renders user, assistant, tool call, tool result, thinking, and system event messages with role-colored rails and chips. |
| Multi-conversation view | Renders every loaded conversation at once, with list and grid layouts for dataset-style skimming. |
| Sidechain detection | Identifies and labels subagent / sidechain messages for multi-agent sessions. |
| Flexible loading | Loads one or more local `.jsonl` files, clipboard paste, or remote HTTP(S) URLs. |
| Markdown rendering | Toggleable GFM markdown rendering with DOMPurify sanitization. |
| Focus mode | Tri-state filters by author role, recipient tool, or content type. Normal mode folds non-matching messages; strict focus hides them entirely. |
| Metadata inspection | Side panel showing session ID, timestamps, message counts, tool call stats, and full raw JSON for any selected message. |
| Share & export | Copy a shareable URL, copy conversation JSON, or download the session. |
| Subagent meta support | Reads companion `.meta.json` files to display agent ID, type, and description. |
| Preferences | Floating preference panel with drag, manual close, max message height, layout controls, and focus settings. |

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

1. Click to upload one or more `.jsonl` files exported from Claude Code (found in `~/.claude/projects/` directories).
2. Or paste JSONL content directly from the clipboard.
3. Or provide a public URL to a hosted JSONL file.

Prism auto-detects Claude Code session events and renders the full conversation timeline.

If you load multiple sessions, Prism renders all of them together. `List View` stacks full conversations vertically; `Grid View` places the same full conversation viewers into a shared grid for side-by-side comparison.

### Build for Production

```bash
npm run build
```

Static assets are output to `./dist`.

### Run Tests

```bash
npm test
```

## Preferences

Prism exposes a floating `Preferences` panel from the top-right menu. The panel is draggable, has a manual close button, and closes when you click away.

### Max Message Height

- `Automatic`: uses the default capped message height.
- `No Limit`: fully expands message bodies.
- `Custom Height`: sets a fixed message body max height with the slider / numeric control.

This setting applies inside each conversation timeline, including in grid view.

### Layout

- `List View`: one full conversation per row.
- `Grid View`: one full conversation per grid cell.

The grid width is adjustable and synced into the URL as `?grid=<width>`, so the current skim layout is shareable.

## Focus Mode

Focus Mode is configured from the `Preferences` panel and works across all loaded conversations.

### Tri-state chips

Each focus chip has three states:

- `neutral`: ignored
- `include`: selected with normal click
- `exclude`: selected with `Shift+Click`

Interaction rules:

- Click: `neutral -> include -> neutral`
- `Shift+Click`: `neutral/include -> exclude -> neutral`

### Matching logic

- Within the same field, multiple `include` values are ORed. Example: `author = assistant` and `author = tool`.
- Across different fields, active `include` filters are ANDed. Example: `author = assistant` plus `type = text`.
- Any `exclude` match wins before `include`.

Example:

- `author: +assistant`
- `type: -thinking`

This means assistant messages stay in scope, but assistant `thinking` messages are still treated as excluded.

### Normal focus vs strict focus

When `strict focus` is off:

- Messages classified as `include` stay expanded.
- Messages classified as `neutral` or `exclude` remain in the timeline as folded placeholders.
- Folded messages can still be revealed from the timeline when you want to inspect them.

When `strict focus` is on:

- Only `include` messages remain rendered.
- `neutral` and `exclude` messages are removed from the visible timeline entirely.
- This is the best mode for aggressively skimming a dataset or isolating a narrow slice such as `assistant` output without `thinking`.

Important detail:

- If you only configure `exclude` rules and leave all `include` buckets empty, Prism keeps every non-excluded message visible in strict mode and hides only the excluded ones.

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
