import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const media = db.storage.from('lumi-media');
const allowedOrigin = Deno.env.get('LUMI_WEB_ORIGIN');
const publicStorageUrl = Deno.env.get('LUMI_PUBLIC_SUPABASE_URL');
const cleanupSecret = Deno.env.get('LUMI_CLEANUP_SECRET');
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/;
const opaque = /^[\da-f]{48}$/;
const type = {
  png: { mime: 'image/png', magic: [137, 80, 78, 71, 13, 10, 26, 10], max: 8 * 1024 * 1024 },
  gif: { mime: 'image/gif', magic: [71, 73, 70, 56], max: 16 * 1024 * 1024 },
  jpg: { mime: 'image/jpeg', magic: [255, 216, 255], max: 1024 * 1024 },
};

class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function value<T>({ data, error }: { data: T; error: unknown }): NonNullable<T> {
  if (error || data == null) throw new ApiError(503, 'Online service is temporarily unavailable.');
  return data;
}

function requireId(input: unknown) {
  if (typeof input !== 'string' || !uuid.test(input)) throw new ApiError(400, 'Invalid identifier.');
  return input;
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const token = () => hex(crypto.getRandomValues(new Uint8Array(24)));
async function hash(input: unknown) {
  if (typeof input !== 'string' || !opaque.test(input)) throw new ApiError(404, 'Link unavailable.');
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))));
}

async function upload(path: string) {
  if ((await media.info(path)).data) return { path, token: null };
  const ticket = value(await media.createSignedUploadUrl(path));
  return { path, token: ticket.token };
}

