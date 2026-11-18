import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BoothHeader } from '../../components/BoothUI';
import { listWorks } from '../../context/savedWorks';
import { backupName } from '../../online/backupArchive';
import { deleteBackup, listBackups, restoreBackup, uploadBackup } from '../../online/cloudBackup';
import { accountAuth } from '../../online/lumiClient';

const size = bytes => `${(bytes / 1048576).toFixed(1)} MB`;
const date = value => {
  const result = new Date(value);
  return Number.isFinite(result.getTime()) ? result.toLocaleString() : 'Date unavailable';
};

export default function WebBackup() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    const { data: { subscription } } = accountAuth().onAuthStateChange((event, session) => {
      setUser(event === 'PASSWORD_RECOVERY' || session?.user?.is_anonymous ? null : session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="booth-shell">
      <BoothHeader step="CLOUD BACKUP" />
      <main className="booth-content backup-page">
        <Link className="booth-link" to="/works">Back to Your works</Link>
        <h1 className="booth-title">Cloud backup</h1>
        {user === undefined ? <p role="status">Checking your sign-in…</p> : user
          ? <BackupLibrary key={user.id} owner={user.id} email={user.email} />
          : <p><Link to="/account">Sign in</Link> to back up or restore saved strips.</p>}
      </main>
    </div>
  );
}

function BackupLibrary({ owner, email }) {
  const [local, setLocal] = useState([]);
  const [cloud, setCloud] = useState([]);
  const [selected, setSelected] = useState([]);
  const [revision, setRevision] = useState(0);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const loading = revision !== loadedRevision;

  useEffect(() => {
    let active = true;
    Promise.allSettled([listWorks(), listBackups(owner)]).then(([device, backups]) => {
      if (!active) return;
      setLocal(device.status === 'fulfilled' ? device.value : []);
      setCloud(backups.status === 'fulfilled' ? backups.value : []);
      setLoadError(device.status !== 'fulfilled' || backups.status !== 'fulfilled'
        ? 'Could not refresh every list. Check your connection and browser storage, then retry.' : '');
      setLoadedRevision(revision);
    });
    return () => { active = false; };
  }, [owner, revision]);

  const existing = new Set(cloud.map(backup => backup.name));
  const chosen = local.filter(work => selected.includes(work.id) && !existing.has(backupName(work.id)));
  const total = chosen.reduce((sum, work) => sum + work.bytes, 0);

  async function run(action) {
    setBusy(true);
    setNotice('');
    setError('');
    try { await action(); }
    catch (failure) { setError(failure?.message || 'Could not finish the request. Try again.'); }
    finally {
      setBusy(false);
      setRevision(value => value + 1);
    }
  }

  function backUp() {
    if (!window.confirm(`Upload ${chosen.length} selected strips (about ${size(total)}) to the private backups for ${email}?`)) return;
    void run(async () => {
      const failures = [];
      let done = 0;
      for (const work of chosen) {
        setNotice(`Backing up ${done + failures.length + 1} of ${chosen.length}…`);
        try {
          await uploadBackup(owner, work.id);
          done++;
          setSelected(ids => ids.filter(id => id !== work.id));
        } catch (failure) {
          failures.push(`${work.title}: ${failure?.message || 'Upload failed.'}`);
        }
      }
      setNotice(`${done} of ${chosen.length} selected strips backed up.`);
      setError(failures.join(' '));
    });
  }

  return (
    <>
      <p>Backups are private to {email}. Only selected saved strips and their editing files are uploaded after you confirm. Restoring adds a local copy.</p>
      {loading && <p role="status">Refreshing backup lists…</p>}
      {loadError && <p role="alert">{loadError} <button className="booth-link" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <section aria-labelledby="local-backup-title">
        <h2 id="local-backup-title">On this device</h2>
        {!loading && local.length === 0 && <p>Save a finished strip to Your works to back it up.</p>}
        <fieldset disabled={busy || loading} aria-label="Select strips to back up">
          {local.map(work => {
            const saved = existing.has(backupName(work.id));
            return <label key={work.id} className="backup-option">
              <input type="checkbox" checked={saved || selected.includes(work.id)} disabled={saved}
                onChange={event => setSelected(ids => event.target.checked ? [...ids, work.id] : ids.filter(id => id !== work.id))} />
              {work.title || 'Saved strip'} · {date(work.createdAt)} · {saved ? 'Backed up' : size(work.bytes)}
            </label>;
          })}
        </fieldset>
        <button className="booth-button" disabled={busy || loading || chosen.length === 0} onClick={backUp}>
          Back up selected{chosen.length > 0 ? ` (${chosen.length}, about ${size(total)})` : ''}
        </button>
      </section>
      <section aria-labelledby="cloud-backup-title">
        <h2 id="cloud-backup-title">In your cloud backup</h2>
        {!loading && !loadError && cloud.length === 0 && <p>No backups yet.</p>}
        <ul className="backup-list">
          {cloud.map(backup => <li key={backup.name}>
            <p>Strip backed up {date(backup.created_at)} · {size(backup.metadata?.size ?? 0)}</p>
            <button className="booth-button booth-secondary" disabled={busy || loading} onClick={() => run(async () => {
              setNotice('Downloading strip…');
              const inserted = await restoreBackup(owner, backup, (bytes, expected) => setNotice(
                `Downloading strip · ${size(bytes)}${expected ? ` of ${size(expected)}` : ''}`));
              setNotice(inserted ? 'Strip restored to Your works.' : 'This strip is already in Your works.');
            })}>Restore strip</button>
            <button className="booth-link" disabled={busy || loading} onClick={() => {
              if (!window.confirm('Delete this cloud backup? Copies on your devices will stay.')) return;
              void run(async () => {
                await deleteBackup(owner, backup.name);
                setNotice('Cloud backup deleted.');
              });
            }}>Delete backup</button>
          </li>)}
        </ul>
      </section>
    </>
  );
}
