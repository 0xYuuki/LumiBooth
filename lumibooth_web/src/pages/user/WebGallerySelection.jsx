import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PhotoStrip } from './PhotoStrip';
import { Camera, ImagePlus, ArrowRight } from 'lucide-react';
import { BoothHeader, BoothStep, MiniStrip } from '../../components/BoothUI';
import { PhotoboothContext } from '../../context/photoboothContext';
import { layouts, requiredPhotos, reviewItems } from '../../context/photoboothSession';
import { prepareGalleryFiles, releaseGalleryFiles } from './galleryImport';

const MAX_PHOTOS = 12;

export default function WebGallerySelection() {
  const navigate = useNavigate();
  const { session, dispatch } = useContext(PhotoboothContext);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const images = reviewItems(session);
  const required = requiredPhotos(session.layout);
  const exactCount = session.photos.length === required;

  const onFilesSelected = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    if (images.length + files.length > MAX_PHOTOS) {
      setMessage('Choose up to 12 photos. Remove a photo before adding more.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await prepareGalleryFiles(files);
      if (!mounted.current) {
        releaseGalleryFiles(result.images);
        return;
      }
      if (result.images.length) dispatch({ type: 'addGallery', images: result.images });
      if (!result.images.length) setMessage(result.message ?? 'No supported photos could be opened. Choose JPEG, PNG, or WebP images.');
      else if (result.skipped) setMessage(`${result.skipped} photos could not be opened or exceeded the size limit.`);
    } catch {
      if (mounted.current) setMessage('Could not open those photos. Please try again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="booth-shell">
      <BoothHeader step="01 / PHOTOS" />
      <main className="booth-content gallery-import-page">
        <BoothStep number={1} back="/" backLabel="Back to home" disabled={busy} />
        <h1 className="booth-title">Your strip starts here.</h1>
        <p className="booth-intro">Take a photo or bring your favorites. Choose a layout, then put everything in order.</p>
        <div className="workspace-sources">
          <Link className="booth-button booth-secondary" to="/camera"><Camera size={18} aria-hidden="true" /> Take photos</Link>
          <button className="booth-button" onClick={() => inputRef.current?.click()} disabled={busy || images.length >= MAX_PHOTOS}>
            <ImagePlus size={18} aria-hidden="true" /> {busy ? 'Preparing photos…' : 'Add from gallery'}
          </button>
        </div>
        <section className="workspace-layouts" aria-label="Strip layout">
          <div className="workspace-section-title"><h2>Layout</h2><span>Choose your fit</span></div>
          <div className="workspace-layout-options">
            {layouts.map((layout) => <button key={layout.id} className="workspace-layout-option" aria-label={`${layout.name}, ${layout.count} photos`} aria-pressed={session.layout.id === layout.id}
              disabled={busy} onClick={() => dispatch({ type: 'changeLayout', layout })}>
              <MiniStrip count={layout.count} columns={layout.columns} />
              <span>{layout.count} {layout.count === 1 ? 'photo' : 'photos'}</span>
            </button>)}
          </div>
          {session.photos.length > 0 && <div className="workspace-strip-preview">
            <div><strong>Your strip</strong><p>{session.photos.length} of {required} photos selected</p></div>
            <div className="workspace-strip-miniature"><PhotoStrip session={session} /></div>
          </div>}
        </section>
        <p className="gallery-count" aria-live="polite">
          {session.photos.length} of {required} photos selected.{exactCount ? ' Ready to edit.' : ` Select ${required - session.photos.length} more.`}
        </p>
        {images.length === 5 && required === 6 && <p className="gallery-message">Add one more photo for this layout, or choose 4 photos and select your favorites.</p>}
        {message && <p className="gallery-message" role="status">{message}</p>}
        <input ref={inputRef} className="gallery-file-input" type="file" accept="image/*" multiple onChange={onFilesSelected} aria-label="Choose image files" />
        {!images.length && <div className="review-empty">
          <ImagePlus size={32} aria-hidden="true" />
          <h2>Let’s fill your strip.</h2>
          <p>Take photos or add from your gallery above. You can mix both.</p>
        </div>}
        <div className="gallery-import-list">
          {images.map((image, index) => {
            const position = images.slice(0, index + 1).filter((item) => item.selected).length;
            return (
              <article className="gallery-import-card" data-selected={image.selected} key={`${image.photo}-${index}`}>
                <img src={image.photo} alt={`Photo ${index + 1}`} />
                <div className="gallery-import-details">
                  <strong>{image.name}</strong>
                  <span>{image.selected ? `Strip position ${position}` : 'Not in strip'}</span>
                  <label className="review-selection">
                    <input type="checkbox" checked={image.selected} disabled={busy || (!image.selected && exactCount)}
                      onChange={() => dispatch({ type: 'reviewSelect', index })} aria-label={`Include photo ${index + 1}`} />
                    Include in strip
                  </label>
                </div>
                <div className="gallery-import-actions">
                  <button className="booth-link" type="button" onClick={() => dispatch({ type: 'reviewMove', index, offset: -1 })} disabled={busy || index === 0} aria-label={`Move photo ${index + 1} up`}>↑</button>
                  <button className="booth-link" type="button" onClick={() => dispatch({ type: 'reviewMove', index, offset: 1 })} disabled={busy || index === images.length - 1} aria-label={`Move photo ${index + 1} down`}>↓</button>
                  <button className="booth-link" type="button" onClick={() => dispatch({ type: 'reviewRemove', index })} disabled={busy} aria-label={`Remove photo ${index + 1}`}>Remove</button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="gallery-import-footer">
          <button className="booth-button" type="button" onClick={() => navigate('/editor')} disabled={!exactCount || busy}>
            Continue to design <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </main>
    </div>
  );
}
