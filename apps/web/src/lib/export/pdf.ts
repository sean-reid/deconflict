import { jsPDF } from 'jspdf';
import { projectState } from '$state/project.svelte.js';
import { solverState } from '$state/solver.svelte.js';
import type { CanvasEngine } from '$canvas/engine.js';

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

	// Title
	doc.setFontSize(16);
	doc.setFont('helvetica', 'bold');
	doc.text(projectState.name, margin, margin + 5);

	// Subtitle
	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');
	doc.setTextColor(150);
	const dateStr = new Date().toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
	doc.text(`Generated ${dateStr}`, margin, margin + 11);
	doc.setTextColor(0);

	// Canvas snapshot
	const canvasEl = engine.canvas;
	// Create a temporary canvas at 2x for quality
	const tempCanvas = document.createElement('canvas');
	const scale = 2;
	const srcWidth = canvasEl.width / (window.devicePixelRatio || 1);
	const srcHeight = canvasEl.height / (window.devicePixelRatio || 1);
	tempCanvas.width = srcWidth * scale;
	tempCanvas.height = srcHeight * scale;
	const tempCtx = tempCanvas.getContext('2d')!;
	tempCtx.scale(scale, scale);

	// Fill background
	tempCtx.fillStyle = '#0a0c12';
	tempCtx.fillRect(0, 0, srcWidth, srcHeight);

	// Render layers (skip grid and selection rect)
	const rc = {
		ctx: tempCtx,
		camera: engine.camera,
		width: srcWidth,
		height: srcHeight,
		dpr: scale
	};
	for (const layer of engine.layers) {
		if (!layer.visible) continue;
		if (layer.id === 'grid' || layer.id === 'selection-rect') continue;
		tempCtx.save();
		layer.render(rc);
		tempCtx.restore();
	}

	const imgData = tempCanvas.toDataURL('image/jpeg', 0.85);

	// Calculate image dimensions to fit page
	const imgY = margin + 15;
	const maxImgHeight = pageHeight - imgY - margin;
	const aspectRatio = srcWidth / srcHeight;
	let imgWidth = contentWidth;
	let imgHeight = imgWidth / aspectRatio;
	if (imgHeight > maxImgHeight) {
		imgHeight = maxImgHeight;
		imgWidth = imgHeight * aspectRatio;
	}

	doc.addImage(imgData, 'JPEG', margin, imgY, imgWidth, imgHeight);

	// --- Page 2: AP Schedule ---
	doc.addPage();

	doc.setFontSize(14);
	doc.setFont('helvetica', 'bold');
	doc.text('Access Point Schedule', margin, margin + 5);

	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');

	// Table header
	const colWidths = [35, 20, 25, 25, 25, 20, 20, 20];
	const headers = ['Name', 'Band', 'Width', 'Channel', 'Radius', 'Power', 'X', 'Y'];
	let y = margin + 15;

	doc.setFillColor(240, 240, 240);
	doc.rect(margin, y - 4, contentWidth, 7, 'F');
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(8);

	let x = margin;
	for (let i = 0; i < headers.length; i++) {
		doc.text(headers[i]!, x + 1, y);
		x += colWidths[i]!;
	}

	y += 7;
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);

	const bandLabels: Record<string, string> = {
		'2.4ghz': '2.4 GHz',
		'5ghz': '5 GHz',
		'6ghz': '6 GHz'
	};

	for (let idx = 0; idx < projectState.aps.length; idx++) {
		const ap = projectState.aps[idx]!;

		// Alternating row background
		if (idx % 2 === 0) {
			doc.setFillColor(248, 248, 248);
			doc.rect(margin, y - 4, contentWidth, 6, 'F');
		}

		x = margin;
		const row = [
			ap.name,
			bandLabels[ap.band] ?? ap.band,
			`${ap.channelWidth} MHz`,
			ap.assignedChannel !== null ? String(ap.assignedChannel) : 'Auto',
			String(ap.interferenceRadius),
			`${ap.power} dBm`,
			String(Math.round(ap.x)),
			String(Math.round(ap.y))
		];

		for (let i = 0; i < row.length; i++) {
			doc.text(row[i]!, x + 1, y);
			x += colWidths[i]!;
		}

		y += 6;

		// Page break if needed
		if (y > pageHeight - margin) {
			doc.addPage();
			y = margin + 5;
		}
	}

	// Summary
	y += 5;
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(9);
	doc.text(`Total: ${projectState.aps.length} access points`, margin, y);

	if (solverState.lastResult) {
		y += 5;
		doc.setFont('helvetica', 'normal');
		const algo = solverState.algorithm.charAt(0).toUpperCase() + solverState.algorithm.slice(1);
		doc.text(
			`Solver: ${algo} | Colors: ${solverState.lastResult.colorCount} | Conflicts: ${solverState.lastResult.conflicts.length} | Time: ${solverState.lastTiming.toFixed(1)}ms`,
			margin,
			y
		);
	}

	// Save
	const filename = projectState.name.replace(/[^a-zA-Z0-9-_]/g, '_');
	doc.save(`${filename}-report.pdf`);
}
