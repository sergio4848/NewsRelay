import { useEffect, useState } from 'react';
import { type Snapshot, type Command, type Item, templateSchema } from '../core/model';
import { Graphic } from '../graphics/Graphic';
import { type Strings } from './i18n';
import { Compose } from './Compose';
import { eligible } from '../licensing/model';
type Props = {
  snapshot: Snapshot;
  t: Strings;
  command: (c: Command) => void;
  run: (fn: () => Promise<unknown>) => void;
};
export function Control({ snapshot: s, t, command, run }: Props) {
  const [search, setSearch] = useState(''),
    [headline, setHeadline] = useState(''),
    [body, setBody] = useState(''),
    [template, setTemplate] = useState<Item['template']>('headline');
  const p = s.state.preview;
  const licensed = eligible(s.license) && s.license.features.includes('output.obs');
  useEffect(() => {
    setHeadline(p?.headline || '');
    setBody(p?.body || '');
    setTemplate(p?.template || 'headline');
  }, [p?.id, p?.headline, p?.body, p?.template]);
  const edited = p ? { ...p, headline, body, template } : null;
  const take = () =>
    run(async () => {
      if (!p || !licensed) return;
      await window.newsrelay.command({ type: 'edit', headline, body, template });
      await window.newsrelay.command({ type: 'take' });
    });
  const clear = () => {
    if (confirm(t.clearConfirm)) command({ type: 'clear' });
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!event.ctrlKey || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement).tagName))
        return;
      if (event.key === 'Enter') {
        event.preventDefault();
        take();
      } else if (event.key.toLowerCase() === 'h') {
        event.preventDefault();
        command({ type: 'hold' });
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        if (licensed) command({ type: 'next' });
      } else if (event.shiftKey && event.key === 'Backspace') {
        event.preventDefault();
        clear();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const items = s.state.items.filter((i) =>
    (i.headline + ' ' + i.publisher.name + ' ' + i.group)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="control-layout">
      <section className="incoming">
        <div className="section-head">
          <h2>{t.incoming}</h2>
          <span>{items.length}</span>
        </div>
        <fieldset disabled={!licensed}>
          <Compose t={t} command={command} />
        </fieldset>
        <div className="search">
          <input
            aria-label={t.search}
            placeholder={t.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="incoming-list">
          {items.map((i) => (
            <article className={p?.id === i.id ? 'story selected' : 'story'} key={i.id}>
              <button
                className="story-select"
                disabled={!licensed}
                onClick={() => command({ type: 'preview', id: i.id })}
              >
                <div className="story-meta">
                  <span>{i.publisher.name}</span>
                  <span>{i.priority}</span>
                </div>
                <h3>{i.headline}</h3>
                <div className="story-meta">
                  <span>
                    {i.group} · {new Date(i.publishedAt).toLocaleTimeString(s.config.language)}
                  </span>
                  <span>{i.references.length > 1 ? '+' + (i.references.length - 1) : ''}</span>
                </div>
              </button>
              <button
                disabled={!licensed}
                className="quiet"
                onClick={() => command({ type: 'queue', id: i.id })}
              >
                {t.queue}
              </button>
            </article>
          ))}
          {!items.length && <p className="empty">{t.empty}</p>}
        </div>
      </section>
      <div className="playout">
        <div className="monitors">
          <section>
            <div className="section-head">
              <h2>{t.preview}</h2>
            </div>
            <div className="monitor">
              <Graphic item={edited} theme={s.config.theme} language={s.config.language} />
            </div>
          </section>
          <section>
            <div className={'section-head ' + (s.state.program ? 'onair' : '')}>
              <h2>{t.program}</h2>
              <span>{s.state.hold ? t.hold : s.state.program ? t.onAir : t.offAir}</span>
            </div>
            <div className="monitor program">
              <Graphic item={s.state.program} theme={s.config.theme} language={s.config.language} />
            </div>
          </section>
        </div>
        <div className="transport">
          <button
            className="take"
            disabled={!licensed || !p || s.state.hold || !headline.trim()}
            onClick={take}
          >
            {t.take}
          </button>
          <button
            className={s.state.hold ? 'held' : ''}
            disabled={!s.state.program}
            onClick={() => command({ type: 'hold' })}
          >
            {s.state.hold ? t.release : t.hold}
          </button>
          <button
            disabled={!licensed || s.state.hold || !s.state.rundown.length}
            onClick={() => command({ type: 'next' })}
          >
            {t.next}
          </button>
          <button className="danger" onClick={clear}>
            {t.clear}
          </button>
          <span className="spacer" />
          <select
            aria-label={t.status}
            disabled={!licensed}
            value={s.state.mode}
            onChange={(e) => {
              const mode = e.target.value as 'manual' | 'assisted' | 'auto';
              if (mode !== 'auto' || confirm(t.autoConfirm)) command({ type: 'mode', mode });
            }}
          >
            <option value="manual">{t.manual}</option>
            <option value="assisted">{t.assisted}</option>
            <option disabled={!s.license.features.includes('workflow.auto_air')} value="auto">
              {t.auto}
            </option>
          </select>
        </div>
        <div className="preview-editor">
          <label>
            {t.headline}
            <textarea
              disabled={!p}
              maxLength={280}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </label>
          <label>
            {t.body}
            <textarea
              disabled={!p}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div>
            <label>
              {t.template}
              <select
                disabled={!p}
                value={template}
                onChange={(e) => setTemplate(templateSchema.parse(e.target.value))}
              >
                {templateSchema.options.map((v) => (
                  <option key={v} value={v}>
                    {v === 'headline' ? t.headlineTemplate : t[v]}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!p}
              onClick={() => command({ type: 'edit', headline, body, template })}
            >
              {t.save}
            </button>
            {p?.metadata.mediaPending === 'true' && (
              <button onClick={() => run(() => window.newsrelay.media(p.id))}>{t.loadMedia}</button>
            )}
          </div>
        </div>
        <section className="rundown">
          <div className="section-head">
            <h2>{t.rundown}</h2>
            <span>{s.state.rundown.length}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.status}</th>
                  <th>{t.priority}</th>
                  <th>{t.source}</th>
                  <th>{t.headline}</th>
                  <th>{t.template}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {s.state.rundown.map((id, index) => {
                  const i = s.state.items.find((i) => i.id === id);
                  return i ? (
                    <tr key={id}>
                      <td>{String(index + 1).padStart(2, '0')}</td>
                      <td>{t.queue}</td>
                      <td>{i.priority}</td>
                      <td>{i.publisher.name}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => command({ type: 'preview', id })}
                        >
                          {i.headline}
                        </button>
                      </td>
                      <td>{i.template === 'headline' ? t.headlineTemplate : t[i.template]}</td>
                      <td className="row-actions">
                        <button
                          aria-label={t.up}
                          disabled={!index}
                          onClick={() => command({ type: 'move', id, direction: -1 })}
                        >
                          ↑
                        </button>
                        <button
                          aria-label={t.down}
                          disabled={index === s.state.rundown.length - 1}
                          onClick={() => command({ type: 'move', id, direction: 1 })}
                        >
                          ↓
                        </button>
                        <button
                          aria-label={t.remove}
                          onClick={() => command({ type: 'remove', id })}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ) : null;
                })}
              </tbody>
            </table>
            {!s.state.rundown.length && <p className="empty">{t.empty}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
