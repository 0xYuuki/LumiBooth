import { useRef, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { BoothHeader } from '../../components/BoothUI';
import Webcam from 'react-webcam';
import { PhotoboothContext } from '../../context/photoboothContext';

const WebCamera = () => {
  const webcamRef = useRef(null);
  const navigate = useNavigate();
  const { session, dispatch } = useContext(PhotoboothContext);
  const { layout, photos } = session;
  const timeout = useRef(null);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [cameraKey, setCameraKey] = useState(0);

  useEffect(() => () => clearTimeout(timeout.current), []);

  const capture = () => {
    try {
      const photo = webcamRef.current?.getScreenshot();
      if (!photo) {
        setError('The camera has no frame yet. Wait for the live image, then try again.');
        return;
      }
      setError('');
      dispatch({ type: 'capture', photo });
    } catch {
      setError('Could not capture a photo. Try again.');
    }
  };

  const handleCaptureClick = () => {
    if (!ready || timeout.current !== null) return;
    if (!timer) {
      capture();
      return;
    }
    const deadline = performance.now() + timer * 1000;
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
        <div className="camera-view">
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
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user" }}
            className="camera-video"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
