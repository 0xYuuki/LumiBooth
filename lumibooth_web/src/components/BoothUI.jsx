import { ArrowLeft, Aperture } from 'lucide-react';
import { Link } from 'react-router-dom';

export function BoothHeader({ step, back }) {
  return (
    <header className="booth-header">
      <Link className="booth-brand" to="/" aria-label="LumiBooth home">
        <Aperture size={21} aria-hidden="true" /> LumiBooth<span>.</span>
      </Link>
      <span className="booth-step">{step}</span>
      {back && <Link className="booth-link" to={back}><ArrowLeft size={15} aria-hidden="true" /> Back</Link>}
    </header>
  );
}

export function BoothStep({ number, back, backLabel = 'Back to previous step', disabled = false }) {
  return (
    <nav className="booth-step-navigation" aria-label="Photo booth steps">
      <Link className="booth-back" to={back} aria-label={backLabel}
        aria-disabled={disabled || undefined} onClick={(event) => { if (disabled) event.preventDefault(); }}>
        <ArrowLeft size={20} aria-hidden="true" />
      </Link>
      <p className="booth-eyebrow">STEP {String(number).padStart(2, '0')} OF 03</p>
    </nav>
  );
}

export function MiniStrip({ count, columns, style }) {
  return (
    <span className="mini-strip" data-count={count} aria-hidden="true" style={{ ...style, gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: count }, (_, index) => <i key={index} />)}
    </span>
  );
}
