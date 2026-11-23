import { beforeEach, describe, expect, it } from 'vitest';
import {
	PdfImportCancelledError,
	cancelPdfScale,
	closePdfImport,
	isPdfImportCancelRequested,
	pdfImportState,
	requestPdfImportCancel,
	requestPdfScale,
	showPdfError,
	showPdfProgress,
	startPdfImport,
	submitPdfScale
} from './pdf-import.svelte.js';

describe('pdf import state', () => {
	beforeEach(() => {
		// Settle any request left pending by a previous test, then reset the dialog.
		cancelPdfScale();
		startPdfImport(); // clears the cancel flag
		closePdfImport();
		pdfImportState.phase = 'scale';
		pdfImportState.page = 0;
		pdfImportState.pages = 0;
		pdfImportState.error = '';
	});

	it('opens the dialog in the scale phase when a scale is requested', () => {
		void requestPdfScale().catch(() => {});
		expect(pdfImportState.open).toBe(true);
		expect(pdfImportState.phase).toBe('scale');
	});

	it('resolves with the submitted denominator', async () => {
		const request = requestPdfScale();
		submitPdfScale(100);
		await expect(request).resolves.toBe(100);
	});

	it('resolves with null for "I don\'t know"', async () => {
		const request = requestPdfScale();
		submitPdfScale(null);
		await expect(request).resolves.toBeNull();
	});

	it('rejects with a cancellation error and closes the dialog on cancel', async () => {
		const request = requestPdfScale();
		cancelPdfScale();
		await expect(request).rejects.toBeInstanceOf(PdfImportCancelledError);
		expect(pdfImportState.open).toBe(false);
	});

	it('cancels a superseded request instead of leaving it dangling', async () => {
		const first = requestPdfScale();
		const second = requestPdfScale();
		await expect(first).rejects.toBeInstanceOf(PdfImportCancelledError);
		submitPdfScale(50);
		await expect(second).resolves.toBe(50);
	});

	it('ignores submit and cancel when nothing is pending', () => {
		expect(() => submitPdfScale(100)).not.toThrow();
		expect(() => cancelPdfScale()).not.toThrow();
	});

	it('tracks progress, errors and closing', () => {
		showPdfProgress(2, 5);
		expect(pdfImportState).toMatchObject({ open: true, phase: 'importing', page: 2, pages: 5 });

		showPdfError('Not a PDF');
		expect(pdfImportState).toMatchObject({ open: true, phase: 'error', error: 'Not a PDF' });

		closePdfImport();
		expect(pdfImportState.open).toBe(false);
	});

	it('clears stale progress and errors when a new scale request opens', () => {
		showPdfProgress(3, 3);
		showPdfError('boom');
		void requestPdfScale().catch(() => {});
		expect(pdfImportState).toMatchObject({ phase: 'scale', page: 0, pages: 0, error: '' });
	});

	describe('cancelling a running import', () => {
		it('starts an import in the importing phase with no cancel pending', () => {
			startPdfImport();
			expect(pdfImportState).toMatchObject({
				open: true,
				phase: 'importing',
				page: 0,
				pages: 0,
				cancelling: false
			});
			expect(isPdfImportCancelRequested()).toBe(false);
		});

		it('flags the cancel and shows it while importing', () => {
			startPdfImport();
			showPdfProgress(2, 3);
			requestPdfImportCancel();
			expect(isPdfImportCancelRequested()).toBe(true);
			expect(pdfImportState.cancelling).toBe(true);
			// The dialog stays open until the import notices and closes it.
			expect(pdfImportState.open).toBe(true);
		});

		it('ignores a cancel request outside the importing phase', () => {
			// Dialog closed.
			requestPdfImportCancel();
			expect(isPdfImportCancelRequested()).toBe(false);

			// Scale phase: cancelling there is `cancelPdfScale`'s job.
			void requestPdfScale().catch(() => {});
			requestPdfImportCancel();
			expect(isPdfImportCancelRequested()).toBe(false);
			expect(pdfImportState.cancelling).toBe(false);

			// Error phase.
			showPdfError('boom');
			requestPdfImportCancel();
			expect(isPdfImportCancelRequested()).toBe(false);
		});

		it('clears the cancel flag when the next import starts', () => {
			startPdfImport();
			requestPdfImportCancel();
			closePdfImport();
			expect(pdfImportState.cancelling).toBe(false);

			startPdfImport();
			expect(isPdfImportCancelRequested()).toBe(false);
			expect(pdfImportState.cancelling).toBe(false);
		});

		it('does not show a stale cancelling state when a new scale request opens', () => {
			startPdfImport();
			requestPdfImportCancel();
			void requestPdfScale().catch(() => {});
			expect(pdfImportState).toMatchObject({ phase: 'scale', cancelling: false });
		});
	});
});
