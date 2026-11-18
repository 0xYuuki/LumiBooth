import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BoothHeader } from '../../components/BoothUI';
import { backupsEnabled } from '../../online/lumiClient';
import CustomUploads from './CustomUploads';

export default function WebUploads() {
  const [kind, setKind] = useState('sticker');
  return (
    <div className="booth-shell">
      <BoothHeader step="MY UPLOADS" />
      <main className="booth-content">
        <Link className="booth-link" to="/">Back to photo booth</Link>
        <h1 className="booth-title">My Uploads</h1>
        <p className="booth-intro">Uploads are stored in this browser. Clearing site data removes the library.</p>
        {backupsEnabled && <Link className="booth-link" to="/uploads/backup">Cloud backup</Link>}
        <div className="design-tabs">
          <button aria-pressed={kind === 'sticker'} onClick={() => setKind('sticker')}>Stickers</button>
          <button aria-pressed={kind === 'background'} onClick={() => setKind('background')}>Backgrounds</button>
        </div>
        <CustomUploads key={kind} kind={kind} />
      </main>
    </div>
  );
}
