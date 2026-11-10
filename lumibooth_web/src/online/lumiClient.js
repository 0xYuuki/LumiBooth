import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_LUMI_SUPABASE_URL;
const key = import.meta.env.VITE_LUMI_SUPABASE_KEY;
export const printToPlayEnabled = Boolean(url && key && import.meta.env.VITE_LUMI_PRINT_QR === 'true');
export const remoteBoothEnabled = Boolean(url && key && import.meta.env.VITE_LUMI_REMOTE_BOOTH === 'true');
let client;
let signIn;

function supabase() {
  if (!url || !key) throw new Error('The online booth is unavailable.');
  return client ??= createClient(url, key);
}

async function guestSession() {
  const auth = supabase().auth;
  const { data } = await auth.getSession();
  if (data.session) return data.session;
  if (!signIn) {
    signIn = auth.signInAnonymously().then(({ data, error }) => {
      if (error || !data.session) throw new Error('Could not start an online guest session.');
      return data.session;
    }).finally(() => { signIn = null; });
  }
  return signIn;
}

export async function lumiRequest(action, data = {}, { public: isPublic = false, signal } = {}) {
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (!url || !key) throw new Error('The online booth is unavailable.');
  if (!isPublic) headers.Authorization = `Bearer ${(await guestSession()).access_token}`;
  const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/lumi`, {
    method: 'POST', headers, body: JSON.stringify({ action, ...data }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? 'The online booth could not respond. Try again.');
  return result;
}

export async function uploadMedia(ticket, blob) {
  if (!ticket.token) return;
  const { error } = await supabase().storage.from('lumi-media').uploadToSignedUrl(
    ticket.path, ticket.token, blob, { contentType: blob.type, cacheControl: '0' },
  );
  if (error && Number(error.statusCode) !== 409) throw new Error('Could not upload the media. Try again.');
}

export function subscribeRoom(id, onChange) {
  const source = supabase();
  const channel = source.channel(`lumi-room:${id}`, { config: { private: true } })
    .on('broadcast', { event: 'room' }, onChange).subscribe();
  return () => { void source.removeChannel(channel); };
}

export function publicLink(page, token) {
  const base = import.meta.env.VITE_LUMI_PUBLIC_URL || new URL(import.meta.env.BASE_URL, location.origin).href;
  return new URL(`${page}#${token}`, base.endsWith('/') ? base : `${base}/`).href;
}
