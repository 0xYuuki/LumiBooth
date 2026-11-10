import { useContext, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { PhotoboothContext } from '../../context/photoboothContext';
import { BoothHeader } from '../../components/BoothUI';
import MotionPhotos from '../../motion/MotionPhotos';
import MotionStrip from '../../motion/MotionStrip';
import { exportMotionStrip } from '../../motion/exportMotionStrip';
import { PhotoStrip } from './PhotoStrip';
import PrintToPlay from '../../online/PrintToPlay';
import { lumiRequest, printToPlayEnabled, uploadMedia } from '../../online/lumiClient';
import { downloadBlob } from '../../online/download';

export default function WebPreview() {
  const navigate = useNavigate();
  const { session, dispatch } = useContext(PhotoboothContext);
  const [imageSize, setImageSize] = useState(null);
  const [playback, setPlayback] = useState(null);
  const [exportingMotion, setExportingMotion] = useState(false);
  const [error, setError] = useState('');
  const [printLink, setPrintLink] = useState(null);
  const [sending, setSending] = useState(false);
  const strip = useRef(null);
  const qrImage = useRef(null);
  const animation = useRef(null);
  const hasMotion = session.motions.some((motion) => motion?.gif);
  const motionPending = session.motions.some((motion) => motion?.status === 'pending');
  const motionUrls = playback?.map((shot, index) =>
    shot?.id === session.motions[index]?.id && session.motions[index]?.gif ? shot.url : undefined);
  const playing = !!motionUrls?.some(Boolean);

  useEffect(() => {
    const clear = () => {
      animation.current?.controller.abort();
      animation.current = null;
    };
    const hide = () => { if (document.hidden) clear(); };
    const afterPrint = () => setPrintLink(null);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', clear);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', clear);
      window.removeEventListener('afterprint', afterPrint);
      clear();
    };
  }, []);

  const getGif = async () => {
    if (document.hidden || !strip.current) throw new Error('Motion is no longer available.');
    if (animation.current) return animation.current.promise;
    const controller = new AbortController();
    setExportingMotion(true);
    const promise = exportMotionStrip(strip.current, session, controller.signal).catch((reason) => {
      if (animation.current?.controller === controller) animation.current = null;
      throw reason;
    }).finally(() => { setExportingMotion(false); });
    animation.current = { controller, promise };
    return promise;
  };

  const saveAnimation = async () => {
    setError('');
    try {
      const gif = await getGif();
      if (animation.current && !document.hidden) downloadBlob(gif, 'lumibooth-motion-strip.gif');
    } catch (reason) {
      if (reason.name !== 'AbortError') setError(reason.message || 'Could not save the animated strip.');
    }
  };

  const print = async (link = null) => {
    if (!imageSize) return;
    flushSync(() => setPrintLink(link));
    await qrImage.current?.decode();
    window.print();
  };

  const sendToFriend = async () => {
    setSending(true);
    setError('');
    try {
      const id = session.roomId;
      const ticket = await lumiRequest('room_prepare_final', { id });
      if (!ticket.complete) {
        await uploadMedia(ticket, await (await fetch(session.output)).blob());
        await lumiRequest('room_finish', { id, attempt: ticket.asset });
      }
      navigate('/room', { replace: true });
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSending(false);
    }
  };

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
            <button className="booth-button booth-secondary" disabled={!imageSize} onClick={() => print()}>
              <Printer size={17} aria-hidden="true" /> Print Photo
            </button>
          </div>
          <div className="preview-actions">
            {hasMotion && <button className="booth-button booth-secondary" disabled={!imageSize || motionPending}
              onClick={toggleMotion}>{playing ? 'Stop strip' : 'Play strip'}</button>}
            {hasMotion && <button className="booth-button booth-secondary" disabled={!imageSize || motionPending || exportingMotion}
              onClick={saveAnimation}>{exportingMotion ? 'Preparing animation…' : 'Save animated strip'}</button>}
            <button className="booth-link" disabled={sending} onClick={() => navigate('/editor', { replace: true })}>Edit Strip</button>
            <button className="booth-link" onClick={finish}>Finish Session</button>
          </div>
          {printToPlayEnabled && !session.roomId && <PrintToPlay output={session.output} photos={session.photos}
            getGif={hasMotion ? getGif : undefined}
            onPrint={print} disabled={!imageSize || motionPending || exportingMotion} />}
          {session.roomId && <button className="booth-button" disabled={sending} onClick={sendToFriend}>
            {sending ? 'Sending…' : 'Send strip to friend'}
          </button>}
          {error && <p role="alert">{error}</p>}
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
          {printLink && <div className="print-play-qr">
            <img ref={qrImage} src={printLink.qr} alt="Photo gallery QR code" />
            <strong>Scan for photos</strong>
            <small>Until {new Date(printLink.expiresAt).toLocaleDateString()}</small>
          </div>}
        </div>
        {hasMotion && imageSize && <div className="motion-export-layer" aria-hidden="true"
          style={{ width: imageSize.width / 3 }}><PhotoStrip session={session} stripRef={strip} /></div>}
        <MotionPhotos motions={session.motions} />
      </main>
    </div>
  );
}
