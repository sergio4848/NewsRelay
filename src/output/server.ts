import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { type Config, type Item } from '../core/model';
export interface BroadcastOutput {
  start(port: number): Promise<number>;
  stop(): Promise<void>;
  url(test?: boolean): string;
}
type Projection = {
  program: Item | null;
  theme: Config['theme'];
  language: Config['language'];
  test: boolean;
};
export class BrowserOutput implements BroadcastOutput {
  private server: Server;
  private port = 0;
  private seen = new Map<string, number>();
  constructor(
    private root: string,
    private token: string,
    private projection: () => Projection,
    private webhook: (id: string, body: unknown, token: string) => void,
    private testItem: Item,
  ) {
    this.server = createServer((req, res) => {
      const run = async () => {
        const origin = 'http://127.0.0.1:' + this.port;
        if (
          req.headers.host !== new URL(origin).host ||
          (req.headers.origin && req.headers.origin !== origin)
        ) {
          res.writeHead(403);
          res.end();
          return;
        }
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src https:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        );
        const url = new URL(req.url || '/', origin);
        if (url.pathname.startsWith('/webhook/')) {
          if (req.method !== 'POST' || req.headers.origin) {
            res.writeHead(403);
            res.end();
            return;
          }
          let length = 0;
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            const b = Buffer.from(chunk);
            length += b.length;
            if (length > 65536) {
              res.writeHead(413);
              res.end();
              return;
            }
            chunks.push(b);
          }
          try {
            this.webhook(
              url.pathname.slice(9),
              JSON.parse(Buffer.concat(chunks).toString('utf8')),
              String(req.headers.authorization || '').replace(/^Bearer /, ''),
            );
            res.writeHead(202);
            res.end();
          } catch {
            res.writeHead(400);
            res.end('Invalid request');
          }
          return;
        }
        if (req.method !== 'GET') {
          res.writeHead(405);
          res.end();
          return;
        }
        const supplied =
          url.searchParams.get('token') || req.headers.authorization?.replace(/^Bearer /, '') || '';
        if (url.pathname === '/state') {
          if (!equal(supplied, this.token)) {
            res.writeHead(403);
            res.end();
            return;
          }
          const client = String(req.headers['x-output-client'] || '').slice(0, 80);
          if (client && this.seen.size < 100) this.seen.set(client, Date.now());
          const state = this.projection(),
            test = url.searchParams.get('test') === '1';
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({ ...state, program: test ? this.testItem : state.program, test }),
          );
          return;
        }
        if (url.pathname === '/output.html' && !equal(supplied, this.token)) {
          res.writeHead(403);
          res.end();
          return;
        }
        const asset = /^\/assets\/[a-zA-Z0-9_.-]+\.(js|css)$/.test(url.pathname);
        if (url.pathname !== '/output.html' && !asset) {
          res.writeHead(404);
          res.end();
          return;
        }
        const file = await readFile(join(this.root, url.pathname.slice(1)));
        res.setHeader(
          'Content-Type',
          url.pathname.endsWith('.js')
            ? 'text/javascript'
            : url.pathname.endsWith('.css')
              ? 'text/css'
              : 'text/html',
        );
        res.end(file);
      };
      void run().catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end('Output unavailable');
      });
    });
    this.server.requestTimeout = 15000;
    this.server.headersTimeout = 10000;
    this.server.maxConnections = 32;
  }
  async start(port: number) {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, '127.0.0.1', () => {
        this.server.removeListener('error', reject);
        resolve();
      });
    });
    const a = this.server.address();
    if (!a || typeof a === 'string') throw new Error('Output address unavailable');
    this.port = a.port;
    return this.port;
  }
  url(test = false) {
    return (
      'http://127.0.0.1:' + this.port + '/output.html?token=' + this.token + (test ? '&test=1' : '')
    );
  }
  webhookUrl(id: string) {
    return 'http://127.0.0.1:' + this.port + '/webhook/' + encodeURIComponent(id);
  }
  clients() {
    for (const [id, at] of this.seen) if (Date.now() - at > 5000) this.seen.delete(id);
    return this.seen.size;
  }
  async stop() {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
