import { useState } from 'react';
import { type Command } from '../core/model';
import { type Strings } from './i18n';
export function Compose({ t, command }: { t: Strings; command: (c: Command) => void }) {
  const [open, setOpen] = useState(false),
    [headline, setHeadline] = useState(''),
    [body, setBody] = useState(''),
    [publisher, setPublisher] = useState('');
  return (
    <div className="compose">
      <button onClick={() => setOpen(!open)}>{t.compose}</button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            command({ type: 'compose', headline, body, publisher });
            setOpen(false);
            setHeadline('');
            setBody('');
          }}
        >
          <label>
            {t.publisher}
            <input
              required
              maxLength={80}
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
            />
          </label>
          <label>
            {t.headline}
            <input
              required
              maxLength={280}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </label>
          <label>
            {t.body}
            <textarea maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <button>{t.create}</button>
        </form>
      )}
    </div>
  );
}
