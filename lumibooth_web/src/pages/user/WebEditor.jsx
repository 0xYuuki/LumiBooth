import { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhotoboothContext } from '../../context/photoboothContext';
import { motion, useMotionValue } from 'framer-motion';
import { BoothHeader, MiniStrip } from '../../components/BoothUI';
import { toPng } from 'html-to-image';

import { frameBackground, frameLibrary } from './frameLibrary';

const stickerLibrary = ['✨', '💖', '🎀', '🧸', '🌸', '🍒', '🦋', '👑', '🎂', '🎉', '🌟', '🐾', '☁️', '🍓', '🍑', '🍭', '🧊', '💋', '💅', '🧚‍♀️', '🦄', '🌈', '🔥', '❤️‍🔥'];

const WebEditor = () => {
  const { session, dispatch } = useContext(PhotoboothContext);
  const { photos, layout, stickers: placedStickers } = session;
  const selectedFrame = session.frame ?? frameLibrary.Templates[0];
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Frames');
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
  const addSticker = (emoji) => {
    const id = (placedStickers.at(-1)?.id ?? 0) + 1;
    edit({ stickers: [...placedStickers, { id, emoji, size: 50, x: 0.4, y: 0.4 }] });
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
              <div className="strip-signature" style={{ borderTop: selectedFrame.rule ? '1px solid currentColor' : undefined, paddingBottom: selectedFrame.footer, backgroundColor: selectedFrame.signaturePaper ? selectedFrame.bg : undefined }}>
                <strong>LumiBooth</strong>
                <span>{selectedFrame.caption ?? 'THE PHOTO BOOTH'}</span>
              </div>
              {placedStickers.map((sticker) => (
                <StripSticker
                  key={sticker.id}
                  sticker={sticker}
                  selected={selectedStickerId === sticker.id}
                  constraintsRef={constraintsRef}
                  disabled={exporting}
                  onSelect={() => setSelectedStickerId(sticker.id)}
                  onMove={(position) => updateSticker(sticker.id, position)}
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
                <p className="sticker-help">Drag a sticker or focus it and use the arrow keys to move it.</p>
                <div className="sticker-gallery">
                  {stickerLibrary.map((emoji) => (
                    <button key={emoji} onClick={() => addSticker(emoji)}>{emoji}</button>
                  ))}
                </div>
                {selectedSticker && (
                  <label className="sticker-size">
                    Sticker size
                    <input type="range" min="20" max="150" value={selectedSticker.size}
                      onChange={(event) => updateSticker(selectedSticker.id, { size: Number(event.target.value) })} />
                  </label>
                )}
              </>
            )}
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

function offsetPosition(position, offset, travel) {
  return travel > 0 ? Math.max(0, Math.min(1, position + offset / travel)) : position;
}

function StripSticker({ sticker, selected, constraintsRef, disabled, onSelect, onMove, onDelete }) {
  const stickerRef = useRef(null);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const move = (offsetX, offsetY) => {
    const strip = constraintsRef.current;
    const element = stickerRef.current;
    onMove({
      x: offsetPosition(sticker.x, offsetX, strip.clientWidth - element.offsetWidth),
      y: offsetPosition(sticker.y, offsetY, strip.clientHeight - element.offsetHeight),
    });
  };

  const handleArrowKey = (event) => {
    const offset = arrowOffsets[event.key];
    if (!offset) return;
    event.preventDefault();
    onSelect();
    move(...offset);
  };

  return (
    <motion.div
      ref={stickerRef}
      drag={!disabled}
      dragConstraints={constraintsRef}
      dragElastic={0}
      dragMomentum={false}
      onDragEnd={() => {
        move(dragX.get(), dragY.get());
        dragX.jump(0);
        dragY.jump(0);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        x: dragX,
        y: dragY,
        '--sticker-size': `${sticker.size}px`,
        left: `calc((100% - var(--sticker-size)) * ${sticker.x})`,
        top: `calc((100% - var(--sticker-size)) * ${sticker.y})`,
      }}
      className="strip-sticker"
    >
      <span aria-hidden="true">{sticker.emoji}</span>
      <button
        type="button"
        className="sticker-select"
        data-editor-only
        disabled={disabled}
        aria-label={`Select ${sticker.emoji} sticker`}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        aria-pressed={selected}
        onPointerDown={onSelect}
        onClick={onSelect}
        onKeyDown={handleArrowKey}
      />
      {selected && (
        <button
          type="button"
          className="sticker-delete"
          data-editor-only
          disabled={disabled}
          aria-label={`Remove ${sticker.emoji} sticker`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDelete}
        >
          ×
        </button>
      )}
    </motion.div>
  );
}

export default WebEditor;
