import { useEffect, useState } from 'react';
import { type Snapshot, type Config, brand } from '../core/model';
import { dictionary } from './i18n';
import { Control } from './Control';
import { Sources } from './Sources';
import { Settings, Templates, History, Diagnostics } from './Panels';
export function App() {
  const [s, setS] = useState<Snapshot | null>(null),
    [page, setPage] = useState('control'),
    [message, setMessage] = useState(''),
    [working, setWorking] = useState(false);
  const t = dictionary(s?.config.language || 'en');
  useEffect(() => {
    void window.newsrelay
      .snapshot()
      .then(setS)
      .catch(() => setMessage('NewsRelay unavailable'));
    return window.newsrelay.subscribe(setS);
  }, []);
  useEffect(() => {
    document.documentElement.lang = s?.config.language || 'en';
  }, [s?.config.language]);
  const run = (fn: () => Promise<unknown>) => {
    if (working) return;
    setWorking(true);
    setMessage('');
    void fn()
      .then(async () => {
        setS(await window.newsrelay.snapshot());
        setMessage(t.saved);
      })
      .catch(() => setMessage(t.failure))
      .finally(() => setWorking(false));
  };
  const save = (config: Config) => run(() => window.newsrelay.saveConfig(config));
  if (!s) return <main className="loading">{message || 'NewsRelay'}</main>;
  const sections = [
    'control',
    'sources',
    'templates',
    'history',
    'settings',
    'diagnostics',
  ] as const;
  const props = { s, t, save, run };
  return (
    <div className="app">
      <header>
        <strong>{brand.name}</strong>
        <span className="edition">{t.control}</span>
        <span className="spacer" />
        <span className={s.state.program ? 'onair' : 'muted'}>
          {s.state.program ? t.onAir : t.offAir}
        </span>
        <span className="status-dot" />
        <span>
          {t.output} · {s.output.clients}
        </span>
        <button
          className={s.demo ? 'held' : ''}
          onClick={() => {
            if (confirm(t.modeConfirm)) run(() => window.newsrelay.demo(!s.demo));
          }}
        >
          {s.demo ? t.demo : t.live}
        </button>
      </header>
      <div className="workspace">
        <aside>
          <nav>
            {sections.map((section) => (
              <button
                className={page === section ? 'active' : ''}
                key={section}
                onClick={() => setPage(section)}
              >
                {t[section]}
              </button>
            ))}
          </nav>
          <div className="source-health">
            <h2>{t.sources}</h2>
            {s.config.sources.map((source) => (
              <div key={source.id}>
                <i className={s.health[source.id]?.status || 'offline'} />
                <span>{source.name}</span>
              </div>
            ))}
          </div>
          <div className="sidebar-bottom">
            {s.demo && <p className="amber">{t.demoOnly}</p>}
            <span>v{brand.version}</span>
          </div>
        </aside>
        <main>
          {!s.config.setup && (
            <section className="onboarding">
              <div>
                <h2>{t.welcome}</h2>
                <p>{t.welcomeText}</p>
              </div>
              <div className="actions">
                <select
                  aria-label={t.language}
                  value={s.config.language}
                  onChange={(e) => save({ ...s.config, language: e.target.value as 'en' | 'tr' })}
                >
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                </select>
                <button onClick={() => setPage('sources')}>{t.setupSource}</button>
                <button onClick={() => setPage('settings')}>{t.setupOutput}</button>
                <button onClick={() => setPage('templates')}>{t.setupTheme}</button>
                <button onClick={() => run(() => window.newsrelay.copyOutput(true))}>
                  {t.setupTest}
                </button>
                <button onClick={() => save({ ...s.config, setup: true })}>{t.finish}</button>
              </div>
            </section>
          )}
          {page === 'control' && (
            <Control
              snapshot={s}
              t={t}
              command={(command) => run(() => window.newsrelay.command(command))}
              run={run}
            />
          )}
          {page === 'sources' && <Sources {...props} />}{' '}
          {page === 'templates' && <Templates {...props} />}{' '}
          {page === 'history' && <History {...props} />}{' '}
          {page === 'settings' && <Settings {...props} />}{' '}
          {page === 'diagnostics' && <Diagnostics {...props} />}
        </main>
      </div>
      <footer>
        <span>
          {t[s.state.mode]} · {s.state.hold ? t.hold : t.safeStart}
        </span>
        <span role="status">{working ? t.working : message}</span>
        <span className="spacer" />
        <span>{t.shortcuts}</span>
      </footer>
    </div>
  );
}
