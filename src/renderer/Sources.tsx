import { useState } from 'react';
import { sourceSchema, type Snapshot, type Source, type Config } from '../core/model';
import { type Strings } from './i18n';
export function Sources({
  s,
  t,
  save,
  run,
}: {
  s: Snapshot;
  t: Strings;
  save: (c: Config) => void;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const [editing, setEditing] = useState<Source | null>(null),
    [secret, setSecret] = useState('');
  const patch = (change: Partial<Source>) => setEditing((e) => (e ? { ...e, ...change } : e));
  return (
    <div className="page">
      <div className="page-title">
        <h1>{t.sources}</h1>
        <button
          disabled={s.demo}
          onClick={() =>
            setEditing({
              ...sourceSchema.parse({
                id: crypto.randomUUID(),
                name: 'RSS',
                kind: 'webhook',
              }),
              kind: 'rss',
            })
          }
        >
          {t.add}
        </button>
        <button onClick={() => run(() => window.newsrelay.poll())}>{t.poll}</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>{t.name}</th>
            <th>{t.kind}</th>
            <th>{t.trust}</th>
            <th>{t.group}</th>
            <th>{t.status}</th>
            <th>{t.autoAir}</th>
          </tr>
        </thead>
        <tbody>
          {s.config.sources.map((source) => (
            <tr key={source.id}>
              <td>
                <button
                  onClick={() => {
                    setEditing(source);
                    setSecret('');
                  }}
                >
                  {source.name}
                </button>
              </td>
              <td>{source.kind.toUpperCase()}</td>
              <td>{t[source.trust]}</td>
              <td>{source.group}</td>
              <td className={s.health[source.id]?.status}>
                {t[s.health[source.id]?.status || 'offline']}
              </td>
              <td>{source.autoAir ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            const checked = sourceSchema.safeParse(editing);
            if (!checked.success) {
              alert(t.failure);
              return;
            }
            save({
              ...s.config,
              sources: [...s.config.sources.filter((x) => x.id !== editing.id), checked.data],
            });
            setEditing(null);
          }}
        >
          <h2>{editing.name}</h2>
          <div className="form-grid">
            <label>
              {t.name}
              <input
                required
                maxLength={80}
                value={editing.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <label>
              {t.kind}
              <select
                disabled={editing.kind === 'demo'}
                value={editing.kind}
                onChange={(e) =>
                  patch({ kind: e.target.value as Source['kind'], endpoint: '', handle: '' })
                }
              >
                {['rss', 'rest', 'x', 'webhook', ...(s.demo ? ['demo'] : [])].map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>
            {['rss', 'rest'].includes(editing.kind) && (
              <label>
                {t.endpoint}
                <input
                  type="url"
                  required
                  value={editing.endpoint}
                  onChange={(e) => patch({ endpoint: e.target.value })}
                />
              </label>
            )}
            {editing.kind === 'x' && (
              <label>
                {t.handle}
                <input
                  required
                  pattern="[A-Za-z0-9_]{1,15}"
                  value={editing.handle}
                  onChange={(e) => patch({ handle: e.target.value })}
                />
              </label>
            )}
            <label>
              {t.group}
              <input
                value={editing.group}
                maxLength={60}
                onChange={(e) => patch({ group: e.target.value })}
              />
            </label>
            <label>
              {t.trust}
              <select
                value={editing.trust}
                onChange={(e) => patch({ trust: e.target.value as Source['trust'] })}
              >
                {['official', 'trusted', 'standard', 'unverified'].map((v) => (
                  <option key={v} value={v}>
                    {t[v as Source['trust']]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.modifier}
              <input
                type="number"
                min="-30"
                max="30"
                value={editing.priorityModifier}
                onChange={(e) => patch({ priorityModifier: Number(e.target.value) })}
              />
            </label>
            <label>
              {t.minPriority}
              <input
                type="number"
                min="0"
                max="100"
                value={editing.minPriority}
                onChange={(e) => patch({ minPriority: Number(e.target.value) })}
              />
            </label>
            <label>
              {t.interval}
              <input
                type="number"
                min="15"
                max="3600"
                value={editing.interval / 1000}
                onChange={(e) => patch({ interval: Number(e.target.value) * 1000 })}
              />
            </label>
            <label>
              {t.blacklist}
              <input
                value={editing.blacklist.join(',')}
                onChange={(e) => patch({ blacklist: e.target.value.split(',') })}
              />
            </label>
          </div>
          <div className="checks">
            {(['enabled', 'autoAir', 'media', 'includeReplies', 'includeReposts'] as const).map(
              (key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={editing[key]}
                    onChange={(e) => patch({ [key]: e.target.checked })}
                  />
                  {key === 'media'
                    ? t.allowMedia
                    : key === 'includeReplies'
                      ? t.replies
                      : key === 'includeReposts'
                        ? t.reposts
                        : t[key]}
                </label>
              ),
            )}
          </div>
          <p className="muted">{t.autoHelp}</p>
          <button type="submit">{t.save}</button>{' '}
          <button type="button" onClick={() => setEditing(null)}>
            {t.cancel}
          </button>
          {!s.demo && s.config.sources.some((x) => x.id === editing.id) && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (confirm(t.removeConfirm)) {
                  save({
                    ...s.config,
                    sources: s.config.sources.filter((x) => x.id !== editing.id),
                  });
                  setEditing(null);
                }
              }}
            >
              {t.removeSource}
            </button>
          )}
          {s.config.sources.some((x) => x.id === editing.id) && (
            <div className="credential-row">
              <label>
                {t.credential}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={!secret}
                onClick={() => {
                  const value = secret;
                  setSecret('');
                  run(() => window.newsrelay.credential(editing.id, value));
                }}
              >
                {t.saveCredential}
              </button>
              {editing.kind === 'webhook' && (
                <button
                  type="button"
                  onClick={() => run(() => window.newsrelay.copyWebhook(editing.id))}
                >
                  {t.copyWebhook}
                </button>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
