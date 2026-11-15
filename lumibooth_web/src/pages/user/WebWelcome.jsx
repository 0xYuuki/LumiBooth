import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PhotoboothContext } from '../../context/photoboothContext';
import { BoothHeader, MiniStrip } from '../../components/BoothUI';
import { printToPlayEnabled, remoteBoothEnabled } from '../../online/lumiClient';
import { prepareGalleryFiles, releaseGalleryFiles } from './galleryImport';

export default function WebWelcome() {
  const navigate = useNavigate();
  const { dispatch } = useContext(PhotoboothContext);
  const picker = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  useEffect(() => { dispatch({ type: 'reset' }); }, [dispatch]);

  const chooseGallery = async (event) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length) return;
    setImporting(true);
    setImportMessage('');
    const result = await prepareGalleryFiles(files);
    setImporting(false);
    if (!result.images.length) {
      setImportMessage(result.message ?? 'No supported photos could be opened. Choose JPEG, PNG, or WebP images.');
      return;
    }
    const message = result.skipped
      ? `${result.skipped} photo${result.skipped === 1 ? '' : 's'} could not be opened or exceeded the size limit.`
      : '';
    try {
      navigate('/gallery', { state: { images: result.images, message } });
    } catch {
      releaseGalleryFiles(result.images);
      setImportMessage('Could not open the photo selection. Try again.');
    }
  };

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
          <button className="booth-button booth-secondary" type="button" onClick={() => picker.current?.click()} disabled={importing}>
            {importing ? 'Preparing photos…' : 'Choose from Gallery'}
          </button>
          <input ref={picker} className="gallery-file-input" type="file" accept="image/*" multiple onChange={chooseGallery} aria-label="Choose photos from your device" />
          {importMessage && <p className="gallery-message" role="status">{importMessage}</p>}
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
