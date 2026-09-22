import { useEffect, useState } from 'react';
import { type Snapshot, type Config, brand } from '../core/model';
import { dictionary } from './i18n';
import { Control } from './Control';
import { Sources } from './Sources';
import { Settings, Templates, History, Diagnostics } from './Panels';
import { LicensePanel } from './LicensePanel';
import { licenseDictionary } from './license-i18n';
import { eligible } from '../licensing/model';
export function App() {
  const [s, setS] = useState<Snapshot | null>(null),
    [page, setPage] = useState('control'),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(0);
  const working = pending > 0;
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
    // Source requests must never lock out emergency playout commands.
    setPending((count) => count + 1);
    setMessage('');
    void fn()
      .then(async () => {
        setS(await window.newsrelay.snapshot());
        setMessage(t.saved);
      })
      .catch(() => setMessage(t.failure))
      .finally(() => setPending((count) => count - 1));
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
  const licensed = eligible(s.license);
  const lt = licenseDictionary(s.config.language);
  return (
    <div className="app">
      <header>
        <strong>{brand.name}</strong>
        <span className="edition">{t.control}</span>
        <span className="spacer" />
        <button className={licensed ? '' : 'amber'} onClick={() => setPage('settings')}>
          {lt[s.license.status]}
        </button>
        <span className={s.state.program ? 'onair' : 'muted'}>
          {s.state.program ? t.onAir : t.offAir}
        </span>
        <span className="status-dot" />
        <span>
          {t.output} · {s.output.clients}
        </span>
        <button
          className={s.demo ? 'held' : ''}
          disabled={!licensed || !!s.state.program}
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
          {!licensed && page !== 'settings' && (
            <p className="license-banner amber" role="status">
              {lt.preserved}
            </p>
          )}
          {!licensed && page === 'control' && !s.state.program && <LicensePanel s={s} />}
          {!s.config.setup && (
            <section className="onboarding">
              <div>
                <h2>{t.welcome}</h2>
                <p>{licensed ? t.welcomeText : lt.introduction}</p>
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
                {!licensed && <button onClick={() => setPage('settings')}>{lt.title}</button>}
                {licensed && (
                  <>
                    <button onClick={() => setPage('sources')}>{t.setupSource}</button>
                    <button onClick={() => setPage('settings')}>{t.setupOutput}</button>
                    <button onClick={() => setPage('templates')}>{t.setupTheme}</button>
                    <button onClick={() => run(() => window.newsrelay.copyOutput(true))}>
                      {t.setupTest}
                    </button>
                    <button onClick={() => save({ ...s.config, setup: true })}>{t.finish}</button>
                  </>
                )}
              </div>
            </section>
          )}
          {page === 'control' && (licensed || s.state.program) && (
            <Control
              snapshot={s}
              t={t}
              command={(command) => run(() => window.newsrelay.command(command))}
              run={run}
            />
          )}
          {page === 'sources' && (
            <fieldset disabled={!licensed}>
              <Sources {...props} />
            </fieldset>
          )}{' '}
          {page === 'templates' && (
            <fieldset disabled={!licensed || !!s.state.program}>
              <Templates {...props} />
            </fieldset>
          )}{' '}
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
