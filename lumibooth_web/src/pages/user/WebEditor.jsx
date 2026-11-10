import { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoboothContext } from '../../context/photoboothContext';
import { BoothHeader, MiniStrip } from '../../components/BoothUI';
import { toPng } from 'html-to-image';

import { frameBackground, frameLibrary } from './frameLibrary';

import StickerArt from './StickerArt';
import { stickerPacks } from './stickerPacks';

const captionLimit = 32;
const signatureFonts = ['Outfit', 'Playfair Display', 'Space Mono', 'Caveat'];

const WebEditor = () => {
  const { session, dispatch } = useContext(PhotoboothContext);
  const { photos, layout, stickers: placedStickers } = session;
  const selectedFrame = session.frame ?? frameLibrary.Templates[0];
  const signatureFont = session.signatureFont ?? signatureFonts[0];
  const caption = session.caption ?? selectedFrame.caption ?? 'THE PHOTO BOOTH';
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Frames');
  const [stickerPack, setStickerPack] = useState(stickerPacks[0]);
  const [activeCategory, setActiveCategory] = useState(() =>
    session.frame
      ? Object.keys(frameLibrary).find((category) => frameLibrary[category].includes(selectedFrame)) ?? 'Illustrated'
      : 'Illustrated'
  );
  const [selectedStickerId, setSelectedStickerId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const constraintsRef = useRef(null);
  const exportJob = useRef(null);

  useEffect(() => () => { exportJob.current = null; }, []);

  const edit = (changes) => dispatch({ type: 'edit', changes });
  const addSticker = (art) => {
    const id = (placedStickers.at(-1)?.id ?? 0) + 1;
    edit({ stickers: [...placedStickers, { id, art, size: art.url ? 72 : 50, angle: 0, x: 0.4, y: 0.4 }] });
    setSelectedStickerId(id);
  };

  const updateSticker = (id, changes) => {
    edit({ stickers: placedStickers.map((sticker) =>
      sticker.id === id ? { ...sticker, ...changes } : sticker) });
  };

  const deleteSticker = (id) => {
    edit({ stickers: placedStickers.filter((sticker) => sticker.id !== id) });
    setSelectedStickerId(null);
  };

  const exportStrip = async () => {
    if (exportJob.current) return;
    const job = {};
    exportJob.current = job;
    setExporting(true);
    setExportError('');
    try {
      await document.fonts.ready;
      if (exportJob.current !== job) return;
      const output = await toPng(constraintsRef.current, {
        pixelRatio: 3,
        filter: (node) => !node.hasAttribute?.('data-editor-only'),
        style: { boxShadow: 'none', transition: 'none' },
      });
      if (exportJob.current !== job) return;
      dispatch({ type: 'export', session, output });
      navigate('/preview');
    } catch {
      if (exportJob.current === job) {
        setExportError('Could not create the photo strip. Try again.');
      }
    } finally {
      if (exportJob.current === job) {
        exportJob.current = null;
        setExporting(false);
      }
    }
  };

  const selectedSticker = placedStickers.find(({ id }) => id === selectedStickerId);

  return (
    <div className="booth-shell">
      <BoothHeader step="03 / DESIGN" />
      <main className="booth-content">
        <div className="design-heading">
          <div>
            <p className="booth-eyebrow">STEP 03 OF 04</p>
            <h1 className="booth-title">Make it yours.</h1>
            <p className="booth-intro">Choose a frame and add stickers to your strip.</p>
          </div>
          <button className="booth-button" disabled={exporting} onClick={exportStrip}>{exporting ? 'Preparing…' : 'Next'}</button>
        </div>
        {exportError && <p role="alert" className="editor-error">{exportError}</p>}

        <div className="design-workspace">
          <div className="design-stage">
            <div
              ref={constraintsRef}
              className="photo-strip"
              onPointerDown={() => setSelectedStickerId(null)}
              style={{
                ...frameBackground(selectedFrame),
                '--strip-width': layout.columns === 1 && layout.count > 1 ? '220px' : '360px',
                gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
                color: selectedFrame.ink ?? '#292630',
                outline: selectedFrame.border ? `1px solid ${selectedFrame.border}` : undefined,
                outlineOffset: selectedFrame.border ? -9 : undefined,
              }}
            >
              {selectedFrame.header && (
                <img className="illustrated-header" src={selectedFrame.header} alt="" />
              )}
              {photos.map((photo, index) => (
                selectedFrame.artwork
                  ? <IllustratedPhoto key={index} frame={selectedFrame} photo={photo} index={index} />
                  : <img key={index} src={photo} alt={`Captured photo ${index + 1}`}
                      style={{ borderRadius: selectedFrame.radius ?? 4 }} />
              ))}
              <div className="strip-signature" style={{ fontFamily: `"${signatureFont}", sans-serif`, borderTop: selectedFrame.rule ? '1px solid currentColor' : undefined, paddingBottom: selectedFrame.footer, backgroundColor: selectedFrame.signaturePaper ? selectedFrame.bg : undefined }}>
                <strong>LumiBooth</strong>
                <span className="strip-caption">{caption.trim()}</span>
              </div>
              {placedStickers.map((sticker) => (
                <StripSticker
                  key={sticker.id}
                  sticker={sticker}
                  selected={selectedStickerId === sticker.id}
                  constraintsRef={constraintsRef}
                  disabled={exporting}
                  onSelect={() => setSelectedStickerId(sticker.id)}
                  onChange={(changes) => updateSticker(sticker.id, changes)}
                  onDelete={() => deleteSticker(sticker.id)}
                />
              ))}
            </div>
          </div>

          <fieldset className="design-tools" disabled={exporting} aria-label="Strip design">
            <div className="design-tabs">
              {['Frames', 'Stickers'].map((tab) => (
                <button key={tab} aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</button>
              ))}
            </div>
            {activeTab === 'Frames' && (
              <>
                <div className="frame-categories">
                  {Object.keys(frameLibrary).map((category) => (
                    <button key={category} aria-pressed={activeCategory === category}
                      onClick={() => setActiveCategory(category)}>{category}</button>
                  ))}
                </div>
                <div className="frame-gallery">
                  {frameLibrary[activeCategory].map((frame) => (
                    <button key={frame.name} aria-pressed={selectedFrame === frame} onClick={() => edit({ frame })}>
                      {frame.artwork ? (
                        <span className="illustrated-thumbnail" aria-hidden="true" style={{ backgroundColor: frame.bg }}>
                          <IllustratedPhoto frame={frame} />
                        </span>
                      ) : (
                        <MiniStrip count={layout.count} columns={layout.columns}
                          style={{ ...frameBackground(frame), '--mini-ink': frame.ink, borderColor: frame.border, '--mini-radius': `${(frame.radius ?? 4) / 2}px` }} />
                      )}
                      <span>{frame.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {activeTab === 'Stickers' && (
              <>
                <p className="sticker-help">Drag a sticker to move it. Use its corner handles to rotate or resize it.</p>
                <label className="sticker-pack-picker">
                  Sticker pack
                  <select value={stickerPack.id} onChange={(event) => setStickerPack(
                    stickerPacks.find((pack) => pack.id === event.target.value),
                  )}>
                    {stickerPacks.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
                  </select>
                </label>
                <div className={`sticker-gallery${stickerPack.id === 'emoji' ? '' : ' sticker-image-gallery'}`}>
                  {stickerPack.items.map((art) => (
                    <button key={art.name} title={art.name} aria-label={art.name} onClick={() => addSticker(art)}>
                      <StickerArt art={art} />
                    </button>
                  ))}
                </div>
                {selectedSticker && (
                  <>
                    <label className="sticker-size">
                      Sticker size
                      <input type="range" min={minStickerSize} max={maxStickerSize} value={selectedSticker.size}
                        onChange={(event) => updateSticker(selectedSticker.id, resizeSticker(
                          selectedSticker, Number(event.target.value), constraintsRef.current,
                        ))} />
                    </label>
                    <label className="sticker-size">
                      Sticker rotation
                      <input type="range" min="-180" max="180" value={selectedSticker.angle ?? 0}
                        onChange={(event) => updateSticker(selectedSticker.id, { angle: Number(event.target.value) })} />
                    </label>
                  </>
                )}
              </>
            )}
            <div className="caption-tools">
              <label htmlFor="strip-font">Strip font</label>
              <select id="strip-font" value={signatureFont} onChange={(event) => edit({ signatureFont: event.target.value })}>
                {signatureFonts.map((font) => <option key={font}>{font}</option>)}
              </select>
              <label htmlFor="strip-caption">Caption under LumiBooth (optional)</label>
              <input
                id="strip-caption"
                type="text"
                maxLength={captionLimit}
                value={caption}
                placeholder="Write a short caption"
                aria-describedby="caption-limit"
                onChange={(event) => edit({ caption: event.target.value })}
              />
              <small id="caption-limit">{caption.length}/{captionLimit} characters</small>
              <div className="caption-actions">
                <button type="button" className="booth-link" disabled={!caption.trim()} onClick={() => edit({ caption: '' })}>
                  Remove caption
                </button>
                <button type="button" className="booth-link" disabled={session.caption == null} onClick={() => edit({ caption: null })}>
                  Use frame caption
                </button>
              </div>
            </div>
          </fieldset>
        </div>
      </main>
    </div>
  );
};

function IllustratedPhoto({ frame, photo, index = 0 }) {
  const [x, y, width, height, radius] = frame.window;
  return (
    <div className="illustrated-photo"
      style={{ transform: photo && frame.tilt ? `rotate(${index % 2 ? frame.tilt : -frame.tilt}deg)` : undefined }}>
      <span className="illustrated-window" style={{
        left: `${x / 4}%`, top: `${y / 3}%`, width: `${width / 4}%`, height: `${height / 3}%`,
        borderRadius: `${radius / width * 100}% / ${radius / height * 100}%`,
      }}>
        {photo && <img src={photo} alt={`Captured photo ${index + 1}`} />}
      </span>
      <img className="illustrated-overlay" src={frame.artwork} alt="" />
    </div>
  );
}

const arrowOffsets = {
  ArrowLeft: [-10, 0],
  ArrowRight: [10, 0],
  ArrowUp: [0, -10],
  ArrowDown: [0, 10],
};

const minStickerSize = 32;
const maxStickerSize = 150;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function positionForPixels(left, top, size, strip) {
  return {
    x: clamp(left / Math.max(1, strip.clientWidth - size), 0, 1),
    y: clamp(top / Math.max(1, strip.clientHeight - size), 0, 1),
  };
}

function moveSticker(sticker, dx, dy, strip) {
  const left = sticker.x * (strip.clientWidth - sticker.size);
  const top = sticker.y * (strip.clientHeight - sticker.size);
  return positionForPixels(left + dx, top + dy, sticker.size, strip);
}

function resizeSticker(sticker, nextSize, strip) {
  const size = clamp(nextSize, minStickerSize, Math.min(maxStickerSize, strip.clientWidth, strip.clientHeight));
  const left = sticker.x * (strip.clientWidth - sticker.size);
  const top = sticker.y * (strip.clientHeight - sticker.size);
  return { size, ...positionForPixels(left, top, size, strip) };
}

function StripSticker({ sticker, selected, constraintsRef, disabled, onSelect, onChange, onDelete }) {
  const stickerRef = useRef(null);
  const gesture = useRef(null);

  const start = (event, mode) => {
    event.stopPropagation();
    if (disabled || gesture.current || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = stickerRef.current.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    gesture.current = {
      mode,
      pointer: event.pointerId,
      sticker,
      x: event.clientX,
      y: event.clientY,
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
    };
    onSelect();
  };

  const drag = (event) => {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointer || disabled) return;
    const strip = constraintsRef.current;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (active.mode === 'move') {
      onChange(moveSticker(active.sticker, dx, dy, strip));
    } else if (active.mode === 'resize') {
      onChange(resizeSticker(active.sticker, Math.round(active.sticker.size + (dx + dy) / 2), strip));
    } else {
      const radians = Math.atan2(event.clientY - active.centerY, event.clientX - active.centerX);
      const angle = Math.round((active.sticker.angle ?? 0) + (radians - active.startAngle) * 180 / Math.PI);
      onChange({ angle: ((angle % 360 + 540) % 360) - 180 });
    }
  };

  const finish = (event) => {
    if (gesture.current?.pointer === event.pointerId) gesture.current = null;
  };

  const handleArrowKey = (event) => {
    const offset = arrowOffsets[event.key];
    if (!offset) return;
    event.preventDefault();
    onSelect();
    onChange(moveSticker(sticker, ...offset, constraintsRef.current));
  };

  return (
    <div
      ref={stickerRef}
      onPointerMove={drag}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      style={{
        '--sticker-size': `${sticker.size}px`,
        left: `calc((100% - var(--sticker-size)) * ${sticker.x})`,
        top: `calc((100% - var(--sticker-size)) * ${sticker.y})`,
      }}
      className="strip-sticker"
    >
      <div className="sticker-visual" style={{ transform: `rotate(${sticker.angle ?? 0}deg)` }}>
        <StickerArt art={sticker.art} />
      </div>
      <button
        type="button"
        className="sticker-select"
        data-editor-only
        disabled={disabled}
        aria-label={`Select ${sticker.art.name} sticker`}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        aria-pressed={selected}
        onPointerDown={(event) => start(event, 'move')}
        onClick={onSelect}
        onKeyDown={handleArrowKey}
      />
      {selected && (
        <>
          <button type="button" className="sticker-handle sticker-rotate" data-editor-only
            aria-label="Rotate sticker" title="Drag to rotate" disabled={disabled}
            onPointerDown={(event) => start(event, 'rotate')}
            onClick={(event) => {
              if (event.detail === 0) onChange({ angle: ((sticker.angle ?? 0) + 195) % 360 - 180 });
            }}>↻</button>
          <button type="button" className="sticker-handle sticker-resize" data-editor-only
            aria-label="Resize sticker" title="Drag to resize" disabled={disabled}
            onPointerDown={(event) => start(event, 'resize')}
            onClick={(event) => {
              if (event.detail === 0) onChange(resizeSticker(sticker, sticker.size + 10, constraintsRef.current));
            }}>↘</button>
          <button type="button" className="sticker-handle sticker-delete" data-editor-only
            disabled={disabled} aria-label={`Remove ${sticker.art.name} sticker`}
            onPointerDown={(event) => event.stopPropagation()} onClick={onDelete}>×</button>
        </>
      )}
    </div>
  );
}

export default WebEditor;
