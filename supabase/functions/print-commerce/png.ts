export class PrintError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const crcTable = Uint32Array.from({ length: 256 }, (_, initial) => {
  let crc = initial;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc;
});
const colourChunks = new Map([['sRGB', 1], ['gAMA', 4], ['cHRM', 32]]);
const invalid = () => new PrintError(422, 'Choose a valid still RGB or RGBA PNG.');

function checksum(bytes: Uint8Array, start: number, end: number) {
  let crc = 0xffffffff;
  for (let index = start; index < end; index++) {
    crc = crcTable[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new PrintError(413, 'Request too large.');
  if (!request.body) throw new PrintError(400, 'A request body is required.');
  const reader = request.body.getReader();
  const bytes = new Uint8Array(limit);
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > limit) throw new PrintError(413, 'Request too large.');
      bytes.set(value, size);
      size += value.byteLength;
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return bytes.subarray(0, size);
}

async function validateScanlines(data: Uint8Array<ArrayBuffer>[], stride: number, height: number) {
  const reader = new Blob(data).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const expected = stride * height;
  let read = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (read + value.length > expected) throw invalid();
      for (let index = (stride - read % stride) % stride; index < value.length; index += stride) {
        if (value[index] > 4) throw invalid();
      }
      read += value.length;
    }
    if (read !== expected) throw invalid();
  } catch {
    throw invalid();
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Preserve pixels and basic colour information. Drop ancillary metadata before storage.
export async function validatedPrintPng(bytes: Uint8Array<ArrayBuffer>, width: number, height: number) {
  if (!signature.every((byte, index) => bytes[index] === byte)) throw invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array<ArrayBuffer>[] = [signature];
  const compressed: Uint8Array<ArrayBuffer>[] = [];
  const colours = new Set<string>();
  let arrivedAtEnd = false;
  let finishedImageData = false;
  let stride = 0;
  let chunks = 0;
  for (let offset = signature.length; offset < bytes.length;) {
    if (++chunks > 8192 || bytes.length - offset < 12) throw invalid();
    const length = view.getUint32(offset);
    const start = offset + 8;
    if (length > bytes.length - offset - 12) throw invalid();
    const end = start + length;
    const kind = String.fromCharCode(...bytes.subarray(offset + 4, start));
    if (!/^[a-zA-Z]{4}$/.test(kind) ||
        checksum(bytes, offset + 4, end) !== view.getUint32(end)) throw invalid();

    if (offset === signature.length) {
      if (kind !== 'IHDR' || length !== 13) throw invalid();
      const actualWidth = view.getUint32(start);
      const actualHeight = view.getUint32(start + 4);
      if (actualWidth !== width || actualHeight !== height) {
        throw new PrintError(422, `Print PNG must be ${width} × ${height} pixels.`);
      }
      const colour = bytes[start + 9];
      if (bytes[start + 8] !== 8 || (colour !== 2 && colour !== 6) ||
          bytes[start + 10] || bytes[start + 11] || bytes[start + 12]) throw invalid();
      stride = width * (colour === 6 ? 4 : 3) + 1;
      kept.push(bytes.subarray(offset, end + 4));
    } else if (kind === 'IDAT') {
      if (finishedImageData) throw invalid();
      compressed.push(bytes.subarray(start, end));
      kept.push(bytes.subarray(offset, end + 4));
    } else if (kind === 'IEND') {
      if (length !== 0 || end + 4 !== bytes.length || !compressed.length) throw invalid();
      kept.push(bytes.subarray(offset, end + 4));
      arrivedAtEnd = true;
    } else {
      if (compressed.length) finishedImageData = true;
      if (kind === 'acTL' || kind === 'tRNS' || /^[A-Z]/.test(kind)) throw invalid();
      if (colourChunks.has(kind)) {
        if (length !== colourChunks.get(kind) || colours.has(kind) || finishedImageData) throw invalid();
        colours.add(kind);
        kept.push(bytes.subarray(offset, end + 4));
      }
    }
    offset = end + 4;
  }
  if (!arrivedAtEnd) throw invalid();
  await validateScanlines(compressed, stride, height);
  return new Blob(kept, { type: 'image/png' });
}
