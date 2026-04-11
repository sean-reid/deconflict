# Deconflict

Free, open-source wireless channel planning for network engineers.

Drop access points onto a floorplan, define interference ranges, and get optimal channel assignments computed in real time using graph coloring algorithms.

**[Try it live](https://deconflict.pages.dev)**

## Features

- **Visual channel planning** - place access points on any floorplan image with drag-and-drop
- **Multi-band support** - 2.4 GHz, 5 GHz (including DFS), and 6 GHz with configurable channel widths
- **Four solver algorithms** - Greedy, DSatur, Welsh-Powell, and Backtracking with constraint propagation
- **Algorithm comparison** - run all solvers side by side to find the best channel assignment
- **Real-time interference visualization** - see coverage rings, conflict edges, and channel colors on the canvas
- **Export** - save projects as JSON, export layouts to PNG, generate PDF reports with AP schedules
- **Offline-ready** - works entirely in the browser with no server, installable as a PWA
- **Auto-save** - your work persists across browser sessions via localStorage

## Getting Started

```bash
git clone git@github.com:sean-reid/deconflict.git
cd deconflict
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Quick Start

1. Import a floorplan image (optional) or work on a blank canvas
2. Press **P** to activate the place tool and click to add access points
3. Press **V** to switch to select mode - click and drag APs to position them
4. Click **Solve** to automatically assign channels
5. Switch to the **Compare** tab to see how different algorithms perform

## Keyboard Shortcuts

| Key                  | Action                |
| -------------------- | --------------------- |
| V                    | Select tool           |
| P                    | Place AP tool         |
| H                    | Pan tool              |
| G                    | Toggle grid           |
| R                    | Toggle range rings    |
| E                    | Toggle conflict edges |
| Space + drag         | Pan canvas            |
| Scroll               | Zoom                  |
| Ctrl/Cmd + Z         | Undo                  |
| Ctrl/Cmd + Shift + Z | Redo                  |
| Delete               | Remove selected APs   |

## Architecture

Monorepo managed with [pnpm](https://pnpm.io) workspaces and [Turborepo](https://turbo.build).

```
deconflict/
├── apps/web/          SvelteKit SPA with canvas-based editor
├── packages/solver/   Graph coloring algorithms + Web Worker
├── packages/geometry/ Spatial math + interference graph
└── packages/channels/ WiFi band/channel definitions
```

### Tech Stack

- **Frontend**: Svelte 5, SvelteKit, TypeScript
- **Canvas**: Raw HTML5 Canvas 2D with custom rendering engine
- **Solvers**: DSatur, Greedy, Welsh-Powell, Backtracking (runs in a Web Worker)
- **Build**: Vite, Turborepo, pnpm workspaces
- **Testing**: Vitest (unit), Playwright (E2E)
- **Hosting**: Cloudflare Pages

### How the Solver Works

The channel assignment problem maps to [graph coloring](https://en.wikipedia.org/wiki/Graph_coloring). Each access point is a node. Two nodes are connected by an edge if their coverage areas overlap. The solver assigns channels (colors) such that no two connected nodes share the same channel.

- **Greedy** - assigns channels in node order, picking the smallest available
- **DSatur** - prioritizes nodes with the most constrained neighbors
- **Welsh-Powell** - processes nodes by descending degree
- **Backtracking** - exhaustive search with pruning for optimal results

## Scripts

| Command                                  | Description             |
| ---------------------------------------- | ----------------------- |
| `pnpm dev`                               | Start dev server        |
| `pnpm build`                             | Production build        |
| `pnpm test`                              | Run all unit tests      |
| `pnpm lint`                              | Lint all packages       |
| `pnpm typecheck`                         | Type check all packages |
| `pnpm format`                            | Format with Prettier    |
| `pnpm --filter @deconflict/web test:e2e` | Run E2E tests           |

## License

MIT
