# Deconflict

Free, open-source wireless channel planning tool.

Place access points on a floorplan, see signal coverage as a heatmap, and get optimal channel assignments automatically. Supports 2.4/5/6 GHz bands with wall attenuation modeling.

**[Try it live](https://deconflict.pages.dev)**

## Features

- **Smart interaction** - tap to place APs, drag to move, drag empty space to pan, pinch to zoom
- **Signal heatmap** - visualize coverage quality across your entire floorplan with 5-band color coding
- **Auto wall detection** - walls are extracted from floorplan images and affect signal propagation
- **Auto channel solver** - channels assigned automatically using DSatur graph coloring as you place APs
- **Floorplan calibration** - auto-detect building boundary and calibrate to real-world meters via area input
- **Multi-band support** - 2.4 GHz, 5 GHz (including DFS), and 6 GHz with configurable channel widths
- **Throughput estimation** - per-AP estimated Mbps based on band, channel width, and co-channel contention
- **Export** - save projects as JSON, export layouts to PNG, generate PDF reports
- **Sample floorplans** - built-in apartment, house, office, and West Wing samples with known areas
- **Offline-ready** - works entirely in the browser, installable as a PWA
- **Persistent** - floorplan, APs, walls, and calibration survive page reloads via localStorage
- **Mobile-friendly** - responsive design with touch gestures, pinch-zoom, and mobile sidebar

## Getting Started

```bash
git clone git@github.com:sean-reid/deconflict.git
cd deconflict
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Quick Start

1. Load a floorplan image or pick a sample from the Floorplan tab
2. Enter the building's total area to calibrate the scale
3. Tap the canvas to place access points
4. Channels are assigned automatically
5. Toggle the heatmap in the layer panel to see signal coverage
6. Use File > Export to save as PNG or PDF

## Keyboard Shortcuts

| Key          | Action              |
| ------------ | ------------------- |
| G            | Toggle grid         |
| W            | Toggle walls        |
| H            | Toggle heatmap      |
| Ctrl/Cmd + Z | Undo                |
| Delete       | Remove selected APs |
| Scroll       | Zoom                |

## Architecture

Monorepo managed with [pnpm](https://pnpm.io) workspaces and [Turborepo](https://turbo.build).

```
deconflict/
├── apps/web/          SvelteKit SPA with canvas-based editor
├── packages/solver/   Graph coloring algorithms + Web Worker
├── packages/geometry/ Spatial math + interference graph
└── packages/channels/ WiFi band/channel definitions + throughput model
```

### Tech Stack

- **Frontend**: Svelte 5, SvelteKit, TypeScript
- **Canvas**: Raw HTML5 Canvas 2D with custom rendering engine
- **Solvers**: DSatur graph coloring (runs in a Web Worker)
- **RF Model**: Indoor path loss + wall attenuation + co-channel contention
- **Build**: Vite, Turborepo, pnpm workspaces
- **Testing**: Vitest (unit), Playwright (E2E)
- **Hosting**: Cloudflare Pages

### How It Works

The channel assignment problem maps to [graph coloring](https://en.wikipedia.org/wiki/Graph_coloring). Each access point is a node. Two nodes are connected if their coverage areas overlap. The solver assigns channels so no two overlapping APs share the same channel.

The signal heatmap estimates throughput at every point based on distance to the nearest AP, wall crossings (each wall attenuates signal by ~5 dB), and the AP's band and channel width.

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
