import { parentPort, workerData } from 'node:worker_threads';
import { z } from 'zod';
import { CryptlexLicenseProvider } from './cryptlex';
import { LexActivator } from '@cryptlex/lexactivator';
const sdkVersion = LexActivator.GetLibraryVersion();
const config = z
  .object({ productId: z.string().max(256), productData: z.string().max(100000) })
  .parse(workerData);
const provider = new CryptlexLicenseProvider(config);
const request = z.object({
  id: z.number().int(),
  action: z.enum(['check', 'refresh', 'trial', 'activate', 'deactivate']),
  key: z.string().max(256).optional(),
});
parentPort?.on('message', (raw: unknown) => {
  const message = request.parse(raw);
  void provider
    .run(message.action, message.key)
    .then((state) => parentPort?.postMessage({ id: message.id, state: { ...state, sdkVersion } }));
});
