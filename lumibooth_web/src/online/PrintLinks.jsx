import { useEffect, useState } from 'react';
import { BoothHeader } from '../components/BoothUI';
import { lumiRequest } from './lumiClient';

export default function PrintLinks() {
  const [links, setLinks] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    lumiRequest('share_list', {}, { signal: controller.signal }).then(setLinks).catch((reason) => {
      if (!controller.signal.aborted) setError(reason.message);
    });
    return () => controller.abort();
  }, []);
  return <div className="booth-shell">
    <BoothHeader step="GALLERY LINKS" />
    <main className="booth-content">
      <h1 className="booth-title">Manage gallery links</h1>
      {error && <p role="alert">{error}</p>}
      {links?.length === 0 && <p>No active links on this device.</p>}
      <ul className="online-links">{links?.map((link) => <li key={link.id}>
        <span>Created {new Date(link.created_at).toLocaleString()} · expires {new Date(link.expires_at).toLocaleDateString()}</span>
        <button className="booth-button booth-secondary" disabled={busy} onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await lumiRequest('share_revoke', { id: link.id });
            setLinks((previous) => previous.filter(({ id }) => id !== link.id));
          } catch (reason) {
            setError(reason.message);
          } finally {
            setBusy(false);
          }
        }}>Revoke link</button>
      </li>)}</ul>
    </main>
  </div>;
}
