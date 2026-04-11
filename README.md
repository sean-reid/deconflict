# Deconflict

Free, open-source wireless channel planning tool.

Place access points on a floorplan, see signal coverage as a heatmap, and get optimal channel assignments automatically. Supports 2.4/5/6 GHz bands with wall attenuation modeling and AP placement optimization.

**[Try it live](https://deconflict.pages.dev)**

## Features

- **Smart interaction** - tap to place APs, drag to move, drag empty space to pan, pinch to zoom
- **Signal heatmap** - visualize coverage quality across your entire floorplan with 5-band color coding
- **Real-time coverage score** - see overall coverage percentage update as you place and move APs
- **AP placement optimizer** - simulated annealing spreads APs for maximum coverage within the building footprint
- **OCR text removal** - Tesseract.js detects and masks floorplan labels before wall detection
- **Auto wall detection** - walls extracted from floorplan images via adaptive local thresholding
- **Wall attenuation** - heatmap accounts for signal loss through walls using ray marching
- **Auto channel solver** - channels assigned automatically using DSatur graph coloring as you place APs
- **Floorplan calibration** - auto-detect building boundary and calibrate to real-world units via area input
- **Imperial/metric toggle** - switch between feet and meters across the entire app
- **Multi-band support** - 2.4 GHz, 5 GHz (including DFS), and 6 GHz with configurable channel widths
- **Throughput estimation** - per-AP estimated Mbps based on band, channel width, and co-channel contention
- **Export** - save projects as JSON, export layouts to PNG, generate PDF reports
- **Sample floorplans** - built-in apartment, house, office, and West Wing samples with known areas
- **Offline-ready** - works entirely in the browser, no server required
- **Persistent** - floorplan, APs, walls, calibration, and boundary survive page reloads via localStorage
- **Mobile-friendly** - responsive design with touch gestures, pinch-zoom, undo/redo buttons, and mobile sidebar

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
5. Toggle the heatmap (H key or layer panel) to see signal coverage
6. Use Optimize Placement to spread APs for best coverage
7. Use File > Export to save as PNG or PDF

## Keyboard Shortcuts

| Key          | Action              |
| ------------ | ------------------- |
| G            | Toggle grid         |
| W            | Toggle walls        |
| H            | Toggle heatmap      |
| Ctrl/Cmd + Z | Undo                |
| Delete       | Remove selected APs |
| Scroll       | Zoom                |
| Enter        | Dismiss dialogs     |

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
- **Optimizer**: Simulated annealing for AP placement (runs in a Web Worker)
- **OCR**: Tesseract.js for floorplan text detection and removal
- **RF Model**: Indoor path loss + wall attenuation via ray marching + co-channel contention
- **Build**: Vite, Turborepo, pnpm workspaces
- **Testing**: Vitest (unit), Playwright (E2E)
- **Hosting**: Cloudflare Pages

### How It Works

The channel assignment problem maps to [graph coloring](https://en.wikipedia.org/wiki/Graph_coloring). Each access point is a node. Two nodes are connected if their coverage areas overlap. The solver assigns channels so no two overlapping APs share the same channel.

The signal heatmap estimates throughput at every point based on distance to the nearest AP, wall crossings (each wall attenuates signal by ~5 dB), and the AP's band and channel width. Wall detection uses adaptive local thresholding with OCR-based text removal to extract walls from any floorplan image.

The AP placement optimizer uses simulated annealing with an incremental signal grid to find positions that maximize average coverage across the building interior. Interior is computed via morphological close + exterior flood fill, handling L-shaped and irregular building footprints.

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
