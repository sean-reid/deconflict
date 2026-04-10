# Deconflict

Free, open-source wireless channel planning for network engineers.

Drop access points onto a floorplan, define interference ranges, and get optimal channel assignments computed in real time using graph coloring algorithms.

## Features

- **Visual channel planning** - drag and drop APs onto any floorplan image
- **Multi-band support** - 2.4 GHz, 5 GHz, and 6 GHz with full channel/width configuration
- **Multiple solvers** - Greedy, DSatur, Welsh-Powell, and Backtracking algorithms
- **Algorithm comparison** - run all solvers side by side and compare results
- **Export** - save layouts as JSON, export to PNG or PDF reports
- **Offline-ready** - works entirely in the browser with no server required

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Architecture

Monorepo managed with pnpm workspaces and Turborepo.

| Package             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `apps/web`          | SvelteKit SPA with canvas-based floorplan editor |
| `packages/solver`   | Graph coloring algorithms and Web Worker entry   |
| `packages/geometry` | Spatial math, interference graph construction    |
| `packages/channels` | WiFi band/channel definitions and rules          |

## License

MIT
