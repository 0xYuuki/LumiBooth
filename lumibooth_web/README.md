# LumiBooth

LumiBooth is a browser-based photo booth. Guests choose 1, 2, 3, 4, or 6 photos per strip, take their photos, and choose from 19 frame templates or customize with colors, patterns, and stickers. They can then download a PNG or print through the browser. Photos and edits stay in the active browser tab and are cleared when the guest finishes, cancels, returns to the start, or leaves the booth idle for five minutes. Downloaded images stay on the device.

## Run locally

Use Node.js 22.13 or newer in the 22.x series. From this directory, run:

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite and grant camera permission. The admin routes display demo data.

## Verify changes

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser tests use a simulated camera and check the built site.

## Deploy

Set the hosting project directory to `lumibooth_web`. Run `npm ci` and `npm run build`, then serve `dist/` over HTTPS. Configure the host to return `index.html` for app routes such as `/camera` and `/admin/logs`, while serving built assets directly. For a deployment under a path prefix, pass it to the build, for example `npm run build -- --base=/LumiBooth/`. The router uses the same prefix. The host still needs a route fallback under that prefix.

The production build contains static files. A physical printer uses the operating system's browser print dialog.
