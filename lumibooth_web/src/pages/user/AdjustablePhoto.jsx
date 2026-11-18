import { normalizeCrop } from './photoCrop';

export default function AdjustablePhoto({ src, alt, crop, onError, editing, onSelect }) {
  const value = normalizeCrop(crop);
  const select = (event) => {
    event.stopPropagation();
    onSelect(event.currentTarget.clientWidth / event.currentTarget.clientHeight);
  };
  return (
    <span className={`photo-aperture${editing ? ' photo-selectable' : ''}`}
      role={editing ? 'button' : undefined} tabIndex={editing ? 0 : undefined}
      aria-label={editing ? `Adjust ${alt.toLowerCase()}` : undefined}
      onClick={editing ? select : undefined}
      onKeyDown={editing ? (event) => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); select(event); } } : undefined}>
    <img src={src} alt={alt} onError={onError} draggable={false} style={value.contain ? { objectFit: 'contain' } : {
        objectPosition: `${value.x * 100}% ${value.y * 100}%`, transform: `scale(${value.zoom})`, transformOrigin: `${value.x * 100}% ${value.y * 100}%`,
      }} />
    </span>
  );
}
