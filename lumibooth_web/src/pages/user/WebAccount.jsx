import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BoothHeader } from '../../components/BoothUI';
import { accountAuth, backupsEnabled } from '../../online/lumiClient';
import { PrivacyInformationLink } from './WebLegal';

const titles = {
  login: 'Log in',
  signup: 'Create an account',
  forgot: 'Reset your password',
  recovery: 'Choose a new password',
};

function callbackError() {
  const url = new URL(window.location.href);
  return [url.searchParams, new URLSearchParams(url.hash.slice(1))]
    .some((params) => params.has('error') || params.has('error_code'));
}

function BackupInvitation({ owner }) {
  const key = `lumi-backup-invitation:${owner}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === 'seen'; } catch { return false; }
  });
  const dismiss = () => {
    try { localStorage.setItem(key, 'seen'); } catch { /* The current view still dismisses it. */ }
    setDismissed(true);
  };
  return dismissed
    ? <Link className="booth-link" to="/backup">Cloud backup</Link>
    : <section>
      <p>Would you like to back up strips from this browser? You can choose what to upload.</p>
      <Link className="booth-link" to="/backup" onClick={dismiss}>Back up my existing strips</Link>
      <button className="booth-link" onClick={dismiss}>Not now</button>
    </section>;
}

export default function WebAccount({ staffOnly = false }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(() => callbackError()
    ? 'This email link is invalid or expired. Request a new link.'
    : '');
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    try {
      const { data: { subscription } } = accountAuth().onAuthStateChange((event, session) => {
        setUser(session?.user?.is_anonymous ? null : (session?.user ?? null));
        if (event === 'PASSWORD_RECOVERY') {
          setMode('recovery');
          setError('');
        }
        if (event === 'INITIAL_SESSION') {
          setReady(true);
          // Supabase removes the code after a successful exchange.
          if (new URLSearchParams(window.location.search).has('code')) {
            setError('This email link could not be opened. Request a new link from this browser.');
          }
        }
      });
      return () => subscription.unsubscribe();
    } catch {
      queueMicrotask(() => {
        setUnavailable(true);
        setError('Accounts are currently unavailable.');
      });
    }
  }, []);

  function choose(nextMode, message = '') {
    setMode(nextMode);
    setPassword('');
    setNotice(message);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const auth = accountAuth();
      const address = email.trim();
      const redirect = new URL('account', new URL(import.meta.env.BASE_URL, location.origin));
      let result;
      if (mode === 'recovery') {
        result = await auth.updateUser({ password });
      } else if (mode === 'forgot') {
        result = await auth.resetPasswordForEmail(address, { redirectTo: redirect.href });
      } else if (mode === 'signup') {
        result = await auth.signUp({ email: address, password, options: { emailRedirectTo: redirect.href } });
      } else if (user) {
        result = await auth.signOut({ scope: 'local' });
      } else {
        result = await auth.signInWithPassword({ email: address, password });
      }
      if (result.error) throw result.error;
      if (mode === 'forgot') choose('login', 'If an account exists for that email, a reset link is on its way.');
      else if (mode === 'signup' && !result.data.session) choose('login', 'Check your email for a confirmation link.');
      else if (mode === 'recovery') choose('login', 'Your password has been updated.');
      else {
        choose('login');
        if (staffOnly && mode === 'login' && !user && result.data?.session) navigate('/', { replace: true });
      }
    } catch (failure) {
      setError(failure.name === 'AuthRetryableFetchError'
        ? 'Could not reach the account service. Try again when you’re online.'
        : failure.message || 'The account request failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const signedIn = user && !['recovery', 'forgot'].includes(mode);
  return (
    <div className="booth-shell">
      <BoothHeader step={staffOnly ? "STAFF ACCESS" : "ACCOUNT"} />
      <main className="booth-account">
        <h1>{signedIn ? 'Your account' : staffOnly && mode === 'login' ? 'Staff sign-in' : titles[mode]}</h1>
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
        {!ready && !unavailable && <p role="status">Loading account…</p>}
        {ready && (
          <form onSubmit={submit}>
            {signedIn ? <p>Signed in as {user.email}</p> : <>
              {mode !== 'recovery' && (
                <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} /></label>
              )}
              {mode !== 'forgot' && (
                <label>{mode === 'recovery' ? 'New password' : 'Password'}
                  <input type="password" required minLength={mode === 'login' ? undefined : 6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
                </label>
              )}
            </>}
            {!staffOnly && !signedIn && mode === 'signup' && <>
              <p>We use your email to confirm your account and help you recover access.</p>
              <PrivacyInformationLink />
            </>}
            <button className="booth-button" disabled={busy}>
              {busy ? 'Please wait…' : signedIn ? 'Sign out' : mode === 'forgot' ? 'Send reset link' : mode === 'recovery' ? 'Update password' : titles[mode]}
            </button>
            {!signedIn && mode === 'login' && <>
              {!staffOnly && <button type="button" className="booth-link" disabled={busy}
                onClick={() => choose('signup')}>Create an account</button>}
              <button type="button" className="booth-link" disabled={busy} onClick={() => choose('forgot')}>Forgot password?</button>
            </>}
            {['signup', 'forgot'].includes(mode) && (
              <button type="button" className="booth-link" disabled={busy} onClick={() => choose('login')}>Back to log in</button>
            )}
          </form>
        )}
        {!staffOnly && backupsEnabled && signedIn && <BackupInvitation key={user.id} owner={user.id} />}
        {(!staffOnly || signedIn) && <Link className="booth-link" to="/">{staffOnly ? 'Back to print orders' : 'Back to photo booth'}</Link>}
      </main>
    </div>
  );
}
