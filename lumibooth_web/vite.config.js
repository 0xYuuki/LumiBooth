import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function offlineGuestPages() {
  return {
    name: 'lumibooth-offline-guest-pages',
    apply: 'build',
    async writeBundle({ dir }) {
      const workerName = 'offline-worker.js';
      const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name !== workerName && !entry.name.endsWith('.map'))
        .map(entry => join(entry.parentPath, entry.name).slice(dir.length + 1).replaceAll('\\', '/'))
        .sort();
      const worker = await readFile(new URL('./offline-worker.js', import.meta.url), 'utf8');
      const hash = createHash('sha256').update(worker);
      for (const file of files) hash.update(file).update(await readFile(join(dir, file)));
      const manifest = JSON.stringify({ files, version: hash.digest('hex').slice(0, 16) });
      await writeFile(join(dir, workerName), `const offlineBuild = ${manifest};\n${worker}`);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'staff' ? [react()] : [react(), offlineGuestPages()],
  build: { outDir: mode === 'staff' ? 'dist-staff' : 'dist' },
}));
