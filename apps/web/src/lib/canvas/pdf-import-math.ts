const PT_PER_INCH = 72;
const METERS_PER_INCH = 0.0254;
const SCALE_RE = /^(?:(\d+(?:\.\d+)?)[:/])?(\d+(?:\.\d+)?)$/;

/** Render scale (px per PDF point) that fits the longest page side within maxPx, capped at maxScale. */
export function pdfRenderScale(
	widthPt: number,
	heightPt: number,
	maxPx = 2400,
	maxScale = 4
): number {
	return Math.min(maxPx / Math.max(widthPt, heightPt), maxScale);
}

/** World units per metre for a PDF page of the given width drawn at 1:scaleDenominator and shown targetWidth units wide. */
export function wupmFromScale(
	pageWidthPt: number,
	scaleDenominator: number,
	targetWidth = 800
): number {
	return targetWidth / ((pageWidthPt / PT_PER_INCH) * METERS_PER_INCH * scaleDenominator);
}

/** Parses a drawing scale such as "1:100", "1/100" or "100" into its denominator, or null if invalid. */
export function parseScale(input: string): number | null {
	const match = SCALE_RE.exec(input.replace(/\s+/g, ''));
	if (!match) return null;
	const [, numerator, denominator] = match;
	if (numerator !== undefined && Number(numerator) !== 1) return null;
	const value = Number(denominator);
	return value > 0 ? value : null;
}

/** True when the file is a PDF by MIME type or by a `.pdf` extension (case-insensitive). */
export function isPdfFile(file: { type: string; name: string }): boolean {
	return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
