import { useEffect, useReducer } from 'react';
import { PhotoboothContext } from './photoboothContext';
import { sessionReducer } from './photoboothSession';

const IDLE_TIMEOUT = 5 * 60 * 1000;

export function PhotoboothProvider({ children }) {
  const [session, dispatch] = useReducer(sessionReducer, null);
  const hasSession = session !== null;

  useEffect(() => {
    if (!hasSession) return;

    let timeout;
    function restartTimeout() {
      clearTimeout(timeout);
      timeout = setTimeout(() => dispatch({ type: 'reset' }), IDLE_TIMEOUT);
    }

    restartTimeout();
    window.addEventListener('pointerdown', restartTimeout);
    window.addEventListener('keydown', restartTimeout);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('pointerdown', restartTimeout);
      window.removeEventListener('keydown', restartTimeout);
    };
  }, [hasSession]);

  return (
    <PhotoboothContext.Provider value={{ session, dispatch }}>
      {children}
    </PhotoboothContext.Provider>
  );
}
