import { useEffect, useRef, useState } from 'react';

function MotionPhoto({ motion, number }) {
  const { gif, status } = motion;
  const url = useRef(null);
  const [playingUrl, setPlayingUrl] = useState(null);

  useEffect(() => () => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  }, [gif]);

  const getUrl = () => (url.current ??= URL.createObjectURL(gif));
  const save = () => {
    const link = document.createElement('a');
    link.href = getUrl();
    link.download = `lumibooth-shot-${number}.gif`;
    link.click();
  };

  return (
    <li>
      <strong>Shot {number}</strong>
      {status === 'pending' && <p role="status">Preparing motion…</p>}
      {status === 'unavailable' && <p>Motion unavailable for this shot.</p>}
      {status === 'ready' && gif && (
        <>
          <div className="motion-actions">
            <button className="booth-button booth-secondary" onClick={() => setPlayingUrl(playingUrl ? null : getUrl())}
              aria-label={`${playingUrl ? 'Stop' : 'Play'} motion for shot ${number}`}>
              {playingUrl ? 'Stop' : 'Play'}
            </button>
            <button className="booth-button booth-secondary" onClick={save}
              aria-label={`Save GIF for shot ${number}`}>Save GIF</button>
          </div>
          {playingUrl && <img src={playingUrl} alt={`Motion from shot ${number}`} />}
        </>
      )}
    </li>
  );
}

export default function MotionPhotos({ motions }) {
  if (!motions.some(Boolean)) return null;
  return (
    <section className="motion-photos" aria-labelledby="motion-photos-title">
      <h2 id="motion-photos-title">Motion photos</h2>
      <ul>
        {motions.map((motion, index) => motion && (
          <MotionPhoto key={motion.id} motion={motion} number={index + 1} />
        ))}
      </ul>
    </section>
  );
}
