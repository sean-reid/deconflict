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
	import { labelWallBlobs, relabelBlob, labelRooms, fillRegion, encodeMaterialMask, decodeMaterialMask } from '$canvas/region-labels.js';
	import type { RegionLabels } from '$canvas/region-labels.js';
	import { WALL_MATERIALS, type WallMaterialId } from '$canvas/materials.js';
	import { floorState, currentFloor, getFloorSlabAttenuation } from '$state/floor-state.svelte.js';
	import { FLOOR_MATERIALS } from '$canvas/floor-materials.js';
	import type { Band } from '@deconflict/channels';
	import { TiledMask } from '$canvas/tiled-mask.js';
	import { scheduleSave } from '$state/persistence.svelte.js';
	import { computeBuildingInterior } from '$canvas/morphology.js';
	import { RoomLabelsLayer } from '$canvas/renderers/room-labels.js';
	import { ROOM_TYPES } from '$canvas/room-types.js';
	import LayerPanel from '$components/canvas/LayerPanel.svelte';
	import WallMaterialPopup from '$components/canvas/WallMaterialPopup.svelte';
	import RoomTypePopup from '$components/canvas/RoomTypePopup.svelte';
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

			// Recompute interior + room labels for room type detection
			const interiorResult = computeBuildingInterior(data, width, height, { maxDim: 400 });
			cachedInterior = interiorResult.interior;
			cachedRoomLabels = labelRooms(cachedInterior, width, height);

			// Room type data may need resizing if mask dimensions changed
			if (cachedRoomTypeData && cachedRoomTypeData.length !== width * height) {
				cachedRoomTypeData = null;
				wallState.roomTypeMask = null;
			}
			if (roomLabelsLayer) {
				roomLabelsLayer.roomLabels = cachedRoomLabels;
				roomLabelsLayer.roomTypeData = cachedRoomTypeData;
				roomLabelsLayer.maskWidth = width;
				roomLabelsLayer.maskHeight = height;
				roomLabelsLayer.originX = originX;
				roomLabelsLayer.originY = originY;
				roomLabelsLayer.invalidateCache();
			}

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

	// Room type popup state
	let roomPopup = $state<{ x: number; y: number; typeId: number; density: number; customLabel: string; regionId: number } | null>(null);
	let cachedInterior: Uint8Array | null = null;
	let cachedRoomLabels: RegionLabels | null = null;
	let cachedRoomTypeData: Uint8Array | null = null;
	let roomLabelsLayer: RoomLabelsLayer;

	// Long-press detection for mobile contextual actions
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	const LONG_PRESS_MS = 500;
	let longPressFired = false;

	function handleWallClick(screenX: number, screenY: number): boolean {
		if (!engine || !cachedWallData || !cachedWallLabels) return false;
		const world = engine.camera.screenToWorld({ x: screenX, y: screenY });
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

	function handleRoomClick(screenX: number, screenY: number): boolean {
		if (!engine || !cachedInterior || !cachedRoomLabels) return false;
		const world = engine.camera.screenToWorld({ x: screenX, y: screenY });
		const px = Math.round(world.x) - cachedMaskOriginX;
		const py = Math.round(world.y) - cachedMaskOriginY;
		const mask = wallState.wallMask;
		if (!mask || px < 0 || px >= mask.width || py < 0 || py >= mask.height) return false;
		const idx = py * mask.width + px;

		// Must be an interior pixel (not a wall, not exterior)
		if (!cachedInterior[idx]) return false;

		const regionId = cachedRoomLabels.labels[idx]!;
		if (regionId < 0) return false;

		const typeId = cachedRoomTypeData ? (cachedRoomTypeData[idx] ?? 0) : 0;
		const floor = currentFloor();
		const densityOverride = floor.roomDensityOverrides[String(regionId)];
		const roomType = ROOM_TYPES.find(t => t.id === typeId);
		const density = densityOverride ?? roomType?.defaultDensity ?? 0;
		const customLabel = floor.roomCustomLabels?.[String(regionId)] ?? '';

		roomPopup = { x: screenX, y: screenY, typeId, density, customLabel, regionId };
		return true;
	}

	/** Right-click / long-press contextual handler: wall popup or room popup. */
	function handleContextAction(screenX: number, screenY: number): boolean {
		// Try wall first, then room
		if (handleWallClick(screenX, screenY)) return true;
		if (handleRoomClick(screenX, screenY)) return true;
		return false;
	}

	function handleContextMenu(e: MouseEvent) {
		if (!engine || appState.wallEditMode) return;
		e.preventDefault();
		// Close any existing popups before opening a new one
		wallPopup = null;
		roomPopup = null;
		const rect = engine.canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		handleContextAction(sx, sy);
	}

	async function handleRoomTypeSelect(typeId: number, density: number, customLabel?: string) {
		if (!roomPopup || !cachedRoomLabels || !wallState.wallMask) return;
		pushState();
		const mask = wallState.wallMask;

		// Create or clone room type mask
		if (!cachedRoomTypeData) {
			cachedRoomTypeData = new Uint8Array(mask.width * mask.height);
		}

		fillRegion(cachedRoomLabels.labels, cachedRoomTypeData, roomPopup.regionId, typeId);

		// Save per-region density override and custom label
		const floor = currentFloor();
		const regionKey = String(roomPopup.regionId);
		if (typeId === 0) {
			delete floor.roomDensityOverrides[regionKey];
			delete floor.roomCustomLabels[regionKey];
		} else {
			floor.roomDensityOverrides[regionKey] = density;
			if (customLabel) {
				if (!floor.roomCustomLabels) floor.roomCustomLabels = {};
				floor.roomCustomLabels[regionKey] = customLabel;
			} else {
				delete floor.roomCustomLabels?.[regionKey];
			}
		}

		// Update renderer
		roomLabelsLayer.roomTypeData = cachedRoomTypeData;
		roomLabelsLayer.roomLabels = cachedRoomLabels;
		roomLabelsLayer.densityOverrides = floor.roomDensityOverrides;
		roomLabelsLayer.customLabels = floor.roomCustomLabels ?? {};
		roomLabelsLayer.invalidateCache();
		engine.markDirty();

		// Encode and persist
		const dataUrl = encodeMaterialMask(cachedRoomTypeData, mask.width, mask.height);
		wallState.roomTypeMask = { dataUrl, width: mask.width, height: mask.height, originX: cachedMaskOriginX, originY: cachedMaskOriginY };
		scheduleSave();

		// Update coverage with new density weights
		updateCoverage();
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
		wallState.materialMask = { dataUrl, width: mask.width, height: mask.height, originX: cachedMaskOriginX, originY: cachedMaskOriginY };
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
			if (appState.wallEditMode) return; // no undo during wall drawing
			e.preventDefault();
			redo();
			engine?.markDirty();
			return;
		}

		if (mod && (e.key === 'z' || e.key === 'Z')) {
			if (appState.wallEditMode) return; // no undo during wall drawing
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
		roomLabelsLayer = new RoomLabelsLayer();
		apLayer = new ApLayer();
		selectionRectLayer = new SelectionRectLayer();

		// Add layers in draw order: floorplan, grid, heatmap, walls, room labels, APs, selection rect
		engine.addLayer(floorplanLayer);
		engine.addLayer(gridLayer);
		engine.addLayer(heatmapLayer);
		engine.addLayer(wallLayer);
		engine.addLayer(roomLabelsLayer);
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
			// Don't rebuild attenuation fields per stroke — too expensive.
			// Wall overlay updates live; heatmap uses stale field until Done.
			engine.markDirty();

			// Defer solver to Done — per-stroke solve is too expensive
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

			// Sum vertical gap and total slab thickness between floors
			const loLevel = Math.min(cur.level, adj.level);
			const hiLevel = Math.max(cur.level, adj.level);
			let totalVertGap = 0;
			let totalSlabThickness = 0;
			for (const f of sortedFloors) {
				if (f.level < loLevel || f.level >= hiLevel) continue;
				totalVertGap += f.ceilingHeight;
				const upperIdx = sortedFloors.findIndex((s) => s.level === f.level + 1);
				if (upperIdx >= 0) {
					const upper = sortedFloors[upperIdx]!;
					const mat = FLOOR_MATERIALS[upper.floorMaterial];
					if (mat) totalSlabThickness += upper.floorThickness;
				}
			}

			for (const ap of adjAps) {
				const totalDb = getFloorSlabAttenuation(floorId, adj.id, ap.band as Band);
				virtualAps.push({
					...ap,
					id: `virtual-${ap.id}`,
					verticalOffset: totalVertGap,
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
				outgoing.roomTypeMask = wallState.roomTypeMask;
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
		wallState.roomTypeMask = floor.roomTypeMask;

		// Cancel wall edit mode on floor switch to prevent editing the wrong floor
		if (appState.wallEditMode) {
			appState.wallEditMode = null;
		}

		// Force wall mask re-decode on floor switch (prevent stale cache).
		// Clear renderer references immediately so stale wall data from
		// the previous floor doesn't render while the decode is in-flight.
		lastWallMaskUrl = null;
		lastMatMaskUrl = null;
		cachedWallData = null;
		cachedMaterialData = null;
		cachedWallLabels = null;
		cachedTiledMask = null;
		cachedInterior = null;
		cachedRoomLabels = null;
		cachedRoomTypeData = null;
		if (wallLayer) {
			wallLayer.mask = null;
			wallLayer.materialMap = null;
			wallLayer.invalidateCache();
		}
		if (heatmapLayer) {
			heatmapLayer.wallMask = null;
			heatmapLayer.materialMap = null;
			heatmapLayer.markWallsDirty();
		}
		if (roomLabelsLayer) {
			roomLabelsLayer.roomTypeData = null;
			roomLabelsLayer.roomLabels = null;
			roomLabelsLayer.invalidateCache();
		}

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
			cachedInterior = null;
			cachedRoomLabels = null;
			cachedRoomTypeData = null;
			if (roomLabelsLayer) {
				roomLabelsLayer.roomTypeData = null;
				roomLabelsLayer.roomLabels = null;
				roomLabelsLayer.invalidateCache();
			}
			engine.markDirty();
			return;
		}

		const wallPromise = decodeMask(mask.dataUrl, mask.width, mask.height);
		const matPromise = matMask ? decodeMaterialMask(matMask.dataUrl, matMask.width, matMask.height) : null;

		wallPromise.then(async (decoded) => {
			if (wallMaskVersion !== thisVersion) return;
			const matData = matPromise ? await matPromise : null;
			if (wallMaskVersion !== thisVersion) return;

			// Propagate the stored origin to the decoded mask
			decoded.originX = mask.originX ?? 0;
			decoded.originY = mask.originY ?? 0;

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
				matData, defaultMat,
				decoded.originX, decoded.originY
			);
			if (wallEditHandler) {
				wallEditHandler.tiledMask = cachedTiledMask;
			}

			// Compute building interior + room labels for room type detection
			const interiorResult = computeBuildingInterior(decoded.data, decoded.width, decoded.height, { maxDim: 400 });
			cachedInterior = interiorResult.interior;
			cachedRoomLabels = labelRooms(cachedInterior, decoded.width, decoded.height);

			// Decode room type mask if persisted
			const rtMask = wallState.roomTypeMask;
			if (rtMask && rtMask.width === decoded.width && rtMask.height === decoded.height) {
				const rtData = await decodeMaterialMask(rtMask.dataUrl, rtMask.width, rtMask.height);
				if (wallMaskVersion !== thisVersion) return;
				cachedRoomTypeData = rtData;
			} else {
				cachedRoomTypeData = null;
			}

			// Feed room data to renderer
			if (roomLabelsLayer) {
				roomLabelsLayer.roomTypeData = cachedRoomTypeData;
				roomLabelsLayer.roomLabels = cachedRoomLabels;
				roomLabelsLayer.maskWidth = decoded.width;
				roomLabelsLayer.maskHeight = decoded.height;
				roomLabelsLayer.originX = decoded.originX;
				roomLabelsLayer.originY = decoded.originY;
				roomLabelsLayer.densityOverrides = currentFloor().roomDensityOverrides;
				roomLabelsLayer.customLabels = currentFloor().roomCustomLabels ?? {};
				roomLabelsLayer.invalidateCache();
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
		if (!roomLabelsLayer) return;
		roomLabelsLayer.visible = appState.showRoomLabels;
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

	let solverPending = false;
	$effect(() => {
		const auto = solverState.autoSolve;
		const _key = autoSolveKey;
		if (!auto || apState.aps.length === 0) return;

		if (autoSolveTimeout) clearTimeout(autoSolveTimeout);
		if (solverState.isRunning) {
			// Queue a re-run after current solve completes
			solverPending = true;
			return;
		}
		autoSolveTimeout = setTimeout(() => {
			runSolver();
		}, 500);
	});

	// Re-run solver when a queued solve was pending
	$effect(() => {
		if (!solverState.isRunning && solverPending) {
			solverPending = false;
			if (autoSolveTimeout) clearTimeout(autoSolveTimeout);
			autoSolveTimeout = setTimeout(() => {
				runSolver();
			}, 200);
		}
	});


	// Update coverage score when APs or wall mask change
	let coverageTimeout: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const _key = autoSolveKey;
		const _mask = wallState.wallMask;
		const _rtMask = wallState.roomTypeMask;
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
			longPressFired = false;

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

			// Start long-press timer for contextual wall/room actions
			if (longPressTimer) clearTimeout(longPressTimer);
			const lpX = t.clientX;
			const lpY = t.clientY;
			longPressTimer = setTimeout(() => {
				longPressTimer = null;
				if (touchMoved || activeTouches !== 1) return;
				if (!engine) return;
				const rect = engine.canvas.getBoundingClientRect();
				const sx = lpX - rect.left;
				const sy = lpY - rect.top;
				if (handleContextAction(sx, sy)) {
					longPressFired = true;
				}
			}, LONG_PRESS_MS);
		} else if (activeTouches >= 2) {
			e.preventDefault();
			// Cancel long-press and single-finger state
			if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
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
			if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
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
		if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }

		if (activeTouches === 1 && e.touches.length === 0) {
			// Wall edit mode: end stroke
			if (appState.wallEditMode) {
				wallEditHandler.handlePointerUp();
				brushCursorVisible = false;
				activeTouches = 0;
				return;
			}

			// Skip tap action if long-press already fired a contextual popup
			if (!touchMoved && !longPressFired && engine) {
				const rect = engine.canvas.getBoundingClientRect();
				const sx = touchStartX - rect.left;
				const sy = touchStartY - rect.top;
				const hit = hitTest({ x: sx, y: sy }, engine.camera, apState.aps.filter(ap => ap.floorId === floorState.currentFloorId));

				if (hit) {
					selectHandler.handlePointerDown(new PointerEvent('pointerdown', { clientX: touchStartX, clientY: touchStartY, button: 0 }));
				} else if (!handleWallClick(sx, sy)) {
					// Not an AP, not a wall — place AP
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
		if (e.button !== 0) return; // Only handle primary (left) button
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
		if (e.button !== 0) return; // Only handle primary (left) button
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
		oncontextmenu={handleContextMenu}
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
		maxY={containerEl?.getBoundingClientRect().bottom ?? window.innerHeight}
		currentMaterial={wallPopup.material}
		onselect={handleMaterialSelect}
		onclose={() => { wallPopup = null; }}
	/>
{/if}

{#if roomPopup}
	<RoomTypePopup
		x={roomPopup.x}
		y={roomPopup.y}
		maxY={containerEl?.getBoundingClientRect().bottom ?? window.innerHeight}
		currentTypeId={roomPopup.typeId}
		currentDensity={roomPopup.density}
		currentLabel={roomPopup.customLabel}
		onselect={handleRoomTypeSelect}
		onclose={() => { roomPopup = null; }}
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
