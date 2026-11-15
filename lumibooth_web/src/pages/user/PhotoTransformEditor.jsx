import { useEffect, useRef, useState } from 'react';
import { cropGeometry, normalizeCrop, panCrop, resizeCrop } from './photoCrop';

const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export default function PhotoTransformEditor({ src, crop, aspect, onChange, onClose }) {
  const dialog = useRef(null);
  const workspace = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const [area, setArea] = useState({ width: 640, height: 420 });
  const [natural, setNatural] = useState(null);
  const value = normalizeCrop(crop);
  const [fitCrop, setFitCrop] = useState(() => normalizeCrop(crop));
  const width = 240, height = width / aspect;
  const geometry = natural ? cropGeometry(natural.width, natural.height, width, height, value) : { x: 0, y: 0, width, height };
  const fitted = natural ? cropGeometry(natural.width, natural.height, width, height, fitCrop) : geometry;
  const fitWidth = 2 * Math.max(width / 2 - fitted.x, fitted.x + fitted.width - width / 2);
  const fitHeight = 2 * Math.max(height / 2 - fitted.y, fitted.y + fitted.height - height / 2);
  const scale = Math.min((area.width - 56) / fitWidth, (area.height - 56) / fitHeight);
  const offsetX = (area.width - width * scale) / 2;
  const offsetY = (area.height - height * scale) / 2;
  const imageStyle = { left: offsetX + geometry.x * scale, top: offsetY + geometry.y * scale, width: geometry.width * scale, height: geometry.height * scale };

  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    const observer = new ResizeObserver(([entry]) => setArea({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(workspace.current);
    return () => { observer.disconnect(); node.close(); };
  }, []);

  const begin = (mode) => {
    const points = [...pointers.current.values()];
    gesture.current = { crop: value, scale, mode, point: points[0], distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0 };
  };
  const down = (event, mode = 'pan') => {
    if (event.button !== 0 || !natural) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    begin(mode);
  };
  const move = (event) => {
    const start = gesture.current;
    if (!start || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length > 1 && start.distance) {
      onChange(normalizeCrop({ ...start.crop, zoom: start.crop.zoom * Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) / start.distance }));
    } else {
      const dx = (event.clientX - start.point.x) / start.scale;
      const dy = (event.clientY - start.point.y) / start.scale;
      onChange(start.mode === 'pan'
        ? panCrop(start.crop, natural.width, natural.height, width, height, dx, dy)
        : resizeCrop(start.crop, natural.width, natural.height, width, height, start.mode, dx, dy));
    }
  };
  const end = (event) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size) begin('pan'); else gesture.current = null;
  };
  const events = { onPointerMove: move, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end };
  return (
    <dialog ref={dialog} className="photo-transform-dialog" aria-labelledby="photo-transform-title" onClose={(event) => { if (!event.currentTarget.open) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="photo-transform-heading">
        <div><h2 id="photo-transform-title">Adjust your photo</h2><p>Drag the image or pull a corner. The outlined window is your frame.</p></div>
        <button type="button" className="booth-button" onClick={onClose}>Done</button>
      </div>
      <div ref={workspace} className="photo-transform-workspace" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <img className="transform-ghost" src={src} alt="Full original photo" draggable={false} style={imageStyle}
          onLoad={({ currentTarget }) => setNatural({ width: currentTarget.naturalWidth, height: currentTarget.naturalHeight })} />
        <div className="transform-window" aria-hidden="true" style={{ left: offsetX, top: offsetY, width: width * scale, height: height * scale }}>
          <img src={src} alt="" draggable={false} style={{ left: geometry.x * scale, top: geometry.y * scale, width: geometry.width * scale, height: geometry.height * scale }} />
        </div>
        {natural && <div className="transform-image-bounds" role="button" tabIndex={0} aria-label="Reposition photo" style={imageStyle}
          onPointerDown={(event) => down(event)} {...events}
          onKeyDown={(event) => {
            const delta = { ArrowLeft: [.05, 0], ArrowRight: [-.05, 0], ArrowUp: [0, .05], ArrowDown: [0, -.05] }[event.key];
            if (delta) { event.preventDefault(); onChange(normalizeCrop({ ...value, x: value.x + delta[0], y: value.y + delta[1] })); }
          }}>
          {corners.map((corner) => <button key={corner} type="button" className={`photo-transform-handle ${corner}`} aria-label={`Resize photo ${corner}`} onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => down(event, corner)} {...events} onKeyDown={(event) => {
              if (['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); onChange(normalizeCrop({ ...value, zoom: value.zoom + (event.key === 'ArrowUp' ? .1 : -.1) })); }
            }} />)}
        </div>}
      </div>
      <div className="photo-transform-toolbar">
        <button type="button" className="booth-button booth-secondary" onClick={() => { onChange({}); setFitCrop(normalizeCrop()); }}>Reset crop</button>
        <button type="button" className="booth-button booth-secondary" onClick={() => setFitCrop(value)}>Fit image</button>
        <label>Zoom <input type="range" min="1" max="3" step="0.01" value={value.zoom} onChange={(event) => onChange({ ...value, zoom: Number(event.target.value) })} /></label>
      </div>
    </dialog>
  );
}
