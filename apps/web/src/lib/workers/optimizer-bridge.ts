export interface OptimizeResult {
	positions: Array<{ id: string; x: number; y: number }>;
	score: number;
	improvement: number;
}

export interface OptimizeProgress {
	positions: Array<{ id: string; x: number; y: number }>;
	score: number;
	iteration: number;
	totalIterations: number;
}

export class OptimizerBridge {
	private worker: Worker | null = null;
	private pendingResolve: ((value: OptimizeResult) => void) | null = null;
	private pendingReject: ((reason: unknown) => void) | null = null;
	private onProgress: ((progress: OptimizeProgress) => void) | null = null;

	private getWorker(): Worker {
		if (!this.worker) {
			this.worker = new Worker(new URL('./optimizer-worker.ts', import.meta.url), {
				type: 'module'
			});
			this.worker.onmessage = (event) => {
				const { data } = event;
				if (data.type === 'result' && this.pendingResolve) {
					this.pendingResolve(data as OptimizeResult);
					this.cleanup();
				} else if (data.type === 'progress' && this.onProgress) {
					this.onProgress(data as OptimizeProgress);
				} else if (data.type === 'cancelled') {
					if (this.pendingReject) {
						this.pendingReject(new Error('Cancelled'));
					}
					this.cleanup();
				}
			};
			this.worker.onerror = (err) => {
				if (this.pendingReject) {
					this.pendingReject(err);
				}
				this.cleanup();
			};
		}
		return this.worker;
	}

	private cleanup(): void {
		this.pendingResolve = null;
		this.pendingReject = null;
		this.onProgress = null;
	}

	optimize(
		aps: Array<{ id: string; x: number; y: number; interferenceRadius: number }>,
		wallMaskDataUrl: string,
		maskWidth: number,
		maskHeight: number,
		wallAttenuation: number,
		options?: {
			iterations?: number;
			boundary?: Array<{ x: number; y: number }>;
			onProgress?: (progress: OptimizeProgress) => void;
		}
	): Promise<OptimizeResult> {
		return new Promise((resolve, reject) => {
			if (this.pendingReject) {
				this.pendingReject(new Error('Superseded'));
			}
			this.pendingResolve = resolve;
			this.pendingReject = reject;
			this.onProgress = options?.onProgress ?? null;

			this.getWorker().postMessage({
				type: 'optimize',
				aps,
				wallMaskDataUrl,
				maskWidth,
				maskHeight,
				wallAttenuation,
				iterations: options?.iterations ?? 5000,
				boundary: options?.boundary ?? []
			});
		});
	}

	cancel(): void {
		this.getWorker().postMessage({ type: 'cancel' });
	}

	terminate(): void {
		this.worker?.terminate();
		this.worker = null;
		this.cleanup();
	}
}
