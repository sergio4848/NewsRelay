import { type Config, type Item, type State, type Command, type Source } from './model';
export const rules = {
  trust: { official: 40, trusted: 30, standard: 14, unverified: 10 },
  important: 42,
  critical: 75,
  duplicate: 0.84,
} as const;
export function words(text: string) {
  return text
    .toLocaleLowerCase('tr')
    .replace(/https?:\/\/\S+|@\w+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function similarity(a: string, b: string) {
  const x = new Set(words(a).split(' ').filter(Boolean)),
    y = new Set(words(b).split(' ').filter(Boolean));
  if (!x.size || !y.size) return 0;
  const n = [...x].filter((w) => y.has(w)).length;
  return n / (x.size + y.size - n);
}
export function priority(text: string, source: Source) {
  return Math.max(
    0,
    Math.min(
      100,
      rules.trust[source.trust] +
        source.priorityModifier +
        (/breaking|son dakika/i.test(text) ? 36 : 0) +
        (text.length < 110 ? 4 : 0),
    ),
  );
}
export function eligible(item: Item, config: Config) {
  const s = config.sources.find((s) => s.id === item.connectorId);
  return (
    !!s?.enabled &&
    s.autoAir &&
    ['official', 'trusted'].includes(s.trust) &&
    item.priority >= s.minPriority
  );
}
export function ingest(state: State, item: Item, config: Config): { state: State; event: string } {
  const next = structuredClone(state),
    source = config.sources.find((s) => s.id === item.connectorId);
  if (!source?.enabled) return { state: next, event: 'disabled' };
  if (
    [...config.blacklist, ...source.blacklist].some(
      (w) => w.trim() && words(item.body + ' ' + item.headline).includes(words(w)),
    )
  )
    return { state: next, event: 'filtered' };
  const exact = next.items.find(
    (i) => i.connectorId === item.connectorId && i.externalId === item.externalId,
  );
  if (exact) return { state: next, event: 'repeated' };
  const duplicate = next.items
    .slice(0, 50)
    .find(
      (i) =>
        i.group === item.group &&
        similarity(i.body || i.headline, item.body || item.headline) >= rules.duplicate,
    );
  if (duplicate) {
    for (const ref of item.references)
      if (
        duplicate.references.length < 30 &&
        !duplicate.references.some(
          (r) => r.connectorId === ref.connectorId && r.externalId === ref.externalId,
        )
      )
        duplicate.references.push(ref);
    duplicate.priority = Math.min(100, duplicate.priority + 4);
    return { state: next, event: 'merged' };
  }
  const protectedIds = new Set([...next.rundown, next.program?.id, next.preview?.id]);
  next.items = [item, ...next.items];
  if (next.items.length > 500) {
    const index = next.items.findLastIndex((i) => !protectedIds.has(i.id));
    next.items.splice(index, 1);
  }
  if (
    next.mode !== 'manual' &&
    ['official', 'trusted'].includes(source.trust) &&
    next.rundown.length < 200
  ) {
    next.rundown.push(item.id);
    item.editorial = 'queued';
  }
  if (next.mode === 'auto' && !next.program && !next.hold)
    return { state: advance(next, config, true), event: 'ingested' };
  return { state: next, event: 'ingested' };
}
function publish(state: State, item: Item) {
  if (state.program) {
    const prior = state.items.find((i) => i.id === state.program?.id);
    if (prior) prior.broadcast = 'off';
  }
  state.program = structuredClone(item);
  state.program.broadcast = 'program';
  state.program.editorial = 'aired';
  const stored = state.items.find((i) => i.id === item.id);
  if (stored) {
    stored.editorial = 'aired';
    stored.broadcast = 'program';
  }
  state.rundown = state.rundown.filter((id) => id !== item.id);
  state.takenAt = Date.now();
  return state;
}
export function advance(state: State, config: Config, automatic = false): State {
  if (state.hold) return state;
  const id = state.rundown.find((id) => {
    const i = state.items.find((i) => i.id === id);
    return i && (!automatic || eligible(i, config));
  });
  const item = state.items.find((i) => i.id === id);
  if (item) return publish(state, item);
  if (automatic) {
    state.program = null;
    state.takenAt = null;
    for (const i of state.items) i.broadcast = 'off';
  }
  return state;
}
export function reduce(state: State, command: Command, config: Config): State {
  const s = structuredClone(state);
  switch (command.type) {
    case 'preview': {
      const item = s.items.find((i) => i.id === command.id);
      if (item) {
        s.preview = structuredClone(item);
        s.preview.editorial = 'previewed';
      }
      break;
    }
    case 'edit':
      if (s.preview) {
        s.preview = {
          ...s.preview,
          headline: command.headline,
          body: command.body,
          template: command.template,
        };
        s.items = s.items.map((i) =>
          i.id === s.preview?.id ? { ...s.preview, broadcast: i.broadcast } : i,
        );
      }
      break;
    case 'queue':
      if (
        s.items.some((i) => i.id === command.id) &&
        !s.rundown.includes(command.id) &&
        s.rundown.length < 200
      ) {
        s.rundown.push(command.id);
        const i = s.items.find((i) => i.id === command.id);
        if (i) i.editorial = 'queued';
      }
      break;
    case 'take':
      if (!s.hold && s.preview) publish(s, s.preview);
      break;
    case 'next':
      return advance(s, config);
    case 'hold':
      if (s.program) {
        s.hold = !s.hold;
        if (!s.hold) s.takenAt = Date.now();
      }
      break;
    case 'clear':
      s.program = null;
      s.hold = false;
      s.mode = 'manual';
      s.takenAt = null;
      for (const i of s.items) i.broadcast = 'off';
      break;
    case 'remove':
      s.rundown = s.rundown.filter((id) => id !== command.id);
      break;
    case 'move': {
      const from = s.rundown.indexOf(command.id),
        to = from + command.direction;
      if (from >= 0 && to >= 0 && to < s.rundown.length) {
        s.rundown.splice(from, 1);
        s.rundown.splice(to, 0, command.id);
      }
      break;
    }
    case 'mode':
      s.mode = command.mode;
      break;
  }
  return s;
}
