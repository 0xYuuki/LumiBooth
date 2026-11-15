import { useCallback, useEffect, useReducer, useRef } from 'react';
import { PhotoboothContext } from './photoboothContext';
import { sessionReducer } from './photoboothSession';

const IDLE_TIMEOUT = 5 * 60 * 1000;

export function PhotoboothProvider({ children }) {
  const [session, dispatch] = useReducer(sessionReducer, null);
  const hasSession = session !== null;
  const motionWorker = useRef(null);
  const motionId = useRef(0);
  const galleryUrls = useRef(new Set());

  useEffect(() => {
    const retained = new Set([...(session?.photos ?? []), ...(session?.reviewItems ?? []).map((item) => item.photo)]);
    for (const url of galleryUrls.current) {
      if (!retained.has(url)) {
        URL.revokeObjectURL(url);
        galleryUrls.current.delete(url);
      }
    }
  }, [session]);

  const releaseGalleryUrls = useCallback(() => {
    for (const url of galleryUrls.current) URL.revokeObjectURL(url);
    galleryUrls.current.clear();
  }, []);

  const dispatchAction = useCallback((action) => {
    if (action.type === 'addGallery') {
      for (const image of action.images) galleryUrls.current.add(image.url);
    } else if (['start', 'remoteStart', 'reset'].includes(action.type)) {
      releaseGalleryUrls();
    }
    dispatch(action);
  }, [dispatch, releaseGalleryUrls]);

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
      timeout = setTimeout(() => { stopWorker(); dispatch({ type: 'discardMotion' }); }, IDLE_TIMEOUT);
    }

    const discard = () => {
      stopWorker();
      dispatch({ type: 'discardMotion' });
    };
    const releaseOnPageHide = () => {
      stopWorker();
      releaseGalleryUrls();
      dispatch({ type: 'reset' });
    };
    const discardWhenHidden = () => {
      if (document.hidden) discard();
    };

    restartTimeout();
    document.addEventListener('visibilitychange', discardWhenHidden);
    window.addEventListener('pagehide', releaseOnPageHide);
    window.addEventListener('pointerdown', restartTimeout);
    window.addEventListener('keydown', restartTimeout);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('pointerdown', restartTimeout);
      window.removeEventListener('keydown', restartTimeout);
      document.removeEventListener('visibilitychange', discardWhenHidden);
      window.removeEventListener('pagehide', releaseOnPageHide);
      stopWorker();
    };
  }, [dispatchAction, hasSession, releaseGalleryUrls]);

  return (
    <PhotoboothContext.Provider value={{ session, dispatch: dispatchAction, capturePhoto }}>
      {children}
    </PhotoboothContext.Provider>
  );
}
