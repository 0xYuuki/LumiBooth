import { ArrowLeft, Aperture } from 'lucide-react';
import { Link } from 'react-router-dom';

export function BoothHeader({ step, back, onCancel }) {
  return (
    <header className="booth-header">
      <Link className="booth-brand" to="/" aria-label="LumiBooth home">
        <Aperture size={21} aria-hidden="true" /> LumiBooth<span>.</span>
      </Link>
      <span className="booth-step">{step}</span>
      {onCancel && <button className="booth-link" onClick={onCancel} aria-label="Cancel session">Cancel</button>}
      {back && <Link className="booth-link" to={back}><ArrowLeft size={15} aria-hidden="true" /> Back</Link>}
    </header>
  );
}

export function MiniStrip({ count, columns, style }) {
  return (
    <span className="mini-strip" data-count={count} aria-hidden="true" style={{ ...style, gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: count }, (_, index) => <i key={index} />)}
    </span>
  );
}
