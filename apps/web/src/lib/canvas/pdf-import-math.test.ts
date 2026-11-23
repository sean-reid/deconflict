import { describe, expect, it } from 'vitest';
import { isPdfFile, parseScale, pdfRenderScale, wupmFromScale } from './pdf-import-math.js';

describe('pdfRenderScale', () => {
	it('fits the longest side to maxPx', () => {
		expect(pdfRenderScale(1190.55, 841.89)).toBeCloseTo(2400 / 1190.55, 6);
	});

	it('caps the scale at maxScale for small pages', () => {
		expect(pdfRenderScale(100, 50)).toBe(4);
	});

	it('uses the height when the page is portrait', () => {
		expect(pdfRenderScale(841.89, 1190.55)).toBeCloseTo(2400 / 1190.55, 6);
	});

	it('honours custom maxPx and maxScale', () => {
		expect(pdfRenderScale(1000, 500, 1000, 4)).toBe(1);
		expect(pdfRenderScale(100, 50, 1000, 2)).toBe(2);
	});
});

describe('wupmFromScale', () => {
	it('maps an A3 landscape page at 1:100 to about 19.05 world units per metre', () => {
		expect(wupmFromScale(1190.55, 100)).toBeCloseTo(19.05, 1);
	});

	it('scales inversely with the denominator', () => {
		expect(wupmFromScale(1190.55, 50)).toBeCloseTo(wupmFromScale(1190.55, 100) * 2, 6);
	});

	it('honours a custom target width', () => {
		expect(wupmFromScale(1190.55, 100, 1600)).toBeCloseTo(wupmFromScale(1190.55, 100) * 2, 6);
	});
});

describe('parseScale', () => {
	it('parses colon, slash and bare denominators', () => {
		expect(parseScale('1:100')).toBe(100);
		expect(parseScale('1/100')).toBe(100);
		expect(parseScale('200')).toBe(200);
	});

	it('ignores surrounding and inner whitespace', () => {
		expect(parseScale(' 1 / 50 ')).toBe(50);
		expect(parseScale(' 1 : 100 ')).toBe(100);
	});

	it('accepts decimal denominators', () => {
		expect(parseScale('1:12.5')).toBe(12.5);
	});

	it('returns null for invalid input', () => {
		expect(parseScale('abc')).toBeNull();
		expect(parseScale('0')).toBeNull();
		expect(parseScale('1:0')).toBeNull();
		expect(parseScale('-5')).toBeNull();
		expect(parseScale('1:')).toBeNull();
		expect(parseScale('')).toBeNull();
		expect(parseScale('   ')).toBeNull();
		expect(parseScale('1:abc')).toBeNull();
	});

	it('returns null when the numerator is not 1', () => {
		expect(parseScale('2:100')).toBeNull();
	});
});

describe('isPdfFile', () => {
	it('detects by MIME type', () => {
		expect(isPdfFile({ type: 'application/pdf', name: 'x' })).toBe(true);
	});

	it('detects by extension, case-insensitively', () => {
		expect(isPdfFile({ type: '', name: 'Plano.PDF' })).toBe(true);
	});

	it('rejects other files', () => {
		expect(isPdfFile({ type: 'image/png', name: 'plano.png' })).toBe(false);
		expect(isPdfFile({ type: '', name: 'pdf' })).toBe(false);
	});
});
