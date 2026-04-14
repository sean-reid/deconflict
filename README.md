# Deconflict

**Free, open-source WiFi channel planning for network engineers who shouldn't need a $5,000 license to avoid co-channel interference.**

**[Try it live](https://deconflict.pages.dev)**

<a href="https://www.producthunt.com/products/deconflict?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-deconflict" target="_blank" rel="noopener noreferrer"><img alt="Deconflict on Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1122414&theme=light&t=1776061264236"></a>

---

Drop a floorplan, place access points, and get optimal channel assignments in real time. The heatmap shows physics-based signal propagation through walls, across floors, and through different materials. The optimizer finds the best AP positions automatically.

## Highlights

- **Multi-floor** with cross-floor signal propagation and per-slab material attenuation
- **6 wall materials** with thickness-aware RF attenuation and real-time heatmap updates
- **100+ real AP models** from Ubiquiti, Cisco, Aruba, Ruckus, TP-Link, and more
- **Auto channel assignment** that accounts for walls, floors, and material properties
- **3-stage AP optimizer**: Lloyd's + PSO + Coordinate Descent
- **Professional PDF reports** with per-floor layouts and building coverage

## Quick Start

```bash
git clone git@github.com:sean-reid/deconflict.git
cd deconflict
pnpm install
pnpm dev
```

1. Import a floorplan or draw walls from scratch
2. Calibrate the scale with the building's area
3. Place access points (or pick from the model database)
4. Channels are assigned automatically
5. Toggle the heatmap (**H**) to see signal coverage
6. Run **Optimize Placement** for best AP positions
7. Export as PNG, PDF, or JSON

## Keyboard Shortcuts

| Key                      | Action              |
| ------------------------ | ------------------- |
| **H**                    | Toggle heatmap      |
| **G**                    | Toggle grid         |
| **W**                    | Toggle walls        |
| **Cmd/Ctrl + Z**         | Undo                |
| **Cmd/Ctrl + Shift + Z** | Redo                |
| **Delete**               | Remove selected APs |

## Architecture

Monorepo with [pnpm](https://pnpm.io) workspaces and [Turborepo](https://turbo.build).

```
apps/web/          SvelteKit SPA — canvas editor, state, rendering
packages/solver/   Graph coloring algorithms (DSatur, greedy, Welsh-Powell)
packages/geometry/ Spatial math, interference graph
packages/channels/ WiFi band/channel definitions, throughput model
```

**Stack**: Svelte 5, TypeScript, HTML5 Canvas, Web Workers, Vite, Playwright, GitHub Actions, Cloudflare Pages

## Scripts

| Command                                  | Description      |
| ---------------------------------------- | ---------------- |
| `pnpm dev`                               | Dev server       |
| `pnpm build`                             | Production build |
| `pnpm test`                              | Unit tests       |
| `pnpm lint`                              | Lint             |
| `pnpm typecheck`                         | Type check       |
| `pnpm --filter @deconflict/web test:e2e` | E2E tests        |

## License

MIT
