import { DatabaseSync } from 'node:sqlite';
import {
  configSchema,
  defaultConfig,
  emptyState,
  stateSchema,
  type Config,
  type State,
  type Audit,
} from '../core/model';
export class Repository {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
    const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
    if (version > 1) {
      this.db.close();
      throw new Error('Database version is newer than this application');
    }
    if (version === 0)
      this.db.exec(
        'BEGIN IMMEDIATE; CREATE TABLE records (key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE history (id INTEGER PRIMARY KEY,at TEXT NOT NULL,event TEXT NOT NULL,itemId TEXT); PRAGMA user_version=1; COMMIT;',
      );
  }
  get<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM records WHERE key=?').get(key);
    return row ? (JSON.parse(String(row.value)) as T) : fallback;
  }
  set(key: string, value: unknown) {
    this.db
      .prepare(
        'INSERT INTO records VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      )
      .run(key, JSON.stringify(value));
  }
  delete(key: string) {
    this.db.prepare('DELETE FROM records WHERE key=?').run(key);
  }
  audit(event: string, itemId?: string) {
    this.db
      .prepare('INSERT INTO history(at,event,itemId) VALUES(?,?,?)')
      .run(new Date().toISOString(), event, itemId ?? null);
  }
  config(): Config {
    return configSchema.parse(this.get('config', defaultConfig()));
  }
  state(): State {
    return stateSchema.parse(this.get('state', emptyState()));
  }
  commit(state: State, event: string, itemId?: string, extra?: () => void) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.set('state', state);
      extra?.();
      this.audit(event, itemId);
      this.db.exec(
        'DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT 2000); COMMIT;',
      );
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  history(): Audit[] {
    return this.db
      .prepare('SELECT at,event,itemId FROM history ORDER BY id DESC LIMIT 300')
      .all()
      .map((r) => ({
        at: String(r.at),
        event: String(r.event),
        ...(r.itemId ? { itemId: String(r.itemId) } : {}),
      }));
  }
  health() {
    return String(this.db.prepare('PRAGMA quick_check').get()?.quick_check);
  }
  close() {
    this.db.close();
  }
}
