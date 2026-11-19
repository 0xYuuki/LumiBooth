export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const maxRequestBytes = 2048;

export async function readRequestObject(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length')) > maxRequestBytes) {
    throw new ApiError(413, 'Request too large.');
  }
  if (!request.body) throw new ApiError(400, 'Invalid request.');

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let raw = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxRequestBytes) throw new ApiError(413, 'Request too large.');
      raw += decoder.decode(value, { stream: true });
    }
    const input = JSON.parse(raw + decoder.decode());
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ApiError(400, 'Invalid request.');
    }
    return input;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Invalid request.');
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
