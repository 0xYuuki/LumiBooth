# LumiBooth

LumiBooth is a browser-based photo booth. Guests choose 1, 2, 3, 4, or 6 photos per strip, take their photos, and choose from 19 frame templates or customize with colors, patterns, and stickers. They can then download a PNG or print through the browser. Photos and edits stay in the active browser tab and are cleared when the guest finishes, cancels, returns to the start, or leaves the booth idle for five minutes. Downloaded images stay on the device.

## Run locally

Use Node.js 22.13 or newer in the 22.x series. From this directory, run:

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite and grant camera permission. The admin routes display demo data.

## Choose from gallery

- **Start photo booth** and **Choose from Gallery** open the same layout selection. After choosing a layout, the first opens the camera and the second opens an empty gallery/review page. Use **Add photos** to open the device picker.
- Step 2 shares camera and gallery/review views. Camera capture opens review when the strip is full. Add up to 12 photos from either source, select exactly the layout’s photo count, and reorder or remove photos before **Start editing**. Extra camera shots stay available as alternatives. Back arrows beside each step label preserve the active photos and design when returning to previous steps.
- Files larger than 20 MB are skipped with a message. Images are processed locally and downscaled to a maximum 2048-pixel edge for memory use. They are not uploaded unless the user later chooses an existing sharing feature.
- The source files are not edited. Canceling the picker returns to the home page; corrupt or unsupported images are reported and can be replaced.

## Adjust photos inside frames

In Step 3, tap a photo directly on the strip. Its enlarged adjustment view shows the whole image, dims the parts outside the frame opening, and exposes four corner handles at the current fit. Drag the image to reposition, pull a corner to resize proportionally, pinch on mobile, or use arrow keys and **Zoom**. **Fit image** brings all handles back into view without changing the crop. **Reset crop** restores the automatic fit; **Done**, Escape, or tapping outside closes the controls. The Photos tab is no longer needed. Originals stay unchanged, crops follow photos through review and reordering, and PNG/GIF exports use the same crop.

## Verify changes

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser tests use a simulated camera and check the built site, including image sticker export. The editor offers Emoji and seven image sticker packs under **Stickers**.

## Deploy

Set the hosting project directory to `lumibooth_web`. Run `npm ci` and `npm run build`, then serve `dist/` over HTTPS. Configure the host to return `index.html` for app routes such as `/camera` and `/admin/logs`, while serving built assets directly. For a deployment under a path prefix, pass it to the build, for example `npm run build -- --base=/LumiBooth/`. The router uses the same prefix. The host still needs a route fallback under that prefix.

The production build contains static files. A physical printer uses the operating system's browser print dialog.
