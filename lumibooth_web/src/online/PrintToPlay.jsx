import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { lumiRequest, publicLink, uploadMedia } from './lumiClient';

export default function PrintToPlay({ output, photos, getGif, onPrint, disabled }) {
  const [mode, setMode] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [published, setPublished] = useState(null);
  const [expectedExpiry] = useState(() => new Date(Date.now() + 90 * 86400000).toLocaleDateString());
  const ticket = useRef(null);
  const snapshot = useRef(null);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const publish = async () => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      if (!snapshot.current) {
        let gif;
        if (getGif) {
          try {
            gif = await getGif();
            if (gif.size > 16 * 1024 * 1024) gif = undefined;
          } catch (reason) {
            if (reason.name === 'AbortError') throw reason;
          }
          if (!gif) setNotice('The animation was unavailable. The gallery includes your still photos.');
        }
        const [poster, ...originals] = await Promise.all([output, ...photos].map(async (src) => (await fetch(src)).blob()));
        snapshot.current = { gif, poster, originals };
      }
      if (!active.current) return;
      const { gif, poster, originals } = snapshot.current;
      const resuming = Boolean(ticket.current);
      ticket.current ??= await lumiRequest('share_begin', { originals: originals.length, hasMotion: Boolean(gif) });
      const { id, token } = ticket.current;
      const uploads = resuming ? await lumiRequest('share_uploads', { id }) : ticket.current;
      if (!active.current) return;
      if (!uploads.published) await Promise.all([
        uploadMedia(uploads.poster, poster),
        gif && uploadMedia(uploads.motion, gif),
        ...originals.map((photo, index) => uploadMedia(uploads.originals[index], photo)),
      ]);
      if (!active.current) return;
      const { expiresAt } = await lumiRequest('share_publish', { id });
      const url = publicLink('p', token);
      const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', width: 256, margin: 4 });
      if (!active.current) return;
      const share = { qr, url, expiresAt, id };
      setPublished(share);
      if (mode === 'print') await onPrint(share);
    } catch (reason) {
      if (reason.name !== 'AbortError') setError(reason.message || 'Could not create a print link.');
    } finally {
      setPending(false);
    }
  };

  const revoke = async () => {
    setPending(true);
    try {
      await lumiRequest('share_revoke', { id: published.id });
      ticket.current = null;
      setPublished(null);
      snapshot.current = null;
      setNotice('');
      setMode(null);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="print-play-controls">
      <div className="preview-actions">
        <button className="booth-button booth-secondary" disabled={disabled || pending}
          onClick={() => setMode(mode === 'share' ? null : 'share')} aria-expanded={mode === 'share'}>
          Share with QR
        </button>
        <button className="booth-button booth-secondary" disabled={disabled || pending}
          onClick={() => published ? onPrint(published) : setMode(mode === 'print' ? null : 'print')} aria-expanded={mode === 'print'}>
          Print with QR
        </button>
      </div>
      {mode && !published && <div className="online-notice">
        <p>Upload your individual photos and finished strip{getGif ? ', including the animated GIF,' : ''}
          {' '}through {expectedExpiry}. Anyone with the QR code can view and download these files.</p>
        <div className="preview-actions">
          <button className="booth-button" disabled={pending} onClick={publish}>
            {pending ? 'Preparing gallery…' : mode === 'print' ? 'Upload and print' : 'Upload and show QR'}
          </button>
          {mode === 'print' && <button className="booth-button booth-secondary" disabled={pending} onClick={() => onPrint(null)}>
            Print without QR
          </button>}
        </div>
      </div>}
      {published && <div className="online-notice">
        {mode && <img className="gallery-qr" src={published.qr} alt="Scan to download photos" />}
        <p>Gallery available until {new Date(published.expiresAt).toLocaleDateString()}.</p>
        <div className="preview-actions">
          <a className="booth-link" href={published.url} target="_blank" rel="noreferrer">Open photo gallery</a>
          <button className="booth-link" onClick={async () => {
            try { await navigator.clipboard.writeText(published.url); }
            catch { setError('Could not copy the link. You can open the gallery or scan the QR code.'); }
          }}>Copy link</button>
          <button className="booth-link" disabled={pending} onClick={revoke}>Revoke link</button>
        </div>
      </div>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
