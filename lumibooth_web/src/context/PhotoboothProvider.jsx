import { useEffect, useReducer, useRef } from 'react';
import { PhotoboothContext } from './photoboothContext';
import { sessionReducer } from './photoboothSession';

const IDLE_TIMEOUT = 5 * 60 * 1000;

export function PhotoboothProvider({ children }) {
  const [session, dispatch] = useReducer(sessionReducer, null);
  const hasSession = session !== null;
  const motionWorker = useRef(null);
  const motionId = useRef(0);

  const stopWorker = () => {
    motionWorker.current?.terminate();
    motionWorker.current = null;
  };

  const capturePhoto = (photo, clip) => {
    const id = ++motionId.current;
    const pending = clip?.frames.length >= 2;
    const motion = clip ? { id, status: pending ? 'pending' : 'unavailable', gif: null } : null;
    dispatch({ type: 'capture', photo, motion });
    if (!pending) return;
    try {
      if (!motionWorker.current) {
        const worker = new Worker(new URL('../motion/motionEncoder.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => {
          if (motionWorker.current === worker) dispatch({ type: 'motionResult', ...data });
        };
        worker.onerror = () => {
          if (motionWorker.current !== worker) return;
          stopWorker();
          dispatch({ type: 'discardMotion', pendingOnly: true });
        };
        motionWorker.current = worker;
      }
      motionWorker.current.postMessage({ id, clip }, clip.frames.map(({ data }) => data));
    } catch {
      dispatch({ type: 'motionResult', id, gif: null });
    }
  };

  useEffect(() => {
    if (!hasSession) return;

    let timeout;
    function restartTimeout() {
      clearTimeout(timeout);
      timeout = setTimeout(() => dispatch({ type: 'reset' }), IDLE_TIMEOUT);
    }

    const discard = () => {
      stopWorker();
      dispatch({ type: 'discardMotion' });
    };
    const discardWhenHidden = () => {
      if (document.hidden) discard();
    };

    restartTimeout();
    document.addEventListener('visibilitychange', discardWhenHidden);
    window.addEventListener('pagehide', discard);
    window.addEventListener('pointerdown', restartTimeout);
    window.addEventListener('keydown', restartTimeout);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('pointerdown', restartTimeout);
      window.removeEventListener('keydown', restartTimeout);
      document.removeEventListener('visibilitychange', discardWhenHidden);
      window.removeEventListener('pagehide', discard);
      stopWorker();
    };
  }, [hasSession]);

  return (
    <PhotoboothContext.Provider value={{ session, dispatch, capturePhoto }}>
      {children}
    </PhotoboothContext.Provider>
  );
}
