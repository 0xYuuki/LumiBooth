import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BoothHeader } from '../../components/BoothUI';
import { PhotoboothContext } from '../../context/photoboothContext';
import { deleteWork, editWork, listWorks, loadWork } from '../../context/savedWorks';
import { backupsEnabled } from '../../online/lumiClient';
import StripPreviewDialog from './StripPreviewDialog';

const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const sizes = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 });

function WorkDate({ timestamp }) {
  if (!Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) return 'Date unavailable';
  return <time dateTime={new Date(timestamp).toISOString()}>{dates.format(timestamp)}</time>;
}

function WorkThumbnail({ url }) {
  const [failed, setFailed] = useState(false);
  return url && !failed
    ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
    : <span>Preview unavailable</span>;
}

export function WebWorks() {
  const [works, setWorks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const urls = [];
    listWorks().then(entries => {
      if (!active) return;
      setWorks(entries.map(work => {
        const url = work.thumbnail instanceof Blob ? URL.createObjectURL(work.thumbnail) : null;
        if (url) urls.push(url);
        return { ...work, url };
      }));
    }).catch(() => { if (active) setError('Could not open Your works in this browser.'); });
    return () => {
      active = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <div className="booth-shell">
      <BoothHeader step="YOUR WORKS" />
      <main className="booth-content">
        <Link className="booth-link" to="/">Back to photo booth</Link>
        <h1 className="booth-title">Your works</h1>
        {backupsEnabled && <Link className="booth-link" to="/backup">Cloud backup</Link>}
        {error && <p role="alert">{error}</p>}
        {!works && !error && <p role="status">Opening Your works…</p>}
        {works?.length === 0 && <p>Save a finished strip to see it here.</p>}
        {works?.length > 0 && <>
          <p>{works.length} {works.length === 1 ? 'strip' : 'strips'} · {sizes.format(works.reduce((sum, work) => sum + (work.bytes || 0), 0) / 1e6)} on this device</p>
          <ul className="works-grid">
            {works.map(work => (
              <li key={work.id}>
                <Link to={work.id}>
                  <WorkThumbnail url={work.url} />
                  <span><strong>{work.title || 'Saved strip'}</strong><br /><WorkDate timestamp={work.createdAt} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </>}
        <p className="booth-intro">Saved in this browser. Clearing site data can remove your strips.</p>
      </main>
    </div>
  );
}

export function WebSavedWork() {
  const { id } = useParams();
  return <SavedWork key={id} id={id} />;
}

function SavedWork({ id }) {
  const navigate = useNavigate();
  const { session, dispatch } = useContext(PhotoboothContext);
  const [work, setWork] = useState(undefined);
  const [imageSize, setImageSize] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [editUnavailable, setEditUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    let url;
    loadWork(id).then(item => {
      if (!active) return;
      if (item?.poster instanceof Blob && item.poster.size) url = URL.createObjectURL(item.poster);
      setWork(item ? { ...item, url } : null);
    }).catch(() => {
      if (active) {
        setWork(null);
        setError('Could not read this strip from browser storage.');
      }
    });
    return () => {
      active = false;
      mounted.current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  async function openEditor() {
    if (session && !window.confirm('Open this saved strip for editing? It will replace the current draft.')) return;
    setBusy(true);
    setError('');
    try {
      const restored = await editWork(work.project);
      if (!mounted.current) {
        for (const item of restored.reviewItems) URL.revokeObjectURL(item.photo);
        return;
      }
      dispatch({ type: 'restore', session: restored });
      navigate('/editor');
    } catch {
      if (mounted.current) {
        setEditUnavailable(true);
        setError('The editable photos could not be opened.');
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this saved strip from this browser? Any cloud backup will stay.')) return;
    setBusy(true);
    setError('');
    try {
      await deleteWork(id);
      if (mounted.current) navigate('/works', { replace: true });
    } catch {
      if (mounted.current) setError('Could not delete this saved strip. Try again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const file = imageSize && work?.poster instanceof Blob ? new File([work.poster], 'lumibooth-strip.png', { type: 'image/png' }) : null;
  const canShare = file && navigator.canShare?.({ files: [file] });
  const editable = work?.project && !editUnavailable;
  return (
    <div className="booth-shell">
      <BoothHeader step="YOUR WORKS" />
      <main className="booth-content strip-preview">
        <div className="preview-copy">
          <Link to="/works" className="booth-link">Back to Your works</Link>
          <h1 className="booth-title">Saved strip</h1>
          {error && <p role="alert">{error}</p>}
          {work === undefined && <p role="status">Opening strip…</p>}
          {work === null && !error && <p>This strip is no longer in Your works.</p>}
          {work && <>
            <p><WorkDate timestamp={work.createdAt} /></p>
            {!editable && <p>Editable source photos are unavailable.</p>}
            <div className="preview-actions">
              {file && <a className="booth-button" href={work.url} download="lumibooth-strip.png">Save to Device</a>}
              {canShare && <button className="booth-button booth-secondary" onClick={async () => {
                try { await navigator.share({ files: [file] }); }
                catch (reason) { if (reason.name !== 'AbortError') setError('Could not share this strip.'); }
              }}>Share strip</button>}
              {file && <button className="booth-button booth-secondary" onClick={() => window.print()}>Print Photo</button>}
              {file && <button className="booth-link" onClick={() => setExpanded(true)}>Expand preview</button>}
              {editable && <button className="booth-link" disabled={busy} onClick={openEditor}>Edit Strip</button>}
              <button className="booth-link" disabled={busy} onClick={remove}>Delete saved strip</button>
            </div>
          </>}
        </div>
        {work?.url && <div className="preview-stage">
          <img className="finished-strip" src={work.url} alt="Your saved LumiBooth photo strip"
            onLoad={({ currentTarget }) => setImageSize({ width: currentTarget.naturalWidth, height: currentTarget.naturalHeight })}
            onError={() => { setImageSize(null); setWork(current => ({ ...current, url: null })); }} />
        </div>}
        {work && !work.url && <p role="status">This strip image is missing or damaged.</p>}
      </main>
      {expanded && imageSize && <StripPreviewDialog size={imageSize} onClose={() => setExpanded(false)}>
        {() => <img src={work.url} alt="Expanded LumiBooth photo strip" />}
      </StripPreviewDialog>}
    </div>
  );
}
