<script lang="ts">
	import { onMount } from 'svelte';
	import { CanvasEngine } from '$canvas/engine.js';
	import { FloorplanLayer } from '$canvas/renderers/floorplan.js';
	import { GridLayer } from '$canvas/renderers/grid.js';
	import { HeatmapLayer } from '$canvas/renderers/heatmap.js';
	import { ApLayer } from '$canvas/renderers/ap.js';
	import { WallLayer } from '$canvas/renderers/walls.js';
	import { decodeMask, encodeMask } from '$canvas/wall-detect.js';
	import { WallEditHandler } from '$canvas/interactions/wall-edit.js';
	import { PanZoomHandler } from '$canvas/interactions/pan-zoom.js';
	import { SelectHandler } from '$canvas/interactions/select.js';
	import { SelectionRectLayer } from '$canvas/renderers/selection-rect.js';
	import { DragHandler } from '$canvas/interactions/drag.js';
	import { PlaceHandler } from '$canvas/interactions/place.js';
	import { apState, removeAps, getEffectiveWupm, radiusFromPower } from '$state/ap-state.svelte.js';
	import { floorplanState } from '$state/floorplan-state.svelte.js';
	import { wallState } from '$state/wall-state.svelte.js';
	import { projectMeta } from '$state/project-meta.svelte.js';
	import { canvasState, clearSelection } from '$state/canvas.svelte.js';
	import { appState } from '$state/app.svelte.js';
	import { undo, redo, pushState } from '$state/history.svelte.js';
	import { solverState, runSolver, invalidateSolverMaskCache, setLiveSolverMask } from '$state/solver.svelte.js';
	import { updateCoverage } from '$state/optimizer.svelte.js';
	import { hitTest } from '$canvas/hit-test.js';
	import { setEngineRef } from '$canvas/engine-ref.js';
	import { restoreFromStorage } from '$state/persistence.svelte.js';
	import { importFloorplanFile } from '$canvas/import-floorplan.js';
	import { labelWallBlobs, relabelBlob, encodeMaterialMask, decodeMaterialMask } from '$canvas/wall-labels.js';
	import { WALL_MATERIALS, type WallMaterialId } from '$canvas/materials.js';
	import { floorState, currentFloor } from '$state/floor-state.svelte.js';
	import { FLOOR_MATERIALS } from '$canvas/floor-materials.js';
	import { TiledMask } from '$canvas/tiled-mask.js';
	import { scheduleSave } from '$state/persistence.svelte.js';
	import LayerPanel from '$components/canvas/LayerPanel.svelte';
	import WallMaterialPopup from '$components/canvas/WallMaterialPopup.svelte';
	import WallEditToolbar from '$components/canvas/WallEditToolbar.svelte';

	let wallEditMaterial = $state<WallMaterialId>(0);
	let brushCursorX = $state(0);
	let brushCursorY = $state(0);
	let brushCursorSize = $state(0);
	let brushCursorVisible = $state(false);

	function handleWallEditDone() {
		appState.wallEditMode = null;
		brushCursorVisible = false;
		heatmapLayer.isDragging = false; // restore full-resolution grid
		setLiveSolverMask(null, null, 0, 0); // clear live mask override

		// Materialize tiled mask and persist
		const tm = wallEditHandler.tiledMask;
		const mat = tm?.materialize();
		if (mat) {
			const { data, materialData, width, height, originX, originY } = mat;
			cachedWallData = data;
			cachedMaterialData = materialData;
			cachedMaskOriginX = originX;
			cachedMaskOriginY = originY;

			const newWallUrl = encodeMask(data, width, height);
			const newMatUrl = materialData ? encodeMaterialMask(materialData, width, height) : null;

			// Update URLs and pre-set lastUrls so the async decode effect skips re-decode
			wallState.wallMask = { dataUrl: newWallUrl, width, height, originX, originY };
			lastWallMaskUrl = newWallUrl;
			if (newMatUrl) {
				wallState.materialMask = { dataUrl: newMatUrl, width, height, originX, originY };
				lastMatMaskUrl = newMatUrl;
			}

			// Recompute blob labels so click-to-override works on the edited walls
			cachedWallLabels = labelWallBlobs(data, width, height);

			// Trigger re-solve (wallMaskVersion drives auto-solve key)
			wallMaskVersion++;
			invalidateSolverMaskCache();

			wallLayer.invalidateCache();
			heatmapLayer.markWallsDirty();
			heatmapLayer.materialVersion++;
			engine.markDirty();
			scheduleSave();
		}
	}

	let canvasDragOver = $state(false);

	function handleCanvasDrop(e: DragEvent) {
		e.preventDefault();
		canvasDragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) {
			importFloorplanFile(file);
			appState.sidebarPanel = 'floorplan';
			appState.sidebarOpen = true;
		}
	}

	function handleCanvasDragOver(e: DragEvent) {
		e.preventDefault();
		canvasDragOver = true;
	}

	function handleCanvasDragLeave() {
		canvasDragOver = false;
	}

	// Wall material popup state
	let wallPopup = $state<{ x: number; y: number; material: WallMaterialId; blobId: number } | null>(null);
	let cachedWallLabels: ReturnType<typeof labelWallBlobs> | null = null;
	let cachedMaterialData: Uint8Array | null = null;
	let cachedWallData: Uint8Array | null = null;
	let cachedTiledMask: TiledMask | null = null;
	let cachedMaskOriginX = 0;
	let cachedMaskOriginY = 0;

	function handleWallClick(screenX: number, screenY: number): boolean {
		if (!engine || !cachedWallData || !cachedWallLabels) return false;
		const world = engine.camera.screenToWorld({ x: screenX, y: screenY });
		// Convert world coords to mask-local coords
		const px = Math.round(world.x) - cachedMaskOriginX;
		const py = Math.round(world.y) - cachedMaskOriginY;
		const mask = wallState.wallMask;
		if (!mask || px < 0 || px >= mask.width || py < 0 || py >= mask.height) return false;
		const idx = py * mask.width + px;
		if (!cachedWallData[idx]) return false;

		const blobId = cachedWallLabels.labels[idx]!;
		if (blobId < 0) return false;

		const matId = cachedMaterialData ? (cachedMaterialData[idx] ?? wallState.wallMaterial) : wallState.wallMaterial;
		wallPopup = { x: screenX, y: screenY, material: matId as WallMaterialId, blobId };
		return true;
	}

	async function handleMaterialSelect(newMaterial: WallMaterialId) {
		if (!wallPopup || !cachedWallLabels || !wallState.wallMask) return;
		pushState(); // undo captures state before blob relabel
		const mask = wallState.wallMask;

		// Create or clone material mask
		if (!cachedMaterialData) {
			cachedMaterialData = new Uint8Array(mask.width * mask.height);
			cachedMaterialData.fill(wallState.wallMaterial);
		}

		relabelBlob(cachedWallLabels.labels, cachedMaterialData, wallPopup.blobId, newMaterial);

		// Update renderers immediately
		wallLayer.materialMap = cachedMaterialData;
		wallLayer.invalidateCache();
		heatmapLayer.materialMap = cachedMaterialData;
		heatmapLayer.materialVersion++;
		heatmapLayer.markWallsDirty();
		engine.markDirty();

		// Trigger solver re-run
		wallMaskVersion++;
		invalidateSolverMaskCache();

		// Encode and persist
		const dataUrl = encodeMaterialMask(cachedMaterialData, mask.width, mask.height);
		wallState.materialMask = { dataUrl, width: mask.width, height: mask.height, originX: 0, originY: 0 };
		scheduleSave();
	}

	let canvasEl: HTMLCanvasElement;
	let containerEl: HTMLDivElement;
	let engine: CanvasEngine;
	let panZoom: PanZoomHandler;
	let selectHandler: SelectHandler;
	let dragHandler: DragHandler;
	let placeHandler: PlaceHandler;
	let wallEditHandler: WallEditHandler;
	let floorplanLayer: FloorplanLayer;
	let gridLayer: GridLayer;
	let heatmapLayer: HeatmapLayer;
	let selectionRectLayer: SelectionRectLayer;
	let apLayer: ApLayer;
	let wallLayer: WallLayer;
	let autoSolveTimeout: ReturnType<typeof setTimeout> | null = null;
	let showEmptyHint = $derived(apState.aps.length === 0 && !floorplanState.floorplanUrl);

	function handleKeyDown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
		const mod = e.metaKey || e.ctrlKey;

		if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
			e.preventDefault();
			redo();
			engine?.markDirty();
			return;
		}

		if (mod && (e.key === 'z' || e.key === 'Z')) {
			e.preventDefault();
			undo();
			engine?.markDirty();
			return;
		}

		if (e.key === 'Delete' || e.key === 'Backspace') {
			if (canvasState.selectedApIds.length > 0) {
				e.preventDefault();
				removeAps([...canvasState.selectedApIds]);
				clearSelection();
			}
		}

		if (isInput || mod) return;

		switch (e.key) {
			case 'g':
			case 'G':
				appState.showGrid = !appState.showGrid;
				break;
			case 'w':
			case 'W':
				appState.showWalls = !appState.showWalls;
				break;
			case 'h':
			case 'H':
				appState.showHeatmap = !appState.showHeatmap;
				break;
		}
	}

	onMount(() => {
		restoreFromStorage();
		window.addEventListener('keydown', handleKeyDown);
		engine = new CanvasEngine(canvasEl);
		setEngineRef(engine);
		// Create layers
		floorplanLayer = new FloorplanLayer();
		gridLayer = new GridLayer();
		heatmapLayer = new HeatmapLayer();
		wallLayer = new WallLayer();
		apLayer = new ApLayer();
		selectionRectLayer = new SelectionRectLayer();

		// Add layers in draw order: floorplan, boundary, grid, walls, heatmap, APs, selection rect
		engine.addLayer(floorplanLayer);
		engine.addLayer(gridLayer);
		engine.addLayer(wallLayer);
		engine.addLayer(heatmapLayer);
		engine.addLayer(apLayer);
		engine.addLayer(selectionRectLayer);

		// Create interaction handlers
		panZoom = new PanZoomHandler(engine);
		panZoom.attach();
		selectHandler = new SelectHandler(engine, selectionRectLayer);
		dragHandler = new DragHandler(engine);
		placeHandler = new PlaceHandler(engine);
		wallEditHandler = new WallEditHandler(engine);
		wallEditHandler.onEdit = () => {
			// Materialize tiled mask to flat arrays for renderers
			const tm = wallEditHandler.tiledMask;
			const mat = tm?.materialize();
			if (mat) {
				const maskRef = {
					data: mat.data,
					width: mat.width,
					height: mat.height,
					originX: mat.originX,
					originY: mat.originY
				};
				wallLayer.mask = maskRef;
				heatmapLayer.wallMask = maskRef;
				cachedWallData = mat.data;
				cachedMaskOriginX = mat.originX;
				cachedMaskOriginY = mat.originY;
				if (mat.materialData) {
					wallLayer.materialMap = mat.materialData;
					heatmapLayer.materialMap = mat.materialData;
					cachedMaterialData = mat.materialData;
				}
				heatmapLayer.materialVersion++;
			}
			wallLayer.invalidateCache();
			heatmapLayer.markWallsDirty();
			engine.markDirty();

			// Push live mask to solver (skips PNG decode) and trigger re-solve
			if (mat) {
				setLiveSolverMask(mat.data, mat.materialData, mat.width, mat.height);
			}
			invalidateSolverMaskCache();
			wallMaskVersion++;
		};

		// Set up resize observer
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				engine.resize(width, height);
			}
		});
		observer.observe(containerEl);

		// Initial size
		const rect = containerEl.getBoundingClientRect();
		engine.resize(rect.width, rect.height);
		engine.start();

		// Track zoom for status bar
		const zoomInterval = setInterval(() => {
			canvasState.zoom = engine.camera.state.zoom;
		}, 100);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			engine.stop();
			panZoom.detach();
			observer.disconnect();
			clearInterval(zoomInterval);
		};
	});

	// Sync AP layer — only tracks apState, not wall/floorplan state
	// Filter APs to current floor only
	$effect(() => {
		if (!apLayer) return;
		const floorId = floorState.currentFloorId;
		const aps = apState.aps.filter((ap) => ap.floorId === floorId);
		for (const ap of aps) {
			void ap.x;
			void ap.y;
			void ap.assignedChannel;
			void ap.band;
			void ap.name;
		}
		apLayer.aps = aps;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.selectedIds = canvasState.selectedApIds;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.hoveredId = canvasState.hoveredApId;
		engine.markDirty();
	});

	$effect(() => {
		if (!gridLayer) return;
		gridLayer.visible = appState.showGrid;
		engine.markDirty();
	});

	$effect(() => {
		if (!gridLayer) return;
		const wupm = getEffectiveWupm();
		gridLayer.worldUnitsPerMeter = wupm;
		gridLayer.unitSystem = floorplanState.unitSystem;
		if (heatmapLayer) heatmapLayer.worldUnitsPerMeter = wupm;
		engine.markDirty();
	});

	$effect(() => {
		if (!heatmapLayer) return;
		heatmapLayer.visible = appState.showHeatmap;
		engine.markDirty();
	});

	// Sync heatmap APs — current floor + virtual APs from adjacent floors
	// Tracks floor properties (ceilingHeight, floorThickness, floorMaterial) for reactivity
	$effect(() => {
		if (!heatmapLayer) return;
		const floorId = floorState.currentFloorId;
		const cur = currentFloor();
		// Read floor properties to establish Svelte tracking
		for (const f of floorState.floors) {
			void f.ceilingHeight;
			void f.floorThickness;
			void f.floorMaterial;
			void f.level;
		}

		// Current floor's APs (full power)
		const localAps = apState.aps.filter((ap) => ap.floorId === floorId);

		// Virtual APs from ALL other floors (attenuated through each slab between)
		const otherFloors = floorState.floors.filter((f) => f.id !== floorId);
		const sortedFloors = [...floorState.floors].sort((a, b) => a.level - b.level);
		const virtualAps = [];
		for (const adj of otherFloors) {
			const adjAps = apState.aps.filter((ap) => ap.floorId === adj.id);
			if (adjAps.length === 0) continue;

			// Sum vertical gap and slab attenuation through every floor between
			const loLevel = Math.min(cur.level, adj.level);
			const hiLevel = Math.max(cur.level, adj.level);
			let totalVertGap = 0;
			let totalSlabThickness = 0;
			// We need per-band dB/m, so accumulate weighted thickness
			// Each slab: upper floor's material & thickness
			const slabSegments: { dbPerMeter: Record<string, number>; thickness: number }[] = [];
			for (const f of sortedFloors) {
				if (f.level < loLevel || f.level >= hiLevel) continue;
				// This floor's ceiling contributes to the vertical gap
				totalVertGap += f.ceilingHeight;
				// The slab between this floor and the one above = upper floor's material
				const upperIdx = sortedFloors.findIndex((s) => s.level === f.level + 1);
				if (upperIdx >= 0) {
					const upper = sortedFloors[upperIdx]!;
					const mat = FLOOR_MATERIALS[upper.floorMaterial];
					if (mat) {
						slabSegments.push({ dbPerMeter: mat.dbPerMeter, thickness: upper.floorThickness });
						totalSlabThickness += upper.floorThickness;
					}
				}
			}

			for (const ap of adjAps) {
				// Compute aggregate dB/m for this AP's band across all slabs
				let totalDb = 0;
				for (const seg of slabSegments) {
					totalDb += (seg.dbPerMeter[ap.band] ?? 100) * seg.thickness;
				}
				virtualAps.push({
					...ap,
					id: `virtual-${ap.id}`,
					verticalOffset: totalVertGap,
					// Pass total dB as floorDbPerMeter * floorThickness = totalDb
					// Set floorDbPerMeter = totalDb / totalSlabThickness (or totalDb if thickness=1)
					floorDbPerMeter: totalSlabThickness > 0 ? totalDb / totalSlabThickness : 0,
					floorThickness: totalSlabThickness
				});
			}
		}

		const allAps = [...localAps, ...virtualAps];
		for (const ap of allAps) {
			void ap.x;
			void ap.y;
			void ap.band;
			void ap.channelWidth;
			void ap.interferenceRadius;
			void ap.assignedChannel;
			void ap.power;
		}
		heatmapLayer.aps = allAps;
		engine.markDirty();
	});

	// Sync heatmap ISP speed — only tracks projectMeta
	$effect(() => {
		if (!heatmapLayer) return;
		heatmapLayer.ispSpeed = projectMeta.ispSpeed;
		engine.markDirty();
	});

	// Coarser wall grid during drag or wall editing for responsiveness
	$effect(() => {
		if (!heatmapLayer) return;
		heatmapLayer.isDragging = canvasState.isDragging || !!appState.wallEditMode;
		engine.markDirty();
	});

	// Floor → legacy atoms: load current floor's data into legacy atoms on switch
	let lastSyncedFloorId = '';
	$effect(() => {
		const id = floorState.currentFloorId;
		if (id === lastSyncedFloorId) return;

		// Before switching: save current legacy state back to the outgoing floor
		if (lastSyncedFloorId) {
			const outgoing = floorState.floors.find((f) => f.id === lastSyncedFloorId);
			if (outgoing) {
				outgoing.floorplanUrl = floorplanState.floorplanUrl;
				outgoing.floorplanScale = floorplanState.floorplanScale;
				outgoing.calibration = floorplanState.calibration;
				outgoing.floorplanBoundary = floorplanState.floorplanBoundary;
				outgoing.wallMask = wallState.wallMask;
				outgoing.wallAttenuation = wallState.wallAttenuation;
				outgoing.wallMaterial = wallState.wallMaterial;
				outgoing.materialMask = wallState.materialMask;
			}
		}

		// Load incoming floor's data into legacy atoms
		const floor = currentFloor();
		floorplanState.floorplanUrl = floor.floorplanUrl;
		floorplanState.floorplanScale = floor.floorplanScale;
		floorplanState.calibration = floor.calibration;
		floorplanState.floorplanBoundary = floor.floorplanBoundary;
		wallState.wallMask = floor.wallMask;
		wallState.wallAttenuation = floor.wallAttenuation;
		wallState.wallMaterial = floor.wallMaterial;
		wallState.materialMask = floor.materialMask;

		lastSyncedFloorId = id;
		clearSelection();
		engine?.markDirty();
	});

	// When wall mask changes, invalidate heatmap wall cache
	$effect(() => {
		if (!heatmapLayer) return;
		wallState.wallMask; // track
		heatmapLayer.markWallsDirty();
		engine.markDirty();
	});

	// Sync wall material to renderers — only tracks wallState.wallMaterial
	$effect(() => {
		if (!wallLayer || !heatmapLayer) return;
		const id = wallState.wallMaterial;
		wallLayer.defaultMaterial = id;
		wallLayer.invalidateCache();
		heatmapLayer.defaultMaterial = id;
		heatmapLayer.materialVersion++;
		heatmapLayer.markWallsDirty();
		engine.markDirty();
	});

	// Decode wall mask + material mask — only tracks wallState (not apState)
	let wallMaskVersion = 0;
	let lastWallMaskUrl: string | null = null;
	let lastMatMaskUrl: string | null = null;
	$effect(() => {
		if (!wallLayer || !heatmapLayer) return;
		const mask = wallState.wallMask;
		const matMask = wallState.materialMask;

		// Skip re-decode if the data URLs haven't changed (avoids stale overwrites)
		const wallUrl = mask?.dataUrl ?? null;
		const matUrl = matMask?.dataUrl ?? null;
		if (wallUrl === lastWallMaskUrl && matUrl === lastMatMaskUrl && cachedWallData) return;
		lastWallMaskUrl = wallUrl;
		lastMatMaskUrl = matUrl;

		wallMaskVersion++;
		invalidateSolverMaskCache();
		const thisVersion = wallMaskVersion;

		if (!mask) {
			wallLayer.mask = null;
			heatmapLayer.wallMask = null;
			cachedWallData = null;
			cachedWallLabels = null;
			cachedMaterialData = null;
			engine.markDirty();
			return;
		}

		const wallPromise = decodeMask(mask.dataUrl, mask.width, mask.height);
		const matPromise = matMask ? decodeMaterialMask(matMask.dataUrl, matMask.width, matMask.height) : null;

		wallPromise.then(async (decoded) => {
			if (wallMaskVersion !== thisVersion) return;
			const matData = matPromise ? await matPromise : null;
			if (wallMaskVersion !== thisVersion) return;

			const defaultMat = wallState.wallMaterial;
			wallLayer.mask = decoded;
			wallLayer.materialMap = matData ?? null;
			wallLayer.defaultMaterial = defaultMat;
			heatmapLayer.wallMask = decoded;
			heatmapLayer.materialMap = matData ?? null;
			heatmapLayer.defaultMaterial = defaultMat;
			heatmapLayer.wallAttenuation = wallState.wallAttenuation;

			cachedWallData = decoded.data;
			cachedMaskOriginX = decoded.originX;
			cachedMaskOriginY = decoded.originY;
			cachedWallLabels = labelWallBlobs(decoded.data, decoded.width, decoded.height);
			cachedMaterialData = matData ?? null;

			// Build TiledMask from decoded flat data for the wall edit handler
			cachedTiledMask = TiledMask.fromFlat(
				decoded.data, decoded.width, decoded.height,
				matData, defaultMat
			);
			if (wallEditHandler) {
				wallEditHandler.tiledMask = cachedTiledMask;
			}

			engine.markDirty();
		});
	});


	$effect(() => {
		if (!wallLayer) return;
		wallLayer.visible = appState.showWalls;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.showLabels = appState.showLabels;
		engine.markDirty();
	});

	$effect(() => {
		if (!floorplanLayer) return;
		floorplanLayer.visible = appState.showFloorplan;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.visible = appState.showAPs;
		engine.markDirty();
	});

	// Sync floorplan image to layer
	$effect(() => {
		if (!floorplanLayer) return;
		const url = floorplanState.floorplanUrl;
		if (url) {
			floorplanLayer.loadImage(url, () => {
				// Auto-fit to floorplan bounds on load
				if (floorplanLayer.imageWidth > 0) {
					const rect = engine.canvas.getBoundingClientRect();
					engine.camera.fitToBounds(
						[
							{ x: 0, y: 0 },
							{ x: floorplanLayer.imageWidth, y: floorplanLayer.imageHeight }
						],
						rect.width,
						rect.height
					);
				}
				engine.markDirty();
			});
		} else {
			floorplanLayer.clearImage();
		}
		engine.markDirty();
	});

	// Sync floorplan opacity (stored in floorplanScale)
	$effect(() => {
		if (!floorplanLayer) return;
		floorplanLayer.opacity = floorplanState.floorplanScale;
		engine.markDirty();
	});


	// Auto-solve: debounce solver runs when AP layout, RF params, or walls change.
	// Excludes assignedChannel to avoid infinite loops (solver writes channels).
	let autoSolveKey = $derived(
		apState.aps
			.map(
				(ap) =>
					`${ap.id}:${Math.round(ap.x)}:${Math.round(ap.y)}:${ap.floorId}:${ap.interferenceRadius}:${ap.band}:${ap.channelWidth}`
			)
			.join('|') +
		`|wm:${wallMaskVersion}:${wallState.wallMaterial}`
	);

	$effect(() => {
		const auto = solverState.autoSolve;
		const _key = autoSolveKey;
		if (!auto || apState.aps.length === 0) return;
		if (solverState.isRunning) return;

		if (autoSolveTimeout) clearTimeout(autoSolveTimeout);
		autoSolveTimeout = setTimeout(() => {
			runSolver();
		}, 500);
	});


	// Update coverage score when APs or wall mask change
	let coverageTimeout: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const _key = autoSolveKey;
		const _mask = wallState.wallMask;
		if (apState.aps.length === 0 || !_mask) return;
		if (coverageTimeout) clearTimeout(coverageTimeout);
		coverageTimeout = setTimeout(() => updateCoverage(), 300);
	});

	// Track pending placement vs pan gesture
	const DRAG_THRESHOLD = 5;
	let pendingPlace = false;
	let pendingPan = false;
	let pointerStartX = 0;
	let pointerStartY = 0;
	let activeTouches = 0;

	// Single-finger state
	let touchStartX = 0;
	let touchStartY = 0;
	let touchMoved = false;
	let touchStartedOnAp = false;

	// Two-finger pinch state
	let pinchLastDist = 0;
	let pinchLastCx = 0;
	let pinchLastCy = 0;
	let pinchFrames = 0;

	function handleTouchStart(e: TouchEvent) {
		activeTouches = e.touches.length;

		if (activeTouches === 1) {
			const t = e.touches[0]!;
			touchStartX = t.clientX;
			touchStartY = t.clientY;
			touchMoved = false;
			touchStartedOnAp = false;
			pendingPan = false;

			// Wall edit mode: single touch draws
			if (appState.wallEditMode) {
				e.preventDefault();
				wallEditHandler.activeMaterial = wallEditMaterial;
				wallEditHandler.defaultMaterial = wallState.wallMaterial;
				wallEditHandler.handlePointerDown(
					new PointerEvent('pointerdown', { clientX: t.clientX, clientY: t.clientY, button: 0 })
				);
				return;
			}
		} else if (activeTouches >= 2) {
			e.preventDefault();
			// Cancel single-finger state (including wall edit stroke)
			if (appState.wallEditMode) {
				wallEditHandler.handlePointerUp();
				brushCursorVisible = false;
			}
			pendingPan = false;
			touchStartedOnAp = false;
			touchMoved = true;
			dragHandler.handlePointerUp();
			// Initialize pinch
			pinchFrames = 0;
			pinchLastDist = 0;
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (!engine) return;

		// Two-finger: pinch zoom + pan
		if (e.touches.length === 2) {
			e.preventDefault();
			const t0 = e.touches[0]!;
			const t1 = e.touches[1]!;
			const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
			const cx = (t0.clientX + t1.clientX) / 2;
			const cy = (t0.clientY + t1.clientY) / 2;

			pinchFrames++;
			if (pinchFrames <= 2) {
				// Baseline frames: record, don't apply
				pinchLastDist = dist;
				pinchLastCx = cx;
				pinchLastCy = cy;
				return;
			}

			// Zoom
			if (pinchLastDist > 0) {
				const factor = dist / pinchLastDist;
				const rect = engine.canvas.getBoundingClientRect();
				engine.camera.zoomAt({ x: cx - rect.left, y: cy - rect.top }, factor);
			}

			// Pan
			engine.camera.pan(
				(cx - pinchLastCx) / engine.camera.state.zoom,
				(cy - pinchLastCy) / engine.camera.state.zoom
			);

			pinchLastDist = dist;
			pinchLastCx = cx;
			pinchLastCy = cy;
			engine.markDirty();
			return;
		}

		// Single-finger
		if (e.touches.length !== 1) return;
		const t = e.touches[0]!;

		// Wall edit mode: single touch draws
		if (appState.wallEditMode) {
			e.preventDefault();
			wallEditHandler.handlePointerMove(
				new PointerEvent('pointermove', { clientX: t.clientX, clientY: t.clientY })
			);
			const rect = engine.canvas.getBoundingClientRect();
			brushCursorX = t.clientX - rect.left;
			brushCursorY = t.clientY - rect.top;
			brushCursorVisible = true;
			return;
		}

		const dx = t.clientX - touchStartX;
		const dy = t.clientY - touchStartY;

		if (!touchMoved && !touchStartedOnAp && !pendingPan && dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
			touchMoved = true;
			const rect = engine.canvas.getBoundingClientRect();
			const hit = hitTest({ x: touchStartX - rect.left, y: touchStartY - rect.top }, engine.camera, apState.aps.filter(ap => ap.floorId === floorState.currentFloorId));

			if (hit) {
				touchStartedOnAp = true;
				const synth = new PointerEvent('pointerdown', { clientX: touchStartX, clientY: touchStartY, button: 0 });
				selectHandler.handlePointerDown(synth);
				dragHandler.handlePointerDown(synth);
			} else {
				pendingPan = true;
				pointerStartX = touchStartX;
				pointerStartY = touchStartY;
			}
		}

		if (touchStartedOnAp && dragHandler.isDragging) {
			dragHandler.handlePointerMove(new PointerEvent('pointermove', { clientX: t.clientX, clientY: t.clientY }));
		} else if (pendingPan) {
			engine.camera.pan(
				(t.clientX - pointerStartX) / engine.camera.state.zoom,
				(t.clientY - pointerStartY) / engine.camera.state.zoom
			);
			pointerStartX = t.clientX;
			pointerStartY = t.clientY;
			engine.markDirty();
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (activeTouches === 1 && e.touches.length === 0) {
			// Wall edit mode: end stroke
			if (appState.wallEditMode) {
				wallEditHandler.handlePointerUp();
				brushCursorVisible = false;
				activeTouches = 0;
				return;
			}

			if (!touchMoved && engine) {
				const rect = engine.canvas.getBoundingClientRect();
				const hit = hitTest({ x: touchStartX - rect.left, y: touchStartY - rect.top }, engine.camera, apState.aps.filter(ap => ap.floorId === floorState.currentFloorId));

				if (hit) {
					selectHandler.handlePointerDown(new PointerEvent('pointerdown', { clientX: touchStartX, clientY: touchStartY, button: 0 }));
				} else {
					placeHandler.handlePointerDown(new PointerEvent('pointerdown', { clientX: touchStartX, clientY: touchStartY, button: 0 }));
				}
			}
			pendingPan = false;
			touchStartedOnAp = false;
			dragHandler.handlePointerUp();
			selectHandler.handlePointerUp(new PointerEvent('pointerup'));
		}
		activeTouches = e.touches.length;
		if (activeTouches === 0) {
			pinchFrames = 0;
			pinchLastDist = 0;
		}
	}

	function processPointerDown(e: PointerEvent) {
		if (!engine) return;
		if (activeTouches >= 2) return;

		const rect = engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const hit = hitTest(screenPoint, engine.camera, apState.aps.filter(ap => ap.floorId === floorState.currentFloorId));

		if (hit) {
			selectHandler.handlePointerDown(e);
			dragHandler.handlePointerDown(e);
			pendingPlace = false;
			pendingPan = false;
		} else if (e.shiftKey) {
			selectHandler.handlePointerDown(e);
			pendingPlace = false;
			pendingPan = false;
		} else {
			pendingPlace = true;
			pendingPan = false;
			pointerStartX = e.clientX;
			pointerStartY = e.clientY;
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (!engine) return;
		if (e.button === 1) return;
		if (e.pointerType === 'touch') return;
		// Wall edit mode intercepts primary pointer
		if (appState.wallEditMode) {
			wallEditHandler.activeMaterial = wallEditMaterial;
			wallEditHandler.defaultMaterial = wallState.wallMaterial;
			wallEditHandler.handlePointerDown(e);
			return;
		}
		processPointerDown(e);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!engine) return;
		if (e.pointerType === 'touch') return;
		if (appState.wallEditMode) {
			const rect = engine.canvas.getBoundingClientRect();
			brushCursorX = e.clientX - rect.left;
			brushCursorY = e.clientY - rect.top;
			brushCursorSize = appState.wallBrushSize * 2 * engine.camera.state.zoom;
			brushCursorVisible = true;
			wallEditHandler.handlePointerMove(e);
			return;
		}

		if (dragHandler.isDragging) {
			dragHandler.handlePointerMove(e);
			return;
		}

		if (pendingPlace) {
			const dx = e.clientX - pointerStartX;
			const dy = e.clientY - pointerStartY;
			if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
				// Moved beyond threshold: this is a pan, not a tap-to-place
				pendingPlace = false;
				pendingPan = true;
				// Start panning from the original position
				engine.canvas.style.cursor = 'grabbing';
			}
		}

		if (pendingPan) {
			const dx = (e.clientX - pointerStartX) / engine.camera.state.zoom;
			const dy = (e.clientY - pointerStartY) / engine.camera.state.zoom;
			engine.camera.pan(dx, dy);
			pointerStartX = e.clientX;
			pointerStartY = e.clientY;
			engine.markDirty();
			return;
		}

		selectHandler.handlePointerMove(e);
	}

	function handlePointerUp(e: PointerEvent) {
		if (!engine) return;
		if (appState.wallEditMode) {
			wallEditHandler.handlePointerUp();
			return;
		}

		if (pendingPlace) {
			pendingPlace = false;
			// Check if click was on a wall pixel first (for material popup)
			const rect = engine.canvas.getBoundingClientRect();
			const sx = e.clientX - rect.left;
			const sy = e.clientY - rect.top;
			if (!handleWallClick(sx, sy)) {
				// Not a wall click — place an AP
				placeHandler.handlePointerDown(e);
			}
		}

		if (pendingPan) {
			pendingPan = false;
			engine.canvas.style.cursor = '';
		}

		selectHandler.handlePointerUp(e);
		dragHandler.handlePointerUp();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="canvas-container"
	class:drag-over={canvasDragOver}
	bind:this={containerEl}
	ondrop={handleCanvasDrop}
	ondragover={handleCanvasDragOver}
	ondragleave={handleCanvasDragLeave}
>
	<canvas
		bind:this={canvasEl}
		role="application"
		aria-label="Channel planning canvas"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointerleave={() => { brushCursorVisible = false; }}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		ontouchcancel={handleTouchEnd}
	></canvas>
	{#if !appState.wallEditMode}
		<LayerPanel />
	{/if}
	{#if appState.wallEditMode}
		<WallEditToolbar bind:activeMaterial={wallEditMaterial} ondone={handleWallEditDone} />
		{#if brushCursorVisible}
			<div
				class="brush-cursor"
				style="left: {brushCursorX - brushCursorSize / 2}px; top: {brushCursorY - brushCursorSize / 2}px; width: {brushCursorSize}px; height: {brushCursorSize}px"
			></div>
		{/if}
	{/if}
	{#if showEmptyHint}
		<div class="empty-hint">
			<p>Drop a floorplan image here</p>
			<p>or click the canvas to place access points</p>
		</div>
	{/if}
</div>

{#if wallPopup}
	<WallMaterialPopup
		x={wallPopup.x}
		y={wallPopup.y}
		currentMaterial={wallPopup.material}
		onselect={handleMaterialSelect}
		onclose={() => { wallPopup = null; }}
	/>
{/if}

<style>
	.canvas-container {
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--canvas-bg);
		position: relative;
	}

	.brush-cursor {
		position: absolute;
		border: 1.5px solid var(--accent-primary);
		border-radius: 50%;
		pointer-events: none;
		z-index: 15;
		opacity: 0.7;
	}

	.canvas-container.drag-over {
		outline: 3px dashed var(--accent-primary);
		outline-offset: -3px;
	}

	canvas {
		display: block;
		touch-action: none;
	}

	.empty-hint {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		gap: var(--space-1, 4px);
	}

	.empty-hint p {
		margin: 0;
		font-size: var(--text-base);
		color: var(--text-tertiary);
		opacity: 0.6;
	}

</style>
