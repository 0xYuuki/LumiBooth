import { useRef, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { BoothHeader } from '../../components/BoothUI';
import Webcam from 'react-webcam';
import { PhotoboothContext } from '../../context/photoboothContext';
import { useMotionCapture } from '../../motion/useMotionCapture';
import { motionSeconds } from '../../motion/motionBuffer';
import { cameraAspectRatio, drawCameraFrame } from './cameraFraming';

const WebCamera = () => {
  const webcamRef = useRef(null);
  const navigate = useNavigate();
  const { session, dispatch, capturePhoto } = useContext(PhotoboothContext);
  const { layout, photos } = session;
  const timeout = useRef(null);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [cameraKey, setCameraKey] = useState(0);
  const [motionOn, setMotionOn] = useState(false);
  const motionBuffer = useMotionCapture(webcamRef, motionOn && ready);

  useEffect(() => {
    const cancelCountdown = () => {
      clearTimeout(timeout.current);
      timeout.current = null;
      setCountdown(0);
    };
    const cancelWhenHidden = () => {
      if (document.hidden) cancelCountdown();
    };
    document.addEventListener('visibilitychange', cancelWhenHidden);
    window.addEventListener('pagehide', cancelCountdown);
    return () => {
      clearTimeout(timeout.current);
      document.removeEventListener('visibilitychange', cancelWhenHidden);
      window.removeEventListener('pagehide', cancelCountdown);
    };
  }, []);

  const capture = () => {
    const shutterTime = performance.now();
    const motion = motionOn ? motionBuffer.take(shutterTime) : null;
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context || !drawCameraFrame(webcamRef.current?.video, context, 960)) {
        setError('The camera has no frame yet. Wait for the live image, then try again.');
        return;
      }
      setError('');
      capturePhoto(canvas.toDataURL('image/jpeg', 0.92), motion);
    } catch {
      setError('Could not capture a photo. Try again.');
    }
  };

  const handleCaptureClick = () => {
    if (!ready || timeout.current !== null) return;
    const now = performance.now();
    const delay = Math.max(timer * 1000, motionOn ? motionBuffer.remaining(now) : 0);
    if (!delay) {
      capture();
      return;
    }
    const deadline = now + delay;
    const tick = () => {
      const remaining = deadline - performance.now();
      setCountdown(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) {
        timeout.current = null;
        capture();
        return;
      }
      timeout.current = setTimeout(tick, Math.max(16, remaining % 1000 || 1000));
    };
    tick();
  };

  const cancel = () => {
    dispatch({ type: 'reset' });
    navigate('/', { replace: true });
  };

  const retryCamera = () => {
    setError('');
    setReady(false);
    setCameraKey((key) => key + 1);
  };

  return (
    <div className="booth-shell">
      <BoothHeader step="02 / CAPTURE" onCancel={cancel} />
      <main className="booth-content capture-page">
        <p className="booth-eyebrow">STEP 02 OF 04</p>
        <h1 className="booth-title">Ready for your close-up?</h1>
        <p className="booth-intro" aria-live="polite">{photos.length} of {layout.count} photos captured</p>
        <div className="camera-view" style={{ aspectRatio: cameraAspectRatio }}>
          <Webcam
            key={cameraKey}
            onCanPlay={() => setReady(true)}
            onUserMediaError={(reason) => {
              clearTimeout(timeout.current);
              timeout.current = null;
              setCountdown(0);
              setReady(false);
              const message = reason?.name === 'NotAllowedError'
                ? 'Camera access was denied. Allow it in your browser settings, then retry.'
                : 'Camera unavailable. Check that it is connected and open the booth over HTTPS or localhost.';
              setError(message);
            }}
            audio={false}
            ref={webcamRef}
            videoConstraints={{ facingMode: "user" }}
            className="camera-video"
          />
          {countdown > 0 && (
            <div className="camera-countdown" aria-live="polite">{countdown}</div>
          )}
        </div>

        {error && (
          <div className="camera-status" role="status">
            {error} {!ready && <button className="booth-button booth-secondary" onClick={retryCamera}>Retry camera</button>}
          </div>
        )}

        <label className="motion-toggle">
          <input type="checkbox" checked={motionOn} disabled={!ready || countdown > 0}
            onChange={(event) => setMotionOn(event.target.checked)} />
          <span>Motion Photo <small>Waits as needed for {motionSeconds} seconds of motion before each shot</small></span>
        </label>
        <div className="capture-controls">
          <button className="booth-button booth-secondary" aria-label={timer ? `Timer: ${timer} seconds` : 'Timer off'}
            disabled={countdown > 0}
            onClick={() => setTimer({ 0: 3, 3: 5, 5: 10, 10: 0 }[timer])}>
            <Timer size={17} aria-hidden="true" /> {timer ? `${timer}s` : 'Timer'}
          </button>
          <button className="booth-button" onClick={handleCaptureClick} aria-label="Take photo"
            disabled={!ready || countdown > 0}>Take photo</button>
        </div>
      </main>
    </div>
  );
};

export default WebCamera;
