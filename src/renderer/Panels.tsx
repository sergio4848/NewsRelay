import { useState } from 'react';
import { type Snapshot, type Config, brand, templateSchema } from '../core/model';
import { Graphic } from '../graphics/Graphic';
import { type Strings, eventLabel } from './i18n';
type Props = {
  s: Snapshot;
  t: Strings;
  save: (c: Config) => void;
  run: (fn: () => Promise<unknown>) => void;
};
export function Settings({ s, t, save, run }: Props) {
  const [config, setConfig] = useState(s.config);
  return (
    <div className="page narrow">
      <h1>{t.settings}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(config);
        }}
      >
        <div className="form-grid">
          <label>
            {t.language}
            <select
              value={config.language}
              onChange={(e) => {
                const value = { ...config, language: e.target.value as 'en' | 'tr' };
                setConfig(value);
                save(value);
              }}
            >
              <option value="en">English</option>
              <option value="tr">Türkçe</option>
            </select>
          </label>
          <label>
            {t.duration}
            <input
              type="number"
              min="5"
              max="120"
              value={config.duration / 1000}
              onChange={(e) => setConfig({ ...config, duration: Number(e.target.value) * 1000 })}
            />
          </label>
          <label>
            {t.blacklist}
            <input
              value={config.blacklist.join(',')}
              onChange={(e) => setConfig({ ...config, blacklist: e.target.value.split(',') })}
            />
          </label>
        </div>
        <button>{t.save}</button>
      </form>
      <section className="settings-section">
        <h2>{t.outputs}</h2>
        <p>{t.obsHelp}</p>
        <div className="actions">
          <button onClick={() => run(() => window.newsrelay.copyOutput(false))}>{t.copyUrl}</button>
          <button onClick={() => run(() => window.newsrelay.copyOutput(true))}>
            {t.testOutput}
          </button>
        </div>
        <p className="muted">{t.testHelp}</p>
      </section>
      <section className="settings-section actions">
        <button onClick={() => run(() => window.newsrelay.transfer('export'))}>
          {t.exportConfig}
        </button>
        <button onClick={() => run(() => window.newsrelay.transfer('import'))}>
          {t.importConfig}
        </button>
        <button disabled={s.demo} onClick={() => run(() => window.newsrelay.transfer('legacy'))}>
          {t.legacy}
        </button>
      </section>
      <section className="settings-section">
        <h2>{t.about}</h2>
        <p>
          {brand.name} {brand.version}
          <br />
          {brand.subtitle}
          <br />
          by {brand.maker}
        </p>
        <p>{t.shortcuts}</p>
      </section>
    </div>
  );
}
export function Templates({ s, t, save }: Props) {
  const [theme, setTheme] = useState(s.config.theme);
  const [template, setTemplate] = useState<(typeof templateSchema.options)[number]>('headline');
  const sample = s.state.preview || s.state.items[0] || null;
  return (
    <div className="page">
      <h1>{t.templates}</h1>
      <div className="template-layout">
        <div>
          <div className="template-tabs">
            {templateSchema.options.map((v) => (
              <button
                className={template === v ? 'active' : ''}
                key={v}
                onClick={() => setTemplate(v)}
              >
                {v === 'headline' ? t.headlineTemplate : t[v]}
              </button>
            ))}
          </div>
          <div className="monitor template-monitor">
            <Graphic
              item={sample ? { ...sample, template } : null}
              theme={theme}
              language={s.config.language}
            />
          </div>
          {!sample && <p className="muted">{t.empty}</p>}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save({ ...s.config, theme });
          }}
        >
          {(['customer', 'logo', 'label'] as const).map((key) => (
            <label key={key}>
              {t[key]}
              <input
                value={theme[key]}
                maxLength={key === 'logo' ? 2048 : 40}
                onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
              />
            </label>
          ))}
          {(['primary', 'accent'] as const).map((key) => (
            <label key={key}>
              {t[key]}
              <input
                type="color"
                value={theme[key]}
                onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            {t.scale}
            <input
              type="range"
              min=".8"
              max="1.2"
              step=".05"
              value={theme.scale}
              onChange={(e) => setTheme({ ...theme, scale: Number(e.target.value) })}
            />
          </label>
          <button>{t.save}</button>
        </form>
      </div>
    </div>
  );
}
export function History({ s, t }: Pick<Props, 's' | 't'>) {
  const [query, setQuery] = useState('');
  return (
    <div className="page">
      <h1>{t.history}</h1>
      <input
        className="history-search"
        aria-label={t.search}
        placeholder={t.search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <table>
        <thead>
          <tr>
            <th>{t.time}</th>
            <th>{t.event}</th>
            <th>{t.headline}</th>
          </tr>
        </thead>
        <tbody>
          {s.history
            .filter((h) =>
              (
                eventLabel(h.event, s.config.language) +
                ' ' +
                (s.state.items.find((i) => i.id === h.itemId)?.headline || '')
              )
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((h, index) => (
              <tr key={index}>
                <td>{new Date(h.at).toLocaleString(s.config.language)}</td>
                <td>{eventLabel(h.event, s.config.language)}</td>
                <td>{s.state.items.find((i) => i.id === h.itemId)?.headline || '—'}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
export function Diagnostics({ s, t, run }: Props) {
  return (
    <div className="page">
      <div className="page-title">
        <h1>{t.diagnostics}</h1>
        <button onClick={() => run(() => window.newsrelay.transfer('diagnostics'))}>
          {t.exportDiagnostics}
        </button>
      </div>
      <dl>
        <dt>{t.version}</dt>
        <dd>{brand.version}</dd>
        <dt>{t.database}</dt>
        <dd>{s.database === 'ok' ? t.connected : t.degraded}</dd>
        <dt>{t.output}</dt>
        <dd>
          {s.output.clients} {t.connected.toLowerCase()}
        </dd>
      </dl>
      <table>
        <thead>
          <tr>
            <th>{t.source}</th>
            <th>{t.status}</th>
            <th>{t.lastSuccess}</th>
            <th>{t.reads}</th>
            <th>{t.remaining}</th>
          </tr>
        </thead>
        <tbody>
          {s.config.sources.map((source) => {
            const h = s.health[source.id];
            return (
              <tr key={source.id}>
                <td>{source.name}</td>
                <td className={h?.status}>
                  {t[h?.status || 'offline']}
                  {h?.error && ' · ' + t.sourceUnavailable}
                </td>
                <td>
                  {h?.lastSuccess ? new Date(h.lastSuccess).toLocaleString(s.config.language) : '—'}
                </td>
                <td>{h?.reads || 0}</td>
                <td>{h?.remaining ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
