import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import {
  denied,
  licenseSchema,
  type LicenseAction,
  type LicenseProvider,
  type LicenseState,
} from './model';
import type { ProductConfig } from './cryptlex';
export class WorkerLicenseProvider implements LicenseProvider {
  private worker: Worker;
  private id = 0;
  private failed = false;
  private pending = new Map<number, (state: LicenseState) => void>();
  constructor(path: string, config: ProductConfig) {
    this.worker = new Worker(path, { workerData: config });
    this.worker.on('message', (raw: unknown) => {
      const parsed = z.object({ id: z.number(), state: licenseSchema }).safeParse(raw);
      if (parsed.success) {
        this.pending.get(parsed.data.id)?.(parsed.data.state);
        this.pending.delete(parsed.data.id);
      }
    });
    this.worker.on('error', () => this.fail());
    this.worker.on('exit', () => this.fail());
  }
  private fail() {
    this.failed = true;
    for (const resolve of this.pending.values()) resolve(denied('unavailable'));
    this.pending.clear();
  }
  run(action: LicenseAction, key?: string): Promise<LicenseState> {
    if (this.failed) return Promise.resolve(denied('unavailable'));
    const id = ++this.id;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.fail();
        void this.worker.terminate();
      }, 45000);
      this.pending.set(id, (state) => {
        clearTimeout(timeout);
        resolve(state);
      });
      this.worker.postMessage({ id, action, key });
    });
  }
  close() {
    this.fail();
    void this.worker.terminate();
  }
}
