import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Graphic } from '../graphics/Graphic';
import { type Config, type Item } from '../core/model';
import './output.css';
type Projection = {
  program: Item | null;
  theme: Config['theme'];
  language: Config['language'];
  test: boolean;
};
const params = new URLSearchParams(location.search),
  token = params.get('token') || '',
  test = params.get('test') === '1',
  client = crypto.randomUUID();
function Output() {
  const [state, setState] = useState<Projection | null>(null);
  useEffect(() => {
    let stopped = false,
      timer: ReturnType<typeof setTimeout>,
      failures = 0;
    const poll = async () => {
      try {
        const r = await fetch('/state' + (test ? '?test=1' : ''), {
          headers: { Authorization: 'Bearer ' + token, 'X-Output-Client': client },
          signal: AbortSignal.timeout(4000),
        });
        if (!r.ok) throw new Error('Unavailable');
        const data = (await r.json()) as Projection;
        if (!stopped) {
          setState((previous) =>
            JSON.stringify(previous) === JSON.stringify(data) ? previous : data,
          );
          failures = 0;
        }
      } catch {
        failures++;
        if (failures >= 3 && !stopped) setState(null);
      } finally {
        if (!stopped) timer = setTimeout(() => void poll(), Math.min(10000, 500 * 2 ** failures));
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
  return state ? (
    <Graphic item={state.program} theme={state.theme} language={state.language} test={state.test} />
  ) : null;
}
createRoot(document.getElementById('root')!).render(<Output />);