async function signed(path: string, expiresAt: string, internal = false) {
  const seconds = Math.min(60, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  if (seconds < 1) throw new ApiError(404, 'Link unavailable.');
  const signedUrl = value(await media.createSignedUrl(path, seconds)).signedUrl;
  if (internal || !publicStorageUrl) return signedUrl;
  const address = new URL(signedUrl);
  return new URL(address.pathname + address.search, publicStorageUrl).href;
}

async function validate(path: string, extension: keyof typeof type, expiresAt: string) {
  const { mime, magic, max } = type[extension];
  const { data } = await media.info(path);
  if (!data?.size || data.size > max || data.contentType !== mime) throw new ApiError(409, 'The upload is missing or invalid.');
  const response = await fetch(await signed(path, expiresAt, true), { headers: { Range: 'bytes=0-7' } });
  if (!response.ok || !response.body) throw new ApiError(409, 'The upload is unavailable.');
  const reader = response.body.getReader();
  const prefix: number[] = [];
  try {
    while (prefix.length < magic.length) {
      const chunk = await reader.read();
      if (chunk.done) break;
      prefix.push(...chunk.value.subarray(0, magic.length - prefix.length));
    }
  } finally {
    await reader.cancel();
  }
  if (!magic.every((byte, index) => prefix[index] === byte)) throw new ApiError(409, 'The uploaded file has the wrong format.');
}

const shotPath = (id: string, round: number, attempt: string, role: string) => `${id}/${round}-${attempt}-${role}.jpg`;
const posterPath = (id: string) => `${id}/poster.png`;
const motionPath = (id: string) => `${id}/motion.gif`;
const originalPath = (id: string, index: number) => `${id}/original-${index + 1}.jpg`;
const finalPath = (id: string, asset: string) => `${id}/finished-${asset}.png`;

function galleryAssets(id: string, count: number, motion: boolean) {
  return {
    poster: posterPath(id),
    motion: motion ? motionPath(id) : null,
    originals: Array.from({ length: count }, (_, index) => originalPath(id, index)),
  };
}

async function galleryUploads(id: string, count: number, hasMotion: boolean) {
  const paths = galleryAssets(id, count, hasMotion);
  const [poster, motion, originals] = await Promise.all([
    upload(paths.poster),
    paths.motion && upload(paths.motion),
    Promise.all(paths.originals.map(upload)),
  ]);
  return { poster, motion, originals };
}

async function roomAction(id: string, user: string, command: string, ready: boolean | null, attempt: string | null, round: number | null = null) {
  const { data, error } = await db.rpc('lumi_room_action', {
    room_id: id, caller: user, command, ready, shot_attempt: attempt, known_round: round,
  });
  if (error?.code === 'P0001') throw new ApiError(409, error.message);
  return value({ data, error });
}

async function clearFolder(id: string) {
  // Flat folder, with names issued only by this function.
  for (;;) {
    const files = value(await media.list(id, { limit: 100 }));
    if (!files.length) return;
    value(await media.remove(files.map(({ name }) => `${id}/${name}`)));
  }
}

async function cleanup() {
  const now = new Date().toISOString();
  for (const table of ['lumi_rooms', 'lumi_shares']) {
    // Leave a tombstone until any previously issued upload tickets have expired.
    const horizon = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    for (const old of [true, false]) {
      const query = db.from(table).select('id').lt('expires_at', old ? horizon : now);
      const rows = value(await (old ? query : query.gte('expires_at', horizon)
        .order('cleaned_at', { ascending: true, nullsFirst: true })).limit(40));
      for (let index = 0; index < rows.length; index += 8) {
        await Promise.all(rows.slice(index, index + 8).map(async ({ id }) => {
          await clearFolder(id);
          const result = old ? await db.from(table).delete().eq('id', id)
            : await db.from(table).update({ cleaned_at: now }).eq('id', id);
          if (result.error) throw result.error;
        }));
      }
    }
  }
  return { ok: true };
}

async function action(input: Record<string, unknown>, request: Request) {
  const name = input.action;
  const now = new Date().toISOString();
  if (name === 'cleanup') {
    if (!cleanupSecret || request.headers.get('x-lumi-cleanup') !== cleanupSecret) throw new ApiError(403, 'Access denied.');
    return cleanup();
  }
  if (name === 'share_resolve') {
    const digest = await hash(input.token);
    const { data, error } = await db.from('lumi_shares').select('id,expires_at,original_count,has_motion')
      .eq('token_hash', digest).eq('published', true).gt('expires_at', now).maybeSingle();
    if (error) throw new ApiError(503, 'Playback is temporarily unavailable.');
    if (!data) throw new ApiError(404, 'This strip has expired or was removed.');
    const paths = galleryAssets(data.id, data.original_count, data.has_motion);
    const [poster, motion, originals] = await Promise.all([
      signed(paths.poster, data.expires_at),
      paths.motion && signed(paths.motion, data.expires_at),
      Promise.all(paths.originals.map((path) => signed(path, data.expires_at))),
    ]);
    return { poster, motion, originals, expiresAt: data.expires_at };
  }
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new ApiError(401, 'Guest session required.');
  const { data: auth } = await db.auth.getUser(authorization.slice(7));
  const user = auth.user?.id;
  if (!user) throw new ApiError(401, 'Guest session expired. Try again.');

  if (name === 'share_begin') {
    const originals = input.originals ?? 0;
    const hasMotion = input.hasMotion ?? true;
    if (typeof originals !== 'number' || ![0, 1, 2, 3, 4, 6].includes(originals)
      || typeof hasMotion !== 'boolean') throw new ApiError(400, 'Invalid gallery contents.');
    const { count, error } = await db.from('lumi_shares').select('id', { count: 'exact', head: true })
      .eq('owner', user).gt('expires_at', now);
    if (error) throw new ApiError(503, 'Online service is temporarily unavailable.');
    if ((count ?? 0) >= 20) throw new ApiError(429, 'Too many active links. Remove one and try again.');
    const secret = token();
    const { id } = value(await db.from('lumi_shares').insert({
      owner: user, token_hash: await hash(secret), original_count: originals, has_motion: hasMotion,
    }).select('id').single());
    return { id, token: secret, ...await galleryUploads(id, originals, hasMotion) };
  }
  if (name === 'share_list') {
    return value(await db.from('lumi_shares').select('id,created_at,expires_at')
      .eq('owner', user).eq('published', true).gt('expires_at', now).order('created_at', { ascending: false }));
  }
  if (name === 'share_publish' || name === 'share_revoke' || name === 'share_uploads') {
    const id = requireId(input.id);
    const { data: share } = await db.from('lumi_shares').select('published,expires_at,original_count,has_motion').eq('id', id)
      .eq('owner', user).gt('expires_at', now).maybeSingle();
    if (!share) throw new ApiError(404, 'This strip has expired or was removed.');
    if (name === 'share_uploads') return share.published ? { published: true }
      : galleryUploads(id, share.original_count, share.has_motion);
    if (name === 'share_revoke') {
      value(await db.from('lumi_shares').update({ expires_at: now }).eq('id', id).eq('owner', user).select('id').single());
      return { ok: true };
    }
    if (share.published) return { expiresAt: share.expires_at };
    const paths = galleryAssets(id, share.original_count, share.has_motion);
    await Promise.all([
      validate(paths.poster, 'png', share.expires_at),
      paths.motion && validate(paths.motion, 'gif', share.expires_at),
      ...paths.originals.map((path) => validate(path, 'jpg', share.expires_at)),
    ]);
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await db.from('lumi_shares').update({ published: true, expires_at: expiresAt })
      .eq('id', id).eq('owner', user).eq('published', false).gt('expires_at', now).select('expires_at').maybeSingle();
    if (!data) throw new ApiError(409, 'The link changed. Try again.');
    return { expiresAt: data.expires_at };
  }

  if (name === 'room_begin') {
    const { count, error } = await db.from('lumi_rooms').select('id', { count: 'exact', head: true })
      .eq('host', user).gt('expires_at', now);
    if (error) throw new ApiError(503, 'Online service is temporarily unavailable.');
    if ((count ?? 0) >= 3) throw new ApiError(429, 'Too many active rooms. Close one and try again.');
    const invite = token();
    const room = value(await db.from('lumi_rooms').insert({ host: user, invite_hash: await hash(invite) }).select('id').single());
    return { id: room.id, invite };
  }
  if (name === 'room_join') {
    const digest = await hash(input.token);
    const { data, error } = await db.from('lumi_rooms').update({ guest: user, state: 'capture', revision: 1 })
      .eq('invite_hash', digest).neq('host', user).is('guest', null).eq('state', 'waiting')
      .gt('expires_at', now).select('id').maybeSingle();
    if (error) throw new ApiError(503, 'Online service is temporarily unavailable.');
    if (data) return data;
    const { data: existing } = await db.from('lumi_rooms').select('id').eq('invite_hash', digest)
      .eq('guest', user).neq('state', 'cancelled').gt('expires_at', now).maybeSingle();
    if (existing) return existing;
    throw new ApiError(404, 'This invite is used, expired, or belongs to this device.');
  }
  if (typeof name !== 'string' || !name.startsWith('room_')) throw new ApiError(400, 'Unknown action.');
  const id = requireId(input.id);
  const command = name.slice(5);
  const ready = typeof input.ready === 'boolean' ? input.ready : null;
  const attempt = input.attempt == null ? null : requireId(input.attempt);
  if (command === 'shot' || command === 'finish') {
    const room = await roomAction(id, user, 'sync', null, null);
    if (command === 'shot' && room.attempt === attempt) {
      await validate(shotPath(id, room.round, attempt!, room.role), 'jpg', room.expiresAt);
    }
    if (command === 'finish' && room.role === 'host' && room.state === 'design') {
      await validate(finalPath(id, requireId(attempt)), 'png', room.expiresAt);
    }
  }
  const round = typeof input.round === 'number' && Number.isInteger(input.round) && input.round >= 1 && input.round <= 3
    ? input.round : null;
  const room = await roomAction(id, user, command, ready, attempt, round);
  if (command === 'upload') return upload(shotPath(id, room.round, attempt!, room.role));
  if (command === 'prepare_final') {
    if (room.state === 'complete') return { complete: true };
    const asset = crypto.randomUUID();
    return { asset, ...await upload(finalPath(id, asset)) };
  }
  if (room.state === 'design' && room.role === 'host' && input.assets === true) {
    room.photos = await Promise.all([1, 2, 3].flatMap((round) => ['host', 'guest'].map((role) =>
      signed(shotPath(id, round, room.shots[`${round}:${role}`], role), room.expiresAt))));
  }
  if (room.state === 'complete' && input.assets === true) room.poster = await signed(finalPath(id, room.finishedAsset), room.expiresAt);
  delete room.shots;
  delete room.finishedAsset;
  return room;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
  if (allowedOrigin && origin && origin !== allowedOrigin) return new Response(null, { status: 403 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers });
  try {
    const raw = await request.text();
    if (raw.length > 2048) throw new ApiError(413, 'Request too large.');
    let input;
    try { input = JSON.parse(raw); } catch { throw new ApiError(400, 'Invalid request.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Invalid request.');
    return Response.json(await action(input, request), { headers });
  } catch (error) {
    if (!(error instanceof ApiError)) console.error('LumiBooth service operation failed');
    return Response.json({ error: error instanceof ApiError ? error.message : 'Online service is temporarily unavailable.' },
      { status: error instanceof ApiError ? error.status : 503, headers });
  }
});
