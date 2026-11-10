import { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PhotoboothContext } from '../../context/photoboothContext';
import { BoothHeader, MiniStrip } from '../../components/BoothUI';
import { printToPlayEnabled, remoteBoothEnabled } from '../../online/lumiClient';

export default function WebWelcome() {
  const { dispatch } = useContext(PhotoboothContext);
  useEffect(() => { dispatch({ type: 'reset' }); }, [dispatch]);

  return (
    <div className="booth-shell">
      <BoothHeader step="THE PHOTO BOOTH" />
      <main className="booth-hero">
        <div className="hero-copy">
          <p className="booth-eyebrow">THE DIGITAL PHOTO BOOTH</p>
          <h1>Make a little<br /> <em>keepsake.</em></h1>
          <p>Pick a layout, take your photos, and give your strip a frame of its own.</p>
          <Link className="booth-button" to="/layout">
            Start photo booth <ArrowRight size={18} aria-hidden="true" />
          </Link>
          {remoteBoothEnabled && <Link className="booth-button booth-secondary" to="/room">Booth with a friend</Link>}
          {printToPlayEnabled && <Link className="booth-link" to="/print-links">Manage gallery links</Link>}
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
