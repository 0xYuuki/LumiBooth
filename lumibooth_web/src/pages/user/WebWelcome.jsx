import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { layouts } from '../../context/photoboothSession';
import { PhotoboothContext } from '../../context/photoboothContext';
import { BoothHeader, MiniStrip } from '../../components/BoothUI';
import { accountsEnabled, printToPlayEnabled, remoteBoothEnabled } from '../../online/lumiClient';

export default function WebWelcome() {
  const navigate = useNavigate();
  const { session, dispatch, draftError } = useContext(PhotoboothContext);
  const start = () => {
    if (session && !window.confirm('Start fresh? This will clear your current strip.')) return;
    dispatch({ type: 'start', layout: layouts[2] });
    navigate('/gallery');
  };

  return (
    <div className="booth-shell">
      <BoothHeader step="THE PHOTO BOOTH" />
      <main className="booth-hero">
        <div className="hero-copy">
          <p className="booth-eyebrow">THE DIGITAL PHOTO BOOTH</p>
          <h1>Make a little<br /> <em>keepsake.</em></h1>
          <p>A few photos. A little personality. A keepsake that’s yours.</p>
          {session ? <>
            <Link className="booth-button" to={session.roomId ? '/editor' : '/gallery'}>Continue your strip <ArrowRight size={18} aria-hidden="true" /></Link>
            <button className="booth-link" onClick={start}>Start fresh</button>
          </> : <button className="booth-button" onClick={start}>Create photo strip <ArrowRight size={18} aria-hidden="true" /></button>}
          {draftError && <p role="status">{draftError}</p>}
          {session && !draftError && <p className="booth-intro">Your draft stays on this device. Motion clips are kept only while the booth is open.</p>}
          {remoteBoothEnabled && <Link className="booth-button booth-secondary" to="/room">Booth with a friend</Link>}
          {printToPlayEnabled && <Link className="booth-link" to="/print-links">Manage gallery links</Link>}
          {accountsEnabled && <Link className="booth-link" to="/account">Account</Link>}
        </div>
        <div className="hero-art" aria-hidden="true">
          <MiniStrip count={3} columns={1} />
          <MiniStrip count={4} columns={2} />
          <span>✳</span>
        </div>
      </main>
      <footer className="booth-footer">LUMIBOOTH STUDIO <span>CAPTURE · FRAME · KEEP</span></footer>
    </div>
  );
}
