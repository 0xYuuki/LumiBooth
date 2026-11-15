import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, ImagePlus, ArrowRight } from 'lucide-react';
import { BoothHeader, BoothStep, MiniStrip } from '../../components/BoothUI';
import { PhotoboothContext } from '../../context/photoboothContext';
import { requiredPhotos, reviewItems } from '../../context/photoboothSession';
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

  const cancel = () => {
    dispatch({ type: 'reset' });
    navigate('/', { replace: true });
  };

  return (
    <div className="booth-shell">
      <BoothHeader step="02 / PHOTOS" onCancel={cancel} />
      <main className="booth-content gallery-import-page">
        <BoothStep number={2} back="/layout" disabled={busy} />
        <h1 className="booth-title">Your photos, your order.</h1>
        <p className="booth-intro">Add photos from your gallery or take them here. Select the photos for your strip, then arrange them in order. Everything stays in this browser.</p>
        <div className="review-layout-summary">
          <MiniStrip count={session.layout.count} columns={session.layout.columns} />
          <div><strong>{session.layout.name}</strong><p>{required} {required === 1 ? 'photo' : 'photos'} in your strip</p></div>
          <Link className="booth-link" to="/layout">Change layout</Link>
        </div>
        <div className="photo-source-switch" aria-label="Photo source">
          <Link to="/camera"><Camera size={17} aria-hidden="true" /> Take photos</Link>
          <span aria-current="page">Gallery &amp; review</span>
        </div>
        <p className="gallery-count" aria-live="polite">
          {session.photos.length} of {required} photos selected.{exactCount ? ' Ready to edit.' : ` Select ${required - session.photos.length} more.`}
        </p>
        {message && <p className="gallery-message" role="status">{message}</p>}
        <input ref={inputRef} className="gallery-file-input" type="file" accept="image/*" multiple onChange={onFilesSelected} aria-label="Choose image files" />
        {!images.length && <div className="review-empty">
          <ImagePlus size={32} aria-hidden="true" />
          <h2>Let’s fill your strip.</h2>
          <p>Add photos below, or switch to the camera to take a new one.</p>
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
          <button className="booth-button booth-secondary" type="button" onClick={() => inputRef.current?.click()} disabled={busy || images.length >= MAX_PHOTOS}>
            <ImagePlus size={18} aria-hidden="true" /> {busy ? 'Preparing photos…' : 'Add photos'}
          </button>
          <button className="booth-button" type="button" onClick={() => navigate('/editor')} disabled={!exactCount || busy}>
            Start editing <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </main>
    </div>
  );
}
