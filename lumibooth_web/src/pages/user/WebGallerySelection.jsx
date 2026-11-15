import { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BoothHeader } from '../../components/BoothUI';
import { PhotoboothContext } from '../../context/photoboothContext';
import { layouts, requiredPhotos } from '../../context/photoboothSession';
import { prepareGalleryFiles, releaseGalleryFiles } from './galleryImport';

const MAX_PHOTOS = 12;

export default function WebGallerySelection() {
  const location = useLocation();
  const navigate = useNavigate();
  const { dispatch } = useContext(PhotoboothContext);
  const [images, setImages] = useState(() => location.state?.images ?? []);
  const imagesRef = useRef(images);
  const [layoutId, setLayoutId] = useState(() => {
    const initial = location.state?.images ?? [];
    return layouts.find((layout) => layout.count === initial.length)?.id ?? layouts[0].id;
  });
  const [message, setMessage] = useState(() => location.state?.message ?? '');
  const [busy, setBusy] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState(null);
  const inputRef = useRef(null);
  const transferred = useRef(false);
  const layout = layouts.find((item) => item.id === layoutId) ?? layouts[0];
  const required = requiredPhotos(layout);

  useEffect(() => {
    if (!location.state?.images?.length) navigate('/', { replace: true });
  }, [location.state, navigate]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => () => {
    if (!transferred.current) releaseGalleryFiles(imagesRef.current);
  }, []);

  const openPicker = (replace = null) => {
    setReplaceIndex(replace);
    if (inputRef.current) {
      inputRef.current.multiple = replace === null;
      inputRef.current.click();
    }
  };

  const onFilesSelected = async (event) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length) return;
    if (replaceIndex === null && images.length + files.length > MAX_PHOTOS) {
      setMessage('Choose up to 12 photos. Remove a photo before adding more.');
      return;
    }

    setBusy(true);
    setMessage('');
    const result = await prepareGalleryFiles(files);
    setBusy(false);
    if (!result.images.length) {
      setMessage(result.message ?? 'No supported photos could be opened. Choose JPEG, PNG, or WebP images.');
      return;
    }
    if (result.skipped) {
      setMessage(`${result.skipped} photo${result.skipped === 1 ? '' : 's'} could not be opened or exceeded the size limit.`);
    }
    if (replaceIndex === null) {
      setImages((current) => [...current, ...result.images]);
    } else {
      const replacement = result.images[0];
      releaseGalleryFiles([images[replaceIndex], ...result.images.slice(1)]);
      setImages((current) => current.map((image, index) =>
        index === replaceIndex ? replacement : image));
    }
    setReplaceIndex(null);
  };

  const move = (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= images.length) return;
    setImages((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const remove = (index) => {
    const removed = images[index];
    releaseGalleryFiles([removed]);
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const cancel = () => {
    dispatch({ type: 'reset' });
    navigate('/', { replace: true });
  };

  const continueToEditor = () => {
    if (images.length !== required || busy) return;
    dispatch({ type: 'galleryStart', layout, photos: images.map((image) => image.url) });
    transferred.current = true;
    navigate('/editor', { replace: true });
  };

  const exactCount = images.length === required;
  return (
    <div className="booth-shell">
      <BoothHeader step="01 / GALLERY" onCancel={cancel} />
      <main className="booth-content gallery-import-page">
        <p className="booth-eyebrow">CHOOSE FROM GALLERY</p>
        <h1 className="booth-title">Build your strip.</h1>
        <p className="booth-intro">Choose a layout, arrange your photos, and replace or remove any image before editing. Photos are processed in this browser and are not uploaded.</p>

        <label className="gallery-layout-label" htmlFor="gallery-layout">Strip layout</label>
        <select id="gallery-layout" value={layoutId} onChange={(event) => setLayoutId(event.target.value)}>
          {layouts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.count} {item.count === 1 ? 'photo' : 'photos'}</option>)}
        </select>

        <p className="gallery-count" aria-live="polite">
          {exactCount
            ? `${images.length} photos ready in strip order.`
            : images.length < required
              ? `Add ${required - images.length} more or choose a smaller layout.`
              : `Remove ${images.length - required} or choose a larger layout.`}
        </p>

        {message && <p className="gallery-message" role="status">{message}</p>}
        <input ref={inputRef} className="gallery-file-input" type="file" accept="image/*" multiple onChange={onFilesSelected} aria-label="Choose image files" />
        <div className="gallery-import-list">
          {images.map((image, index) => (
            <article className="gallery-import-card" key={`${image.url}-${index}`}>
              <img src={image.url} alt={`Selected photo ${index + 1}`} />
              <div className="gallery-import-details">
                <strong>{image.name}</strong>
                <span>Position {index + 1}</span>
              </div>
              <div className="gallery-import-actions">
                <button className="booth-link" type="button" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={`Move photo ${index + 1} up`}>↑</button>
                <button className="booth-link" type="button" onClick={() => move(index, 1)} disabled={busy || index === images.length - 1} aria-label={`Move photo ${index + 1} down`}>↓</button>
                <button className="booth-link" type="button" onClick={() => openPicker(index)} disabled={busy} aria-label={`Replace photo ${index + 1}`}>Replace</button>
                <button className="booth-link" type="button" onClick={() => remove(index)} disabled={busy} aria-label={`Remove photo ${index + 1}`}>Remove</button>
              </div>
            </article>
          ))}
        </div>

        <div className="gallery-import-footer">
          <button className="booth-button booth-secondary" type="button" onClick={() => openPicker()} disabled={busy || images.length >= MAX_PHOTOS}>
            {busy ? 'Preparing photos…' : 'Add photos'}
          </button>
          <button className="booth-button" type="button" onClick={continueToEditor} disabled={!exactCount || busy}>
            {exactCount ? 'Start editing' : `Choose exactly ${required} photos`}
          </button>
        </div>
      </main>
    </div>
  );
}
