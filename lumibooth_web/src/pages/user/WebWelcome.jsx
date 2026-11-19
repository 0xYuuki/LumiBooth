import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, FolderHeart, ImagePlus, Sparkles, Download, Check } from 'lucide-react';
import { layouts } from '../../context/photoboothSession';
import { PhotoboothContext } from '../../context/photoboothContext';
import { BoothHeader } from '../../components/BoothUI';
import { accountsEnabled, commerceEnabled, printToPlayEnabled, remoteBoothEnabled } from '../../online/lumiClient';

export default function WebWelcome() {
  const navigate = useNavigate();
  const { session, dispatch, draftError } = useContext(PhotoboothContext);
  const start = () => {
    if (session && !window.confirm('Start fresh? This will clear your current strip.')) return;
    dispatch({ type: 'start', layout: layouts[2] });
    navigate('/gallery');
  };

  return (
    <div className="booth-shell studio-home">
      <BoothHeader step="YOUR EVERYDAY PHOTO STUDIO">
        <Link className="booth-link" to="/works">Your works</Link>
        <Link className="booth-link" to="/uploads">My Uploads</Link>
        {commerceEnabled && <Link className="booth-link" to="/print-orders">Print orders</Link>}
        {accountsEnabled && <Link className="booth-link" to="/account">Account</Link>}
      </BoothHeader>
      <main className="booth-hero">
        <div className="hero-copy">
          <p className="booth-eyebrow">A LITTLE MOMENT. ALL YOURS.</p>
          <h1>Make a little<br /> <em>keepsake.</em></h1>
          <p>Turn your favorite moments into a photo strip. Snap something new, add your own photos, and make it feel like you.</p>
          <div className="studio-create-actions">
          {session ? <>
            <Link className="booth-button" to={session.roomId ? '/editor' : '/gallery'}>Continue your strip <ArrowRight size={18} aria-hidden="true" /></Link>
            <button className="booth-link" onClick={start}>Start fresh</button>
          </> : <button className="booth-button" onClick={start}>Create photo strip <ArrowRight size={18} aria-hidden="true" /></button>}
          </div>
          <p className="studio-reassurance"><Check size={15} aria-hidden="true" /> Create without an account · Save to your device</p>
          {draftError && <p role="status">{draftError}</p>}
          {session && !draftError && <p className="booth-intro">Your draft stays on this device. Motion clips are kept only while the booth is open.</p>}
          {remoteBoothEnabled && <Link className="booth-button booth-secondary" to="/room">Booth with a friend</Link>}
          {printToPlayEnabled && <Link className="booth-link" to="/print-links">Manage gallery links</Link>}
        </div>
        <div className="studio-art" aria-label="Illustrated examples of photo strips">
          <span className="studio-art-note">a little joy, on repeat</span>
          <div className="studio-sample studio-sample-back">
            {['bloom', 'daylight', 'bloom'].map((scene, index) => <img key={index} src={`${import.meta.env.BASE_URL}studio/${scene}.svg`} alt="" />)}
            <span>the little things ♡</span>
          </div>
          <div className="studio-sample studio-sample-front">
            {['daylight', 'bloom', 'daylight'].map((scene, index) => <img key={index} src={`${import.meta.env.BASE_URL}studio/${scene}.svg`} alt="" />)}
            <span>made of good days</span>
          </div>
          <span className="studio-art-badge"><Sparkles size={16} aria-hidden="true" /> Your photos. Your personality.</span>
          <span className="studio-sample-label">ILLUSTRATED STRIP EXAMPLES</span>
        </div>
      </main>
      <section className="studio-guide" aria-label="How it works">
        {[{ Icon: Camera, title: 'Bring your moments', copy: 'Use your camera or pick favorites from your gallery.' },
          { Icon: Sparkles, title: 'Make it feel like you', copy: 'Find your frame. Add stickers and a little message.' },
          { Icon: Download, title: 'Keep the good stuff', copy: 'Download your strip or save it in Your works.' }].map(({ Icon, title, copy }, index) =>
          <article key={title}><span className="studio-guide-icon"><Icon size={22} aria-hidden="true" /></span><div><span className="studio-guide-number">0{index + 1}</span><h2>{title}</h2><p>{copy}</p></div></article>)}
      </section>
      <section className="studio-library" aria-label="Your creative space">
        <div><p className="booth-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Your little creative corner.</h2></div>
        <Link to="/works" aria-label="Browse your saved works"><FolderHeart size={24} aria-hidden="true" /><span><strong>Your works</strong><small>Revisit the strips you saved</small></span><ArrowRight size={18} aria-hidden="true" /></Link>
        <Link to="/uploads" aria-label="Browse your uploaded assets"><ImagePlus size={24} aria-hidden="true" /><span><strong>My Uploads</strong><small>Your stickers and backgrounds</small></span><ArrowRight size={18} aria-hidden="true" /></Link>
      </section>
      <footer className="booth-footer">LUMIBOOTH STUDIO <Link className="booth-link" to="/legal">Privacy information</Link></footer>
    </div>
  );
}
