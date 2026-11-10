import { frameBackground, frameLibrary } from './frameLibrary';
import StickerArt from './StickerArt';

export function PhotoStrip({ session, motionUrls = [], stripRef, onPointerDown, children }) {
  const { layout, photos, stickers } = session;
  const paired = layout.photosPerCell === 2;
  const frame = session.frame ?? frameLibrary.Templates[0];
  const font = session.signatureFont ?? 'Outfit';
  const caption = session.caption ?? frame.caption ?? 'THE PHOTO BOOTH';
  return (
    <div
      ref={stripRef}
      className="photo-strip"
      onPointerDown={onPointerDown}
      style={{
        ...frameBackground(frame),
        '--strip-width': paired ? '320px' : layout.columns === 1 && layout.count > 1 ? '220px' : '360px',
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        color: frame.ink ?? '#292630',
        outline: frame.border ? `1px solid ${frame.border}` : undefined,
        outlineOffset: frame.border ? -9 : undefined,
      }}
    >
      {frame.header && <img className="illustrated-header" src={frame.header} alt="" />}
      {paired ? Array.from({ length: layout.count }, (_, index) => {
        const pair = <span className="paired-photos">
          <img src={photos[index * 2]} alt={`Round ${index + 1}, host photo`} />
          <img src={photos[index * 2 + 1]} alt={`Round ${index + 1}, guest photo`} />
        </span>;
        return frame.artwork
          ? <IllustratedPhoto key={index} frame={frame} index={index}>{pair}</IllustratedPhoto>
          : <div className="paired-photo-cell" key={index} style={{ borderRadius: frame.radius ?? 4 }}>{pair}</div>;
      }) : photos.map((still, index) => {
        const motion = motionUrls[index];
        const photo = motion ?? still;
        const fallback = motion ? ({ currentTarget }) => {
          if (currentTarget.src !== still) currentTarget.src = still;
        } : undefined;
        return frame.artwork
          ? <IllustratedPhoto key={index} frame={frame} photo={photo} index={index} onError={fallback} />
          : <img key={index} data-photo-index={index} src={photo} alt={`Captured photo ${index + 1}`} onError={fallback}
              style={{ borderRadius: frame.radius ?? 4 }} />;
      })}
      <div className="strip-signature" style={{
        fontFamily: `"${font}", sans-serif`,
        borderTop: frame.rule ? '1px solid currentColor' : undefined,
        paddingBottom: frame.footer,
        backgroundColor: frame.signaturePaper ? frame.bg : undefined,
      }}>
        <strong>LumiBooth</strong>
        <span className="strip-caption">{caption.trim()}</span>
      </div>
      {children ?? stickers.map((sticker) => <StickerLayer key={sticker.id} sticker={sticker} />)}
    </div>
  );
}

export function StickerLayer({ sticker, layerRef, children, ...events }) {
  return (
    <div
      ref={layerRef}
      {...events}
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
      {children}
    </div>
  );
}

export function IllustratedPhoto({ frame, photo, index = 0, onError, children }) {
  const [x, y, width, height, radius] = frame.window;
  return (
    <div className="illustrated-photo" data-photo-index={photo ? index : undefined}
      style={{ transform: (photo || children) && frame.tilt ? `rotate(${index % 2 ? frame.tilt : -frame.tilt}deg)` : undefined }}>
      <span className="illustrated-window" style={{
        left: `${x / 4}%`, top: `${y / 3}%`, width: `${width / 4}%`, height: `${height / 3}%`,
        borderRadius: `${radius / width * 100}% / ${radius / height * 100}%`,
      }}>
        {photo && <img src={photo} onError={onError} alt={`Captured photo ${index + 1}`} />}
        {children}
      </span>
      <img className="illustrated-overlay" src={frame.artwork} alt="" />
    </div>
  );
}
