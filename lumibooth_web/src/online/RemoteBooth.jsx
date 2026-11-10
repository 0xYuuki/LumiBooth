import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { BoothHeader } from '../components/BoothUI';
import { PhotoboothContext } from '../context/photoboothContext';
import { remoteLayout, requiredPhotos } from '../context/photoboothSession';
import { cameraAspectRatio, drawCameraFrame } from '../pages/user/cameraFraming';
import { frameLibrary } from '../pages/user/frameLibrary';
import { downloadBlob } from './download';
import { lumiRequest, publicLink, subscribeRoom, uploadMedia } from './lumiClient';

const roomKey = 'lumibooth-active-room';
const requestReady = (ready) => ready && !document.hidden;

function resumeRoom() {
  try { return JSON.parse(sessionStorage.getItem(roomKey)); } catch { return null; }
}

async function downloadPhoto(url) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Could not load the photos. Try again.');
  return response.blob();
}

function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function RemoteBooth() {
  const invite = useLocation().hash.slice(1);
  const navigate = useNavigate();
  const { dispatch } = useContext(PhotoboothContext);
  const [membership, setMembership] = useState(() => invite ? null : resumeRoom());
  const id = membership?.id;
  const [room, setRoom] = useState(null);
  const [ready, setReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [canRetryUpload, setCanRetryUpload] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const webcam = useRef(null);
  const state = useRef({ ready: false, room: null, shot: null, captured: null, network: 0 });
  const sync = useRef(null);

  const submitShot = useCallback(async (shot) => {
    setUploading(true);
    setCanRetryUpload(false);
    try {
      const ticket = await lumiRequest('room_upload', { id, attempt: shot.attempt });
      await uploadMedia(ticket, shot.photo);
      await lumiRequest('room_shot', { id, attempt: shot.attempt });
      if (state.current.shot === shot) state.current.shot = null;
      sync.current?.();
    } catch (reason) {
      if (state.current.shot === shot) {
        setError(reason.message);
        setCanRetryUpload(true);
      }
    } finally {
      setUploading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const local = state.current;
    let disposed = false;
    let inFlight = false;
    let deadline = 0;
    let bestRtt = Infinity;
    let timer;
    let display;

    const cancelTimer = () => {
      clearTimeout(timer);
      clearInterval(display);
      timer = undefined;
      display = undefined;
      bestRtt = Infinity;
    };

    const apply = (next, started, now) => {
      if (local.room && next.revision < local.room.revision) return;
      if (next.round !== local.room?.round || (local.room?.attempt && !next.attempt)) {
        local.ready = false;
        setReady(false);
      }
      if (next.attempt !== local.room?.attempt) {
        cancelTimer();
        local.shot = null;
        setCanRetryUpload(false);
        setCountdown(0);
      }
      local.room = next;
      local.network = now;
      setRoom(next);
      const rtt = now - started;
      if (!next.attempt || next.submitted || local.captured === next.attempt || !requestReady(local.ready) || rtt >= bestRtt) return;
      const delay = next.shutterAt - next.serverNow - rtt / 2;
      if (delay < -150 || rtt > 1000) return;
      cancelTimer();
      bestRtt = rtt;
      deadline = now + delay;
      const tick = () => setCountdown(Math.max(0, Math.ceil((deadline - performance.now()) / 1000)));
      tick();
      display = setInterval(tick, 100);
      timer = setTimeout(() => {
        cancelTimer();
        setCountdown(0);
        if (disposed || !requestReady(local.ready) || performance.now() - local.network > 4000 ||
          performance.now() - deadline > 250 || local.room?.attempt !== next.attempt) return;
        local.captured = next.attempt;
        const canvas = document.createElement('canvas');
        try {
          if (!drawCameraFrame(webcam.current?.video, canvas.getContext('2d'), 960)) throw new Error('Camera frame unavailable.');
          canvas.toBlob((photo) => {
            if (disposed || document.hidden || local.room?.attempt !== next.attempt) return;
            if (!photo) { setError('Could not capture this round. Retry the round.'); return; }
            const shot = { photo, attempt: next.attempt };
            local.shot = shot;
            void submitShot(shot);
          }, 'image/jpeg', 0.9);
        } catch {
          setError('Could not capture this round. Retry the round.');
        }
      }, Math.max(0, delay));
    };

    const refresh = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      const started = performance.now();
      try {
        const next = await lumiRequest('room_sync', { id, ready: requestReady(local.ready), round: local.room?.round });
        if (!disposed) apply(next, started, performance.now());
      } catch (reason) {
        if (!disposed) {
          cancelTimer();
          setCountdown(0);
          setError(reason.message);
        }
      } finally {
        inFlight = false;
      }
    };
    sync.current = refresh;
    const stop = () => {
      local.ready = false;
      local.shot = null;
      cancelTimer();
      setReady(false);
      setCanRetryUpload(false);
      setCountdown(0);
      void lumiRequest('room_sync', { id, ready: false, round: local.room?.round }).catch(() => {});
    };
    const onVisibility = () => { if (document.hidden) stop(); else void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', stop);
    let unsubscribe;
    let interval;
    void refresh().then(() => {
      if (disposed) return;
      unsubscribe = subscribeRoom(id, refresh);
      interval = setInterval(refresh, 1500);
    });
    return () => {
      disposed = true;
      cancelTimer();
      clearInterval(interval);
      unsubscribe?.();
      if (local.ready) void lumiRequest('room_sync', { id, ready: false, round: local.room?.round }).catch(() => {});
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', stop);
      sync.current = null;
    };
  }, [id, submitShot]);

  useEffect(() => {
    if (!finished) return;
    const url = URL.createObjectURL(finished);
    // Keep the final image available after the signed URL expires.
    const timer = setTimeout(() => setImageUrl(url), 0);
    return () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    };
  }, [finished]);

  const run = async (work) => {
    setBusy(true);
    setError('');
    try { await work(); } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };

  const join = () => run(async () => {
    const member = await lumiRequest(invite ? 'room_join' : 'room_begin', invite ? { token: invite } : {});
    sessionStorage.setItem(roomKey, JSON.stringify(member));
    setMembership(member);
    if (invite) navigate('/room', { replace: true });
  });

  const leave = (cancel = false) => run(async () => {
    if (cancel) await lumiRequest('room_cancel', { id });
    sessionStorage.removeItem(roomKey);
    navigate('/');
  });

  const command = (name, data = {}) => run(async () => {
    await lumiRequest(name, { id, ...data });
    if (name === 'room_retry') {
      state.current.ready = false;
      setReady(false);
    }
    sync.current?.();
  });

  const design = () => run(async () => {
    const { photos } = await lumiRequest('room_sync', { id, assets: true });
    if (!Array.isArray(photos) || photos.length !== requiredPhotos(remoteLayout)) {
      throw new Error('Could not load all three pairs. Try again.');
    }
    const stills = await Promise.all(photos.map(async (url) => dataUrl(await downloadPhoto(url))));
    dispatch({ type: 'remoteStart', photos: stills, roomId: id, frame: frameLibrary.Illustrated[0] });
    navigate('/editor');
  });

  const openFinal = () => run(async () => {
    const { poster } = await lumiRequest('room_sync', { id, assets: true });
    setFinished(await downloadPhoto(poster));
  });

  const invitation = membership?.invite && publicLink('room', membership.invite);
  return <div className="booth-shell">
    <BoothHeader step="BOOTH WITH A FRIEND" />
    <main className="booth-content remote-booth">
      <h1 className="booth-title">Booth with a friend</h1>
      {error && <p role="alert">{error}</p>}
      {!id && <>
        <p>Share three stills with the other guest. Both guests can save the finished strip. The room expires in one hour.</p>
        <div><button className="booth-button" disabled={busy} onClick={join}>{invite ? 'Agree and join' : 'Agree and create room'}</button></div>
      </>}
      {room?.state === 'waiting' && invitation && <>
        <p>Send this one-use link to your friend.</p>
        <input className="room-invite" aria-label="Invite link" readOnly value={invitation} onFocus={(event) => event.target.select()} />
        <div><button className="booth-button" onClick={() => run(() => navigator.clipboard.writeText(invitation))}>Copy invite link</button></div>
        <p role="status">Waiting for your friend…</p>
      </>}
      {room?.state === 'capture' && <>
        <p aria-live="polite">Round {room.round} of 3 · {room.hostReady && room.guestReady ? 'Both ready' : 'Waiting for both guests to be ready'}</p>
        <div className="camera-view" style={{ aspectRatio: cameraAspectRatio }}>
          <Webcam ref={webcam} audio={false} className="camera-video" videoConstraints={{ facingMode: 'user' }}
            onCanPlay={() => setCameraReady(true)}
            onUserMediaError={() => { setCameraReady(false); setError('Allow camera access and rejoin the room.'); }} />
          {countdown > 0 && <div className="camera-countdown" aria-live="polite">{countdown}</div>}
        </div>
        <div className="preview-actions">
          <button className="booth-button" disabled={!cameraReady || busy || Boolean(room.attempt)} onClick={() => {
            state.current.ready = !ready;
            setReady(!ready);
            setError('');
            sync.current?.();
          }}>{ready ? 'Not ready' : 'I’m ready'}</button>
          {room.role === 'host' && <button className="booth-button" disabled={busy || !ready || !room.hostReady || !room.guestReady || Boolean(room.attempt)}
            onClick={() => command('room_start')}>Start countdown</button>}
          {room.attempt && countdown === 0 && <button className="booth-button booth-secondary" disabled={busy || uploading}
            onClick={() => command('room_retry', { attempt: room.attempt })}>Retry round</button>}
          {canRetryUpload && <button className="booth-button booth-secondary" disabled={uploading}
            onClick={() => state.current.shot && submitShot(state.current.shot)}>Retry upload</button>}
        </div>
        {room.submitted && <p role="status">Photo received. Waiting for your friend.</p>}
      </>}
      {room?.state === 'design' && (room.role === 'host'
        ? <div><button className="booth-button" disabled={busy} onClick={design}>Design your shared strip</button></div>
        : <p role="status">Your friend is designing the strip.</p>)}
      {room?.state === 'complete' && (finished ? <>
        <img className="finished-strip" src={imageUrl || undefined} alt="Your finished shared strip" />
        <div className="preview-actions">
          <button className="booth-button" onClick={() => downloadBlob(finished, 'lumibooth-friends.png')}>Save shared strip</button>
          <button className="booth-button booth-secondary" onClick={() => window.print()}>Print shared strip</button>
        </div>
      </> : <div><button className="booth-button" disabled={busy} onClick={openFinal}>Open your shared strip</button></div>)}
      {id && <div className="preview-actions">
        <button className="booth-link" onClick={() => leave()}>Leave room</button>
        {room && room.state !== 'complete' && <button className="booth-link" disabled={busy} onClick={() => leave(true)}>Cancel for both</button>}
      </div>}
    </main>
  </div>;
}
