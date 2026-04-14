import { jsPDF } from 'jspdf';
import { projectState } from '$state/project.svelte.js';
import { solverState } from '$state/solver.svelte.js';
import { optimizerState } from '$state/optimizer.svelte.js';
import { floorState } from '$state/floor-state.svelte.js';
import type { CanvasEngine } from '$canvas/engine.js';

const bandLabels: Record<string, string> = {
	'2.4ghz': '2.4 GHz',
	'5ghz': '5 GHz',
	'6ghz': '6 GHz'
};

export async function exportPdf(engine: CanvasEngine): Promise<void> {
	const doc = new jsPDF({
		orientation: 'landscape',
		unit: 'mm',
		format: 'a4'
	});

	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const margin = 15;
	const contentWidth = pageWidth - margin * 2;
	// --- Page 1: Layout View ---

	doc.setFontSize(16);
	doc.setFont('helvetica', 'bold');
	doc.text(projectState.name, margin, margin + 5);

	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(120);
	const dateStr = new Date().toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	const floorCount = floorState.floors.length;
	const apCount = projectState.aps.length;
	doc.text(
		`${dateStr}  |  ${apCount} access point${apCount !== 1 ? 's' : ''}  |  ${floorCount} floor${floorCount !== 1 ? 's' : ''}`,
		margin,
		margin + 11
	);
	doc.setTextColor(0);

	// Canvas snapshot
	const canvasEl = engine.canvas;
	const tempCanvas = document.createElement('canvas');
	const scale = 2;
	const srcWidth = canvasEl.width / (window.devicePixelRatio || 1);
	const srcHeight = canvasEl.height / (window.devicePixelRatio || 1);
	tempCanvas.width = srcWidth * scale;
	tempCanvas.height = srcHeight * scale;
	const tempCtx = tempCanvas.getContext('2d')!;
	tempCtx.scale(scale, scale);

	tempCtx.fillStyle = '#0a0c12';
	tempCtx.fillRect(0, 0, srcWidth, srcHeight);

	const dpr = scale;
	const rc = {
		ctx: tempCtx,
		camera: engine.camera,
		width: srcWidth,
		height: srcHeight,
		dpr,
		compositeOffscreen: (offscreen: HTMLCanvasElement, alpha = 1) => {
			tempCtx.resetTransform();
			tempCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
			if (alpha < 1) tempCtx.globalAlpha = alpha;
			tempCtx.drawImage(offscreen, 0, 0);
			if (alpha < 1) tempCtx.globalAlpha = 1;
		}
	};
	for (const layer of engine.layers) {
		if (!layer.visible) continue;
		if (layer.id === 'grid' || layer.id === 'selection-rect') continue;
		tempCtx.save();
		layer.render(rc);
		tempCtx.restore();
	}

	const imgData = tempCanvas.toDataURL('image/jpeg', 0.85);

	const imgY = margin + 15;
	const maxImgHeight = pageHeight - imgY - margin;
	const aspectRatio = srcWidth / srcHeight;
	let imgWidth = contentWidth;
	let imgHeight = imgWidth / aspectRatio;
	if (imgHeight > maxImgHeight) {
		imgHeight = maxImgHeight;
		imgWidth = imgHeight * aspectRatio;
	}

	// Label current floor if multi-floor
	if (floorCount > 1) {
		const curFloor = floorState.floors.find((f) => f.id === floorState.currentFloorId);
		if (curFloor) {
			doc.setFontSize(8);
			doc.setFont('helvetica', 'italic');
			doc.setTextColor(120);
			doc.text(`Layout view: ${curFloor.name}`, margin, imgY - 2);
			doc.setTextColor(0);
			doc.setFont('helvetica', 'normal');
		}
	}

	doc.addImage(imgData, 'JPEG', margin, imgY, imgWidth, imgHeight);

	// --- Page 2: AP Schedule ---
	doc.addPage();

	doc.setFontSize(14);
	doc.setFont('helvetica', 'bold');
	doc.text('Access Point Schedule', margin, margin + 5);

	// Table
	const hasModel = projectState.aps.some((ap) => ap.modelLabel);
	const hasFloors = floorState.floors.length > 1;

	const cols: Array<{
		header: string;
		width: number;
		getValue: (ap: (typeof projectState.aps)[0]) => string;
	}> = [];
	cols.push({ header: 'Name', width: 35, getValue: (ap) => ap.name });
	if (hasFloors) {
		cols.push({
			header: 'Floor',
			width: 25,
			getValue: (ap) => floorState.floors.find((f) => f.id === ap.floorId)?.name ?? '-'
		});
	}
	cols.push({ header: 'Model', width: 55, getValue: (ap) => ap.modelLabel ?? 'Custom' });
	cols.push({ header: 'Band', width: 20, getValue: (ap) => bandLabels[ap.band] ?? ap.band });
	cols.push({ header: 'Ch. Width', width: 22, getValue: (ap) => `${ap.channelWidth} MHz` });
	cols.push({
		header: 'Channel',
		width: 22,
		getValue: (ap) => (ap.assignedChannel !== null ? String(ap.assignedChannel) : '-')
	});

	let y = margin + 15;

	// Header row
	doc.setFillColor(235, 235, 240);
	doc.rect(margin, y - 4, contentWidth, 7, 'F');
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(7.5);

	let x = margin;
	for (const col of cols) {
		doc.text(col.header, x + 1, y);
		x += col.width;
	}

	y += 7;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(7.5);

	// Group by floor if multi-floor
	const sortedFloors = hasFloors
		? [...floorState.floors].sort((a, b) => a.level - b.level)
		: [{ id: '', name: '', level: 0 }];

	for (const floor of sortedFloors) {
		const floorAps = hasFloors
			? projectState.aps.filter((ap) => ap.floorId === floor.id)
			: projectState.aps;

		// Floor section header for multi-floor
		if (hasFloors && floorAps.length > 0) {
			y += 2;
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(8);
			doc.setFillColor(230, 235, 245);
			doc.rect(margin, y - 4, contentWidth, 6, 'F');
			doc.text(floor.name, margin + 1, y);
			y += 6;
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(7.5);
		}

		for (let idx = 0; idx < floorAps.length; idx++) {
			const ap = floorAps[idx]!;

			if (idx % 2 === 0) {
				doc.setFillColor(248, 248, 250);
				doc.rect(margin, y - 4, contentWidth, 6, 'F');
			}

			x = margin;
			for (const col of cols) {
				doc.text(col.getValue(ap), x + 1, y);
				x += col.width;
			}

			y += 6;
			if (y > pageHeight - margin) {
				doc.addPage();
				y = margin + 5;
			}
		}
	}

	// Summary
	y += 5;
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9);
	doc.text(`Total: ${apCount} access point${apCount !== 1 ? 's' : ''}`, margin, y);

	if (optimizerState.coverage > 0) {
		y += 5;
		doc.setFont('helvetica', 'normal');
		const curFloorName =
			floorState.floors.find((f) => f.id === floorState.currentFloorId)?.name ?? '';
		doc.text(`Coverage (${curFloorName}): ${optimizerState.coverage}%`, margin, y);
	}

	if (solverState.lastResult) {
		y += 5;
		doc.setFont('helvetica', 'normal');
		doc.text(
			`Channels used: ${solverState.lastResult.colorCount}  |  Conflicts: ${solverState.lastResult.conflicts.length}`,
			margin,
			y
		);
	}

	// Save
	const filename = projectState.name.replace(/[^a-zA-Z0-9-_]/g, '_');
	doc.save(`${filename}-report.pdf`);
}
