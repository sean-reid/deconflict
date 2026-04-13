# Deconflict

Free, open-source wireless channel planning tool.

Place access points on a floorplan, see physics-based signal coverage through walls, and get optimal channel assignments automatically. Supports 2.4/5/6 GHz bands, 100+ real AP models, per-material wall attenuation, and 3-stage AP placement optimization.

**[Try it live](https://deconflict.pages.dev)**

<a href="https://www.producthunt.com/products/deconflict?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-deconflict" target="_blank" rel="noopener noreferrer"><img alt="Deconflict - Plan your WiFi. See through walls. | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1122414&theme=light&t=1776061264236"></a>

## Features

### Core

- **Physics-based heatmap** - indoor path loss model with per-material wall attenuation via ray marching, rendered in a Web Worker for real-time updates
- **Auto channel solver** - DSatur graph coloring assigns channels in real time as you place APs
- **AP placement optimizer** - 3-stage hybrid: Signal-Weighted Lloyd's, Particle Swarm Optimization, Coordinate Descent polish
- **100+ AP models** - searchable database with Ubiquiti, Cisco, Aruba, Ruckus, TP-Link, Netgear, ASUS, and more. TX power from manufacturer datasheets and FCC filings
- **Coverage radius from physics** - derived from TX power (dBm) using the indoor path loss model, not a manual slider

### Floorplan & Walls

- **Auto wall detection** - walls extracted from floorplan images via adaptive local thresholding with OCR text removal
- **6 wall materials** - Drywall (3 dB), Wood (5 dB), Glass (2 dB), Brick (8 dB), Concrete (12 dB), Metal (20 dB)
- **Click-to-override** - click any wall to change its material; connected wall segments update together
- **Wall paint tool** - brush-based material painting for precision edits
- **Wall cleanup brush** - erase false walls or draw missing ones
- **Draw from scratch** - create walls without a floorplan image
- **Floorplan calibration** - auto-detect building boundary and calibrate to real-world units

### Interaction

- **Smart interaction** - tap to place, drag to move, shift-click for multi-select, drag empty space to pan, pinch to zoom
- **Undo/redo** - full history for AP moves, wall edits, and material changes
- **Imperial/metric toggle** - feet or meters across the entire app
- **Grid with labels** - foot/meter labels on both axes, adaptive spacing by zoom level
- **Export** - save projects as JSON, export to PNG or PDF

### Technical

- **Offline-ready** - runs entirely in the browser, no server required
- **Persistent** - everything survives page reloads via localStorage
- **Mobile-friendly** - responsive with touch gestures and mobile sidebar
- **Web Workers** - heatmap rendering and channel solving run off the main thread
- **Adaptive heatmap** - coarser grid during drag for responsiveness, full quality on drop

## Getting Started

```bash
git clone git@github.com:sean-reid/deconflict.git
cd deconflict
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Quick Start

1. Import a floorplan image or draw walls from scratch
2. Enter the building's total area to calibrate the scale
3. Select an AP model or tap the canvas to place access points
4. Channels are assigned automatically
5. Toggle the heatmap (H key) to see signal coverage through walls
6. Use Optimize Placement to find the best AP positions
7. Export as PNG, PDF, or save as JSON

## Keyboard Shortcuts

| Key                  | Action              |
| -------------------- | ------------------- |
| G                    | Toggle grid         |
| W                    | Toggle walls        |
| H                    | Toggle heatmap      |
| L                    | Toggle labels       |
| Ctrl/Cmd + Z         | Undo                |
| Ctrl/Cmd + Shift + Z | Redo                |
| Ctrl/Cmd + A         | Select all APs      |
| Delete               | Remove selected APs |
| Scroll               | Zoom                |

## Architecture

Monorepo managed with [pnpm](https://pnpm.io) workspaces and [Turborepo](https://turbo.build).

```
deconflict/
├── apps/web/             SvelteKit SPA with canvas-based editor
│   └── src/lib/
│       ├── canvas/       Rendering engine, layers, interactions
│       ├── rf/           Shared RF propagation model (signal + wall attenuation)
│       ├── data/vendors/ AP model database (per-vendor files, 100+ models)
│       ├── state/        Atomized Svelte 5 state (AP, floorplan, wall, meta)
│       └── workers/      Web Workers (heatmap, optimizer, solver)
├── packages/solver/      Graph coloring algorithms
├── packages/geometry/    Spatial math + interference graph
└── packages/channels/    WiFi band/channel definitions + throughput model
```

### Tech Stack

- **Frontend**: Svelte 5, SvelteKit, TypeScript
- **Canvas**: Raw HTML5 Canvas 2D with custom layer-based rendering engine
- **Solvers**: DSatur graph coloring (Web Worker)
- **Optimizer**: Lloyd's + PSO + Coordinate Descent with precomputed wall cache (Web Worker)
- **Heatmap**: Physics-based indoor propagation with precomputed attenuation fields (Web Worker)
- **OCR**: Tesseract.js for floorplan text detection and removal
- **RF Model**: Inverse quartic path loss + multi-wall DDA ray marching + per-material dB attenuation
- **Build**: Vite, Turborepo, pnpm workspaces
- **Testing**: Vitest (unit), Playwright (E2E)
- **CI/CD**: GitHub Actions, Cloudflare Pages (staging + production)

### How It Works

**Channel assignment** maps to [graph coloring](https://en.wikipedia.org/wiki/Graph_coloring). Each AP is a node; overlapping coverage areas create edges. DSatur assigns channels so no neighbors share a channel.

**Signal heatmap** evaluates every AP at each cell using an indoor path loss model (`signal = 1/(1+(d/r)^4)`). Wall attenuation is precomputed per-AP via stride-3 DDA ray marching through the wall mask, with per-material dB values. The client connects to whichever AP delivers the best throughput after path loss and wall attenuation. Rendering runs in a Web Worker with adaptive quality (coarser during drag, full on drop).

**AP placement optimizer** uses a 3-stage pipeline: (1) Signal-Weighted Lloyd's for intelligent initialization, (2) Particle Swarm Optimization for global search, (3) Coordinate Descent for final polish. Wall crossings are precomputed into a source-to-sample cache for O(1) evaluation during optimization.

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
