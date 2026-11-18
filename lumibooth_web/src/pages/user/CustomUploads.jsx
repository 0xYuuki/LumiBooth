import { useEffect, useState } from 'react';
import { addUpload, deleteUpload, listUploads, renameUpload, uploadedBackgroundStyle } from '../../context/customUploads';

export default function CustomUploads({ kind, onApply, activeBackground, onRemoveBackground, previewAspect = 0.65 }) {
  const [entries, setEntries] = useState(null);
  const [loadingError, setLoadingError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    listUploads(kind).then(items => {
      if (active) {
        setEntries(items);
        setLoadingError('');
      }
    }).catch(() => { if (active) setLoadingError('Could not open uploads in this browser.'); });
    return () => { active = false; };
  }, [kind, revision]);

  async function change(operation) {
    setBusy(true);
    setError('');
    try {
      await operation();
      setRevision(value => value + 1);
    } catch (reason) {
      setError(reason.name === 'QuotaExceededError'
        ? 'Browser storage is full. Remove an unused upload or free browser storage.'
        : reason.message || 'Could not save the upload. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function preview({ id, name, image, fit = 'cover', x = 50, y = 50 }) {
    setSelected({ id, name, image, fit, x, y });
  }

  return (
    <div className="custom-uploads">
      <label className="upload-input">
        Upload your own {kind}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {
          const [file] = event.target.files;
          event.target.value = '';
          if (file) void change(async () => {
            const item = await addUpload(file, kind);
            if (onApply) preview(item);
          });
        }} />
      </label>
      <p className="booth-intro">Still PNG, JPEG, or WebP · up to 20 MB and 32 megapixels.</p>
      {busy && <p role="status">Updating uploads…</p>}
      {loadingError && <p role="alert">{loadingError} <button className="booth-link" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
      {error && <p role="alert">{error}</p>}
      {activeBackground && <div>
        <button className="booth-link" onClick={() => preview(activeBackground)}>Adjust background</button>
        <button className="booth-link" onClick={() => {
          onRemoveBackground();
          setSelected(null);
        }}>Remove background</button>
      </div>}
      {selected && onApply && <div className="upload-selection">
        {kind === 'background' ? <>
          <div className="upload-background-preview" role="img" aria-label="Background placement preview"
            style={{ aspectRatio: previewAspect, ...uploadedBackgroundStyle(selected) }} />
          <label>Background fit <select value={selected.fit} onChange={event => setSelected({ ...selected, fit: event.target.value })}>
            <option value="cover">Fill strip</option>
            <option value="contain">Fit whole image</option>
          </select></label>
          <label>Horizontal position <input type="range" min="0" max="100" value={selected.x}
            onChange={event => setSelected({ ...selected, x: Number(event.target.value) })} /></label>
          <label>Vertical position <input type="range" min="0" max="100" value={selected.y}
            onChange={event => setSelected({ ...selected, y: Number(event.target.value) })} /></label>
        </> : <img src={selected.image} alt={selected.name} />}
        <button className="booth-button booth-secondary" onClick={() => {
          onApply(selected);
          setSelected(null);
        }}>{kind === 'background' ? 'Apply background' : 'Add sticker'}</button>
        <button className="booth-link" onClick={() => setSelected(null)}>Cancel preview</button>
      </div>}
      {entries?.length === 0 && <p>No uploads yet.</p>}
      {entries?.length > 0 && <ul className="upload-grid">
        {entries.map(item => <li key={item.id}>
          <img src={item.image} alt="" loading="lazy" />
          <strong>{item.name}</strong>
          {onApply && <button className="booth-link" disabled={busy} onClick={() => preview(item)}>Preview {item.name}</button>}
          <button className="booth-link" aria-label={`Rename ${item.name}`} disabled={busy} onClick={() => {
            const name = window.prompt('Rename this upload', item.name);
            if (name !== null) void change(() => renameUpload(item.id, name));
          }}>Rename</button>
          <button className="booth-link" aria-label={`Delete ${item.name}`} disabled={busy} onClick={() => {
            if (!window.confirm('Delete this image from My Uploads? Existing drafts and saved strips keep their own copy.')) return;
            void change(async () => {
              await deleteUpload(item.id);
              setSelected(current => current?.id === item.id ? null : current);
            });
          }}>Delete</button>
        </li>)}
      </ul>}
    </div>
  );
}
