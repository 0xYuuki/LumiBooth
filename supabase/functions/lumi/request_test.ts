import { ApiError, readRequestObject } from './request.ts';

Deno.test('request reader accepts JSON objects within the byte limit', async () => {
  const request = new Request('https://example.test', {
    method: 'POST',
    body: '{"action":"room_sync"}',
  });
  const input = await readRequestObject(request);
  if (input.action !== 'room_sync') throw new Error('Action was not preserved.');
});

Deno.test('request reader rejects oversized UTF-8 bodies without a length header', async () => {
  const request = new Request('https://example.test', {
    method: 'POST',
    body: JSON.stringify({ value: 'é'.repeat(1200) }),
  });
  try {
    await readRequestObject(request);
  } catch (error) {
    if (error instanceof ApiError && error.status === 413) return;
    throw error;
  }
  throw new Error('Oversized body was accepted.');
});
