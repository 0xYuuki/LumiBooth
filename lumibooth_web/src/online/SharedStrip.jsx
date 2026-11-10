import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BoothHeader } from '../components/BoothUI';
import { lumiRequest } from './lumiClient';
import { downloadBlob } from './download';

export default function SharedStrip() {
  const token = useLocation().hash.slice(1);
  const [share, setShare] = useState(null);
  const [motion, setMotion] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    lumiRequest('share_resolve', { token }, { public: true, signal: controller.signal })
      .then(setShare).catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [token]);

  const withFreshLink = async (job, work) => {
    setBusy(job);
    setError('');
    try {
      const current = await lumiRequest('share_resolve', { token }, { public: true });
      setShare(current);
      await work(current);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(null);
    }
  };

  const play = () => motion
    ? setMotion(null)
    : withFreshLink('play', (current) => setMotion(current.motion));

  const save = (key, filename, index) => withFreshLink(filename, async (current) => {
    const url = index == null ? current[key] : current.originals?.[index];
    if (!url) throw new Error('This photo is unavailable.');
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Could not download the photo. Try again.');
    downloadBlob(await response.blob(), filename);
  });

  return <div className="booth-shell">
    <BoothHeader step="PHOTO GALLERY" />
    <main className="booth-content shared-strip">
      <h1 className="booth-title">Your LumiBooth photos</h1>
      {error && <p role="alert">{error}</p>}
      {share ? <>
        <img className="finished-strip" src={motion || share.poster} alt={motion ? 'Animated LumiBooth strip' : 'Finished LumiBooth strip'}
          onError={() => {
            if (motion) {
              setMotion(null);
              setError('Motion could not play. Your still strip is shown.');
            } else {
              setError('The strip image could not load.');
            }
          }} />
        <div className="preview-actions">
          <button className="booth-button" disabled={Boolean(busy)}
            onClick={() => save('poster', 'lumibooth-strip.png')}>Download finished strip</button>
          {share.motion && <>
            <button className="booth-button booth-secondary" disabled={Boolean(busy)} onClick={play}>{motion ? 'Stop' : 'Play'}</button>
            <button className="booth-button booth-secondary" disabled={Boolean(busy)}
              onClick={() => save('motion', 'lumibooth-motion-strip.gif')}>Download animated strip</button>
          </>}
        </div>
        {share.originals?.length > 0 && <section aria-labelledby="gallery-originals">
          <h2 id="gallery-originals">Original photos</h2>
          <ol className="gallery-originals">{share.originals.map((url, index) => <li key={index}>
            <img src={url} alt={`Original photo ${index + 1}`} />
            <button className="booth-button booth-secondary" disabled={Boolean(busy)}
              onClick={() => save('originals', `lumibooth-photo-${index + 1}.jpg`, index)}>Download photo {index + 1}</button>
          </li>)}</ol>
        </section>}
        <p>Available until {new Date(share.expiresAt).toLocaleDateString()}.</p>
      </> : !error && <p role="status">Opening photo gallery…</p>}
    </main>
  </div>;
}
