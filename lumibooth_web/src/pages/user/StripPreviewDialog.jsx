import { useLayoutEffect, useRef, useState } from 'react';

export default function StripPreviewDialog({ size, onClose, children }) {
  const dialog = useRef(null);
  const viewport = useRef(null);
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(null);

  useLayoutEffect(() => {
    const panel = dialog.current;
    panel.showModal();
    const observer = new ResizeObserver(([{ contentRect }]) => setBounds(contentRect));
    observer.observe(viewport.current);
    return () => {
      observer.disconnect();
      panel.close();
    };
  }, []);

  const aspect = size.width / size.height;
  const fit = bounds ? Math.min(bounds.width, bounds.height * aspect) : 0;
  const width = zoom === null ? fit : bounds.width * zoom;

  return (
    <dialog ref={dialog} className="strip-viewer" aria-label="Strip preview"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="strip-viewer-tools">
        <button className="booth-link" onClick={onClose} autoFocus>Close preview</button>
        <button className="booth-link" aria-pressed={zoom === null} onClick={() => setZoom(null)}>Fit strip</button>
        <button className="booth-link" aria-pressed={zoom === 1} onClick={() => setZoom(1)} disabled={!bounds}>Fit width</button>
        <button className="booth-link" aria-pressed={zoom === 2} onClick={() => setZoom(2)} disabled={!bounds}>Zoom 2×</button>
      </div>
      <div className="strip-viewer-scroll" ref={viewport} tabIndex={0} aria-label="Scrollable strip">
        {width > 0 && <div className="strip-viewer-image" style={{ width, height: width / aspect }}>
          {children(width)}
        </div>}
      </div>
    </dialog>
  );
}
