import { useState } from 'react';
import { type Snapshot } from '../core/model';
import {
  contactIds,
  eligible,
  featureIds,
  type LicenseRequest,
  type LicenseState,
} from '../licensing/model';
import { licenseDictionary } from './license-i18n';
export function LicensePanel({ s }: { s: Snapshot }) {
  const t = licenseDictionary(s.config.language);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<LicenseState['issue']>();
  const l = s.license,
    valid = eligible(l),
    expiry = l.trialExpiresAt || l.expiresAt;
  const date = (value?: number) =>
    value ? new Date(value).toLocaleString(s.config.language) : t.unknown;
  const run = async (request: LicenseRequest) => {
    setBusy(true);
    setIssue(undefined);
    try {
      setIssue((await window.newsrelay.license(request)).issue);
    } catch {
      setIssue('unavailable');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="settings-section license-panel" aria-label={t.title}>
      <h2>
        {t.title} · {t[l.status]}
      </h2>
      {l.provider === 'test' && <p className="amber">{t.test}</p>}
      <p>{t.introduction}</p>
      {!valid && <p className="amber">{t.preserved}</p>}
      {(issue || l.issue) && <p role="alert">{t[(issue || l.issue)!]}</p>}
      {(l.edition || l.activationId) && (
        <dl className="license-details">
          <dt>{t.edition}</dt>
          <dd>{l.edition ? t[l.edition] : t.unknown}</dd>
          <dt>{t.expiration}</dt>
          <dd>{date(expiry)}</dd>
          <dt>{t.days}</dt>
          <dd>{expiry ? Math.max(0, Math.ceil((expiry - Date.now()) / 86400000)) : t.unknown}</dd>
          <dt>{t.device}</dt>
          <dd>{l.activationId || t.unknown}</dd>
          <dt>{t.slots}</dt>
          <dd>
            {l.activationCount ?? '—'} /{' '}
            {l.activationLimit === -1 ? '∞' : (l.activationLimit ?? '—')}
          </dd>
          <dt>{t.grace}</dt>
          <dd>{date(l.offlineGraceUntil)}</dd>
          <dt>{t.validated}</dt>
          <dd>{date(l.lastValidatedAt)}</dd>
        </dl>
      )}
      <p className="muted">{t.privacy}</p>
      <div className="actions">
        <button
          disabled={busy || l.status !== 'TRIAL_AVAILABLE'}
          onClick={() => void run({ action: 'trial' })}
        >
          {t.start}
        </button>
        <button disabled={busy} onClick={() => void run({ action: 'refresh' })}>
          {t.refresh}
        </button>
        <button
          disabled={busy || !l.activationId || l.edition === 'Evaluation'}
          onClick={() => {
            if (confirm(t.confirm)) void run({ action: 'deactivate' });
          }}
        >
          {t.deactivate}
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = key;
          setKey('');
          void run({ action: 'activate', key: value });
        }}
      >
        <label>
          {t.key}
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={256}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <button
          disabled={busy || !key.trim() || !l.configured || (valid && l.edition !== 'Evaluation')}
        >
          {busy ? t.pending : t.activate}
        </button>
      </form>
      <p className="muted">{t.pilot}</p>
      <h3>{t.features}</h3>
      <ul>
        {featureIds.map((id) => (
          <li key={id}>
            {l.features.includes(id) && valid ? '✓' : '—'} {t[id]}
          </li>
        ))}
      </ul>
      <h3>{t.contact}</h3>
      <div className="actions">
        {contactIds.map((id) => (
          <button
            key={id}
            disabled={!s.contacts[id]}
            title={s.contacts[id] || t.unconfigured}
            onClick={() => void window.newsrelay.contact(id).catch(() => setIssue('unavailable'))}
          >
            {t[id]}
          </button>
        ))}
      </div>
      {!Object.values(s.contacts).some(Boolean) && <p className="muted">{t.unconfigured}</p>}
    </section>
  );
}
