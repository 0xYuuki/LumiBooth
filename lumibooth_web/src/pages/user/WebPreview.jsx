import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import { PhotoboothContext } from '../../context/photoboothContext';
import { BoothHeader } from '../../components/BoothUI';

export default function WebPreview() {
  const navigate = useNavigate();
  const { session, dispatch } = useContext(PhotoboothContext);
  const [imageReady, setImageReady] = useState(false);

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
            <button className="booth-button booth-secondary" disabled={!imageReady} onClick={() => window.print()}>
              <Printer size={17} aria-hidden="true" /> Print Photo
            </button>
          </div>
          <div className="preview-actions">
            <button className="booth-link" onClick={() => navigate('/editor', { replace: true })}>Edit Strip</button>
            <button className="booth-link" onClick={finish}>Finish Session</button>
          </div>
        </div>
        <div className="preview-stage">
          <img className="finished-strip" src={session.output} alt="Your finished LumiBooth photo strip"
            onLoad={() => setImageReady(true)} />
        </div>
      </main>
    </div>
  );
}
