import { Link } from 'react-router-dom';
import { BoothHeader } from '../../components/BoothUI';
import { accountsEnabled, backupsEnabled, printToPlayEnabled, remoteBoothEnabled } from '../../online/lumiClient';

function publishedDocument(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const privacyUrl = publishedDocument(import.meta.env.VITE_LUMI_PRIVACY_URL);
const termsUrl = publishedDocument(import.meta.env.VITE_LUMI_TERMS_URL);

export function PrivacyInformationLink() {
  return <Link className="booth-link" to="/legal" target="_blank" rel="noopener">Privacy information</Link>;
}

export default function WebLegal() {
  return (
    <div className="booth-shell">
      <BoothHeader step="PRIVACY" />
      <main className="booth-content">
        <Link className="booth-link" to="/">Back to photo booth</Link>
        <h1 className="booth-title">Privacy information</h1>
        <section>
          <h2>On this browser</h2>
          <p>Regular capture, editing and export work as a guest. Drafts, saved strips and My Uploads are stored in this browser. Clearing site data can remove them. Files you download or print stay wherever you save or share them.</p>
        </section>
        {accountsEnabled && <section>
          <h2>Optional accounts</h2>
          <p>An account uses your email for sign-in, confirmation and password recovery. Signing in keeps existing photos and uploads in this browser unless you choose to share or back them up.</p>
        </section>}
        {backupsEnabled && <section>
          <h2>Private cloud backups</h2>
          <p>Only the strips or uploads you select and confirm are backed up. A saved strip backup can include source photos and editing files. Backups are accessible through your account. Deleting a backup keeps local copies, and deleting a local copy keeps its cloud backup.</p>
        </section>}
        {printToPlayEnabled && <section>
          <h2>QR galleries</h2>
          <p>Sharing or printing with a QR code uploads the selected photos, finished strip and any included GIF. Anyone with the code or link can download them. The link expires after 90 days and can be revoked sooner. Downloads already made are retained by their recipients.</p>
        </section>}
        {remoteBoothEnabled && <section>
          <h2>Booth with a friend</h2>
          <p>Remote sessions upload the paired photos and finished strip so the two participants can use them. Room links expire after one hour.</p>
        </section>}
        {(privacyUrl || termsUrl) && <section>
          <h2>Legal documents</h2>
          <ul>
            {privacyUrl && <li><a className="booth-link" href={privacyUrl}>Privacy Policy</a></li>}
            {termsUrl && <li><a className="booth-link" href={termsUrl}>Terms of Use</a></li>}
          </ul>
        </section>}
      </main>
    </div>
  );
}
