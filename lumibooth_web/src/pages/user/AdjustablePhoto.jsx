import { useRef } from 'react';
import { cropGeometry, normalizeCrop } from './photoCrop';

export default function AdjustablePhoto({ src, alt, crop, onError, editing, selected, onSelect, onChange, angle = 0 }) {
  const container = useRef(null);
  const image = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const value = normalizeCrop(crop);
  const begin = () => {
    const points = [...pointers.current.values()];
    gesture.current = { crop: value, point: points[0], distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0 };
  };
  const finish = (event) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size) begin();
    else gesture.current = null;
  };
  const move = (event) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const start = gesture.current;
    if (points.length > 1 && start.distance) {
      onChange(normalizeCrop({ ...start.crop, zoom: start.crop.zoom * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / start.distance }));
      return;
    }
    const width = container.current.clientWidth;
    const height = container.current.clientHeight;
    if (!image.current.naturalWidth) return;
    const geometry = cropGeometry(image.current.naturalWidth, image.current.naturalHeight, width, height, start.crop);
    const dx = event.clientX - start.point.x;
    const dy = event.clientY - start.point.y;
    const radians = angle * Math.PI / 180;
    onChange(normalizeCrop({ ...start.crop,
      x: start.crop.x - (dx * Math.cos(radians) + dy * Math.sin(radians)) / (geometry.width - width || Infinity),
      y: start.crop.y - (dy * Math.cos(radians) - dx * Math.sin(radians)) / (geometry.height - height || Infinity),
    }));
  };
  return (
    <span ref={container} className={`photo-aperture${editing ? ' photo-adjustable' : ''}${editing && selected ? ' photo-adjusting' : ''}`}
      role={editing ? 'button' : undefined} tabIndex={editing ? 0 : undefined}
      aria-label={editing ? `Adjust ${alt.toLowerCase()}` : undefined} aria-pressed={editing ? selected : undefined}
      onPointerDown={editing ? (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        onSelect();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        begin();
      } : undefined}
      onPointerMove={editing ? move : undefined} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onKeyDown={editing ? (event) => {
        if (['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(); }
        const delta = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[event.key];
        if (delta) { event.preventDefault(); onSelect(); onChange(normalizeCrop({ ...value, x: value.x + delta[0], y: value.y + delta[1] })); }
      } : undefined}>
      <img ref={image} src={src} alt={alt} onError={onError} draggable={false} style={{
        objectPosition: `${value.x * 100}% ${value.y * 100}%`, transform: `scale(${value.zoom})`, transformOrigin: `${value.x * 100}% ${value.y * 100}%`,
      }} />
    </span>
  );
}
