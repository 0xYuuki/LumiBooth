import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PhotoStrip } from './PhotoStrip';
import { Camera, ImagePlus, ArrowRight, X, Undo2 } from 'lucide-react';
import { BoothHeader, BoothStep, MiniStrip } from '../../components/BoothUI';
import { PhotoboothContext } from '../../context/photoboothContext';
import { layouts, requiredPhotos, reviewItems, selectedItems } from '../../context/photoboothSession';
import { prepareGalleryFiles, releaseGalleryFiles } from './galleryImport';

const MAX_PHOTOS = 12;

export default function WebGallerySelection() {
  const navigate = useNavigate();
  const { session, dispatch, draftError, draftStatus } = useContext(PhotoboothContext);
  const [message, setMessage] = useState('');
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const images = reviewItems(session);
  const required = requiredPhotos(session.layout);
  const ordered = selectedItems(images);
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
        <p className="draft-status" role="status">{draftStatus}</p>
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
        {draftError && <p role="status">{draftError}</p>}
        {message && <p className="gallery-message" role="status">{message}</p>}
        <input ref={inputRef} className="gallery-file-input" type="file" accept="image/*" multiple onChange={onFilesSelected} aria-label="Choose image files" />
        {!images.length && <div className="review-empty">
          <ImagePlus size={32} aria-hidden="true" />
          <h2>Let’s fill your strip.</h2>
          <p>Take photos or add from your gallery above. You can mix both.</p>
        </div>}
        {(images.length > 0 || session.history?.length > 0) && <div className="photo-order-toolbar">
          <div><h2>Your photos</h2><p>Tap in the order you want. Tap a numbered photo to deselect it.</p></div>
          <button className="booth-link" disabled={busy || !ordered.length} onClick={() => dispatch({ type: 'reviewClear' })}>Choose order</button>
          <button className="booth-link" disabled={busy || !session.history?.length} onClick={() => dispatch({ type: 'undo' })}><Undo2 size={16} /> Undo</button>
        </div>}
        <div className="gallery-import-list shot-grid">
          {images.map((image, index) => {
            const position = ordered.indexOf(image) + 1;
            return <article className="gallery-import-card shot-card" data-selected={image.selected} key={`${image.photo}-${index}`}>
              <button className="shot-select" role="checkbox" aria-checked={image.selected} aria-label={`Include photo ${index + 1}`}
                disabled={busy || (!image.selected && exactCount)} onClick={() => dispatch({ type: 'reviewSelect', index })}>
                <img src={image.photo} alt={`Photo ${index + 1}`} />
                <span className="shot-number" aria-label={image.selected ? `Strip position ${position}` : 'Not selected'}>{image.selected ? position : '+'}</span>
                <span className="shot-name">{image.name}</span>
              </button>
              <button className="shot-remove" onClick={() => setRemoving(image)} disabled={busy} aria-label={`Remove photo ${index + 1}`}><X size={18} /></button>
            </article>;
          })}
        </div>
        {removing && <RemovePhotoDialog onCancel={() => setRemoving(null)} onRemove={() => {
          const index = images.indexOf(removing);
          if (index >= 0) dispatch({ type: 'reviewRemove', index });
          setRemoving(null);
        }} />}
        <div className="gallery-import-footer">
          <button className="booth-button" type="button" onClick={() => navigate('/editor')} disabled={!exactCount || busy}>
            Continue to design <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </main>
    </div>
  );
}

function RemovePhotoDialog({ onCancel, onRemove }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog className="remove-photo-dialog" ref={ref} onCancel={onCancel} aria-labelledby="remove-title">
    <h2 id="remove-title">Remove this photo?</h2><p>It will be removed from this strip. Your original photo stays on your device.</p>
    <div><button className="booth-button booth-secondary" onClick={onCancel} autoFocus>Keep photo</button><button className="booth-button" onClick={onRemove}>Remove photo</button></div>
  </dialog>;
}
