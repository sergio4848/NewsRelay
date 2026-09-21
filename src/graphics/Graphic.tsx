import { useState, type CSSProperties } from 'react';
import { type Config, type Item } from '../core/model';
import './graphic.css';
function Media({ item }: { item: Item }) {
  const [failed, setFailed] = useState(false);
  const attachment = item.media[0];
  if (!attachment || failed) return null;
  return (
    <div className="graphic-media">
      {attachment.type === 'video' ? (
        <video
          src={attachment.url}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setFailed(true)}
        />
      ) : (
        <img src={attachment.url} alt={attachment.alt} onError={() => setFailed(true)} />
      )}
    </div>
  );
}
export function Graphic({
  item,
  theme,
  language,
  test = false,
}: {
  item: Item | null;
  theme: Config['theme'];
  language: Config['language'];
  test?: boolean;
}) {
  if (!item) return <div className="graphic-canvas" />;
  const labels =
    language === 'tr'
      ? { breaking: 'SON DAKİKA', test: 'TEST YAYINI', demo: 'ÖRNEK' }
      : { breaking: 'BREAKING', test: 'TEST OUTPUT', demo: 'DEMO' };
  const style = {
    '--graphic-primary': theme.primary,
    '--graphic-accent': theme.accent,
    '--graphic-scale': theme.scale,
  } as CSSProperties;
  return (
    <div className="graphic-canvas" style={style}>
      {test && <div className="test-slate">{labels.test} · 1920 × 1080</div>}
      <section className={'graphic ' + item.template}>
        <div className="graphic-label">
          {theme.logo && (
            <img
              className="graphic-logo"
              src={theme.logo}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          {item.template === 'breaking' ? labels.breaking : theme.label}
          <span>{item.provider === 'demo' ? labels.demo : theme.customer}</span>
        </div>
        <div className="graphic-content">
          {item.template === 'media' && <Media key={item.id + item.media[0]?.url} item={item} />}
          <div className="graphic-copy">
            <h1>{item.template === 'quote' ? '“' + item.headline + '”' : item.headline}</h1>
            {item.template === 'quote' && <p>{item.body.slice(0, 420)}</p>}
            <div className="graphic-source">{item.publisher.name}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
