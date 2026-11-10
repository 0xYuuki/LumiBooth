import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { PhotoboothContext } from '../../context/photoboothContext';
import { BoothHeader } from '../../components/BoothUI';
import MotionPhotos from '../../motion/MotionPhotos';
import MotionStrip from '../../motion/MotionStrip';

export default function WebPreview() {
  const navigate = useNavigate();
  const { session, dispatch } = useContext(PhotoboothContext);
  const [imageSize, setImageSize] = useState(null);
  const [playback, setPlayback] = useState(null);
  const hasMotion = session.motions.some((motion) => motion?.gif);
  const motionPending = session.motions.some((motion) => motion?.status === 'pending');
  const motionUrls = playback?.map((shot, index) =>
    shot?.id === session.motions[index]?.id && session.motions[index]?.gif ? shot.url : undefined);
  const playing = !!motionUrls?.some(Boolean);

  useEffect(() => {
    if (!playback) return;
    const release = () => playback.forEach((shot) => {
      if (shot) URL.revokeObjectURL(shot.url);
    });
    const stop = () => {
      release();
      setPlayback(null);
    };
    const stopWhenHidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', stopWhenHidden);
      window.removeEventListener('pagehide', stop);
      release();
    };
  }, [playback]);

  const toggleMotion = () => {
    setPlayback(playing ? null : session.motions.map((motion) => motion?.gif
      ? { id: motion.id, url: URL.createObjectURL(motion.gif) }
      : null));
  };

  const finish = () => {
    dispatch({ type: 'reset' });
    navigate('/', { replace: true });
  };

  return (
    <div className="booth-shell">
      <BoothHeader step="04 / FINISH" />
      <main className="booth-content strip-preview">
        <div className="preview-copy">
          <p className="booth-eyebrow">STEP 04 OF 04</p>
          <h1 className="booth-title">Your strip is ready.</h1>
          <p className="booth-intro">Save a copy or print it to keep.</p>
          <div className="preview-actions">
            <a className="booth-button" href={session.output} download="lumibooth-strip.png">
              <Download size={17} aria-hidden="true" /> Save to Device
            </a>
            <button className="booth-button booth-secondary" disabled={!imageSize} onClick={() => window.print()}>
              <Printer size={17} aria-hidden="true" /> Print Photo
            </button>
          </div>
          <div className="preview-actions">
            {hasMotion && <button className="booth-button booth-secondary" disabled={!imageSize || motionPending}
              onClick={toggleMotion}>{playing ? 'Stop strip' : 'Play strip'}</button>}
            <button className="booth-link" onClick={() => navigate('/editor', { replace: true })}>Edit Strip</button>
            <button className="booth-link" onClick={finish}>Finish Session</button>
          </div>
        </div>
        <div className="preview-stage">
          <div className="preview-media" style={imageSize ? {
            width: `min(100%, ${imageSize.width}px, ${70 * imageSize.width / imageSize.height}vh)`,
          } : undefined}>
            <img className="finished-strip" src={session.output} alt="Your finished LumiBooth photo strip"
              onLoad={(event) => setImageSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })} />
            {playing && <MotionStrip session={session} imageSize={imageSize}
              motionUrls={motionUrls} />}
          </div>
        </div>
        <MotionPhotos motions={session.motions} />
      </main>
    </div>
  );
}
