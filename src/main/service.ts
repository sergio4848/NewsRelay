import { type Repository } from '../persistence/database';
import { type Vault } from './vault';
import { LicenseService } from '../licensing/service';
import type { Contacts, Feature } from '../licensing/model';
import {
  connector,
  DemoConnector,
  demoSource,
  XConnector,
  type SourceConnector,
  normalize,
} from '../connectors/connectors';
import { advance, ingest, reduce } from '../core/editorial';
import {
  configSchema,
  defaultConfig,
  emptyState,
  sourceSchema,
  type Config,
  type State,
  type Snapshot,
  type Command,
  type Health,
} from '../core/model';
export class Newsroom {
  state: State;
  config: Config;
  health: Record<string, Health> = {};
  private connectors = new Map<string, SourceConnector>();
  private due = new Map<string, number>();
  private failures = new Map<string, number>();
  private busy = false;
  private generation = 0;
  output = { port: 0, clients: 0 };
  changed: () => void = () => {};
  constructor(
    readonly repo: Repository,
    readonly vault: Pick<Vault, 'get' | 'put' | 'token'>,
    readonly demo: boolean,
    readonly license: LicenseService,
    readonly contacts: Contacts,
  ) {
    this.config = repo.config();
    if (demo && !this.config.sources.length) this.config.sources = [demoSource()];
    this.state = { ...repo.state(), program: null, hold: false, mode: 'manual', takenAt: null };
    for (const item of this.state.items) item.broadcast = 'off';
    repo.commit(this.state, 'recovered', undefined, () => repo.set('config', this.config));
    this.configure();
  }
  configure() {
    this.generation++;
    for (const c of this.connectors.values()) c.stop();
    this.connectors.clear();
    this.health = {};
    for (const source of this.config.sources) {
      if ((source.kind === 'demo') !== this.demo) continue;
      const c = connector(source);
      this.connectors.set(source.id, c);
      if (source.enabled) c.start();
      this.health[source.id] = c.health();
    }
  }
  snapshot(): Snapshot {
    return {
      license: this.license.snapshot(),
      contacts: this.contacts,
      state: this.state,
      config: this.config,
      demo: this.demo,
      health: this.health,
      history: this.repo.history(),
      output: this.output,
      database: this.repo.health(),
    };
  }
  command(c: Command) {
    if (c.type !== 'clear' && c.type !== 'hold' && !(c.type === 'mode' && c.mode === 'manual'))
      this.license.require('output.obs');
    if (c.type === 'mode' && c.mode === 'auto') this.license.require('workflow.auto_air');
    if (
      (c.type === 'take' || c.type === 'next' || (c.type === 'mode' && c.mode === 'auto')) &&
      this.customTheme()
    )
      this.license.require('branding.custom');
    if (c.type === 'compose') {
      const source = sourceSchema.parse({
        id: 'manual-' + crypto.randomUUID(),
        name: c.publisher,
        kind: 'webhook',
        enabled: true,
        trust: 'standard',
        group: this.config.language === 'tr' ? 'Editoryal' : 'Editorial',
      });
      const item = normalize(
        { id: crypto.randomUUID(), headline: c.headline, body: c.body },
        source,
      );
      item.provider = 'manual';
      const result = ingest({ ...this.state, mode: 'manual' }, item, {
        ...this.config,
        sources: [...this.config.sources.filter((s) => s.id !== source.id), source],
      });
      const next = {
        ...result.state,
        mode: this.state.mode,
        preview: result.event === 'ingested' ? item : this.state.preview,
      };
      this.repo.commit(next, result.event, item.id);
      this.state = next;
      this.changed();
      return this.snapshot();
    }
    const next = reduce(this.state, c, this.config);
    this.repo.commit(next, c.type, 'id' in c ? c.id : (next.program?.id ?? next.preview?.id));
    this.state = next;
    this.changed();
    return this.snapshot();
  }
  validateConfig(config: Config, replacingProgram = false) {
    const validated = configSchema.parse(config);
    if (JSON.stringify(validated.theme) !== JSON.stringify(this.config.theme)) {
      this.license.require('output.obs');
      if (JSON.stringify(validated.theme) !== JSON.stringify(defaultConfig().theme))
        this.license.require('branding.custom');
      // Theme is part of Program's visual projection. Do not mutate an on-air graphic.
      if (this.state.program && !replacingProgram)
        throw new Error('Clear Program before changing branding');
    }
    if (JSON.stringify(validated.sources) !== JSON.stringify(this.config.sources)) {
      this.license.require('output.obs');
      for (const source of validated.sources) {
        if (source.enabled) this.license.require(this.sourceFeature(source.kind));
        if (source.autoAir) this.license.require('workflow.auto_air');
      }
    }
    if (validated.sources.some((s) => (s.kind === 'demo') !== this.demo))
      throw new Error('Source belongs to another operating mode');
    return validated;
  }
  save(config: Config) {
    const validated = this.validateConfig(config);
    this.repo.commit(this.state, 'configuration', undefined, () => {
      this.repo.set('config', validated);
      for (const old of this.config.sources) {
        const updated = validated.sources.find((s) => s.id === old.id);
        if (
          !updated ||
          old.endpoint !== updated.endpoint ||
          old.handle !== updated.handle ||
          old.kind !== updated.kind ||
          old.includeReplies !== updated.includeReplies ||
          old.includeReposts !== updated.includeReposts
        )
          this.repo.delete('cursor:' + old.id);
        if (!updated || old.kind !== updated.kind) this.repo.delete('credential:source:' + old.id);
      }
    });
    this.config = validated;
    this.configure();
    this.changed();
    return this.snapshot();
  }
  accept(id: string, raw: unknown) {
    this.license.require('connector.webhook');
    this.license.require('output.obs');
    this.disarmUnlicensedAuto();
    const c = this.connectors.get(id),
      source = this.config.sources.find((s) => s.id === id);
    if (!c || !source?.enabled || source.kind !== 'webhook') throw new Error('Webhook unavailable');
    const item = c.normalize(raw),
      result = ingest(this.state, item, this.config);
    this.repo.commit(result.state, result.event, item.id);
    this.state = result.state;
    this.health[id] = {
      status: 'connected',
      reads: (this.health[id]?.reads || 0) + 1,
      lastSuccess: new Date().toISOString(),
    };
    this.changed();
  }
  async poll(force = false) {
    if (!this.license.allows('output.obs')) {
      if (force) this.license.require('output.obs');
      return;
    }
    if (this.busy) return;
    this.busy = true;
    const generation = this.generation;
    try {
      for (const source of this.config.sources) {
        if (
          !source.enabled ||
          !this.license.allows(this.sourceFeature(source.kind)) ||
          source.kind === 'webhook' ||
          (!force && (this.due.get(source.id) || 0) > Date.now())
        )
          continue;
        const c = this.connectors.get(source.id);
        if (!c) continue;
        try {
          const batch = await c.poll(
            this.repo.get<string | undefined>('cursor:' + source.id, undefined),
            this.vault.get('source:' + source.id),
          );
          if (generation !== this.generation) return;
          if (
            !this.license.allows('output.obs') ||
            !this.license.allows(this.sourceFeature(source.kind))
          )
            return;
          this.disarmUnlicensedAuto();
          let state = this.state;
          const events: { event: string; itemId: string }[] = [];
          for (const item of batch.items) {
            const result = ingest(state, item, this.config);
            state = result.state;
            if (result.event !== 'repeated') events.push({ event: result.event, itemId: item.id });
          }
          this.repo.commit(state, 'ingestion', undefined, () => {
            if (batch.cursor) this.repo.set('cursor:' + source.id, batch.cursor);
            for (const event of events) this.repo.audit(event.event, event.itemId);
            if (this.state.program?.id !== state.program?.id && state.program)
              this.repo.audit('take', state.program.id);
            if (this.failures.get(source.id)) this.repo.audit('connector-recovered');
          });
          this.state = state;
          this.health[source.id] = c.health();
          this.failures.set(source.id, 0);
        } catch {
          if (generation !== this.generation) return;
          const count = (this.failures.get(source.id) || 0) + 1;
          this.failures.set(source.id, count);
          this.health[source.id] = {
            ...c.health(),
            status: 'degraded',
            error: 'sourceUnavailable',
          };
          this.repo.commit(this.state, 'connector-failed');
        }
        this.due.set(
          source.id,
          Date.now() +
            Math.min(900000, source.interval * 2 ** Math.min(5, this.failures.get(source.id) || 0)),
        );
        this.changed();
      }
    } finally {
      this.busy = false;
    }
  }
  tick() {
    this.disarmUnlicensedAuto();
    if (!this.license.allows('output.obs') || !this.license.allows('workflow.auto_air')) {
      return;
    }
    if (
      this.state.mode === 'auto' &&
      !this.state.hold &&
      (!this.state.program || Date.now() - (this.state.takenAt || 0) >= this.config.duration)
    ) {
      const next = advance(structuredClone(this.state), this.config, true);
      if (JSON.stringify(next) !== JSON.stringify(this.state)) {
        this.repo.commit(next, 'automatic-next', next.program?.id);
        this.state = next;
        this.changed();
      }
    }
  }
  async media(id: string) {
    this.license.require('connector.x');
    this.license.require('output.obs');
    const item = this.state.items.find((i) => i.id === id),
      source = this.config.sources.find((s) => s.id === item?.connectorId);
    if (!item || !source?.media) throw new Error('Media disabled');
    const c = this.connectors.get(item.connectorId);
    if (!(c instanceof XConnector)) return this.snapshot();
    const generation = this.generation;
    const loaded = await c.loadMedia(item, this.vault.get('source:' + item.connectorId));
    this.license.require('connector.x');
    this.license.require('output.obs');
    if (generation !== this.generation) throw new Error('Source configuration changed');
    const next = structuredClone(this.state);
    next.items = next.items.map((i) => (i.id === id ? loaded : i));
    if (next.preview?.id === id)
      next.preview = { ...next.preview, media: loaded.media, metadata: loaded.metadata };
    this.repo.commit(next, 'media-loaded', id);
    this.state = next;
    this.changed();
    return this.snapshot();
  }
  async seed() {
    if (!this.demo) return;
    this.license.require('output.obs');
    const c = new DemoConnector(demoSource());
    let state = emptyState();
    for (const item of (await c.poll()).items) state = ingest(state, item, this.config).state;
    this.repo.commit(state, 'demo-loaded');
    this.state = state;
    this.changed();
  }
  stop() {
    this.generation++;
    for (const c of this.connectors.values()) c.stop();
  }
  private sourceFeature(kind: Config['sources'][number]['kind']): Feature {
    return kind === 'demo' ? 'output.obs' : `connector.${kind}`;
  }
  licenseChanged() {
    this.disarmUnlicensedAuto();
    this.changed();
  }
  private disarmUnlicensedAuto() {
    if (
      this.state.mode === 'auto' &&
      (!this.license.allows('output.obs') ||
        !this.license.allows('workflow.auto_air') ||
        (this.customTheme() && !this.license.allows('branding.custom')))
    ) {
      this.state = { ...this.state, mode: 'manual' };
      this.repo.commit(this.state, 'license-disarmed');
      this.changed();
    }
  }
  private customTheme() {
    return JSON.stringify(this.config.theme) !== JSON.stringify(defaultConfig().theme);
  }
  outputTheme() {
    return this.state.program || this.license.allows('branding.custom')
      ? this.config.theme
      : defaultConfig().theme;
  }
}
