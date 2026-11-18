# LumiBooth

LumiBooth is a browser-based photo booth. Guests choose 1, 2, 3, 4, or 6 photos per strip, take their photos, and choose from 19 frame templates or customize with colors, patterns, and stickers. They can then download a PNG or print through the browser. Still photos, their order, crops and design are saved locally in this browser and restored after reopening. **Start fresh** clears the draft after confirmation. Browser storage restrictions or clearing site data can remove the saved draft. Motion buffers are released after five minutes of inactivity. Downloaded images stay on the device.

## Run locally

Use Node.js 22.13 or newer in the 22.x series. From this directory, run:

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite and grant camera permission. The admin routes display demo data.

## Choose from gallery

- **Create photo strip** opens the Photos workspace. Take photos or add from gallery, choose a layout inline, select and arrange up to 12 photos, then continue to Design and Save. Gallery imports suggest a fitting layout until you choose one manually. Five photos suggest six slots: add another or choose four favorites. Back from camera returns to Photos; Back from Photos returns Home. Home preserves the unfinished strip and offers **Continue your strip** and **Start fresh**, which confirms before clearing it.
- Files larger than 20 MB are skipped with a message. Images are processed locally and downscaled to a maximum 2048-pixel edge for memory use. They are not uploaded unless the user later chooses an existing sharing feature.
- The source files are not edited. Canceling the picker leaves the Photos workspace unchanged; corrupt or unsupported images are reported and can be replaced.

## Adjust photos inside frames

In Step 2, tap a photo directly on the strip. Its enlarged adjustment view shows the whole image, dims the parts outside the frame opening, and exposes four corner handles at the current fit. Drag the image to reposition, pull a corner to resize proportionally, pinch on mobile, or use arrow keys and **Zoom**. **Show full photo** fits the entire image within the opening and follows that photo when you switch frames. **Fill frame** brings back your previous zoom and position. **Fit image** brings all handles back into view without changing the crop. **Reset crop** restores the automatic fit; **Done**, Escape, or tapping outside closes the controls. The Photos tab is no longer needed. Originals stay unchanged, crops follow photos through review and reordering, and PNG/GIF exports use the same crop.

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

For Vercel, set the project root to `lumibooth_web`. The included
`vercel.json` sets the SPA fallback and security headers. Its Content
Security Policy allows connections to standard Supabase project domains
over HTTPS and secure WebSockets. Add the exact host to the policy if using
a custom Supabase domain. Check the deployed app's headers and camera,
download, printing, and enabled online features before release.

## Photo cards and editing workspace

Tap **Choose order**, then tap photos in sequence; numbered badges show their position in the strip. Tapping a selected photo deselects it. The X on each photo asks for confirmation before removing it. **Undo** restores recent selection, removal, layout, crop and design changes during the current session.

The editor keeps the preview and Frames / Stickers tabs visible while the controls scroll. A labeled frame-category dropdown matches the sticker-pack selector; caption and strip font sit after the frame/sticker controls. Save feedback reports when the local draft is saved or storage is unavailable.

## Your works

On the final preview screen, **Save to Your works** explicitly saves a completed strip. The home page links to the gallery, where the newest saves appear first. IndexedDB stores a thumbnail, the PNG, and the still photos and design settings needed to reopen editable work. Shared-room strips save as PNGs. Motion clips stay temporary. Deleting a gallery entry removes its local thumbnail, PNG, and project.

The current draft is stored separately. Opening a saved strip for editing asks before replacing an active draft. Edits can be saved as a new gallery entry. Gallery entries are available to guests and stay in the same browser profile. Clearing site data or browser storage limits can remove entries.

The production build caches the guest app and its static assets for offline use after an initial online visit. Serve `offline-worker.js` directly, alongside the built index. The worker caches app files, while photos and finished strips remain in IndexedDB.

## My Uploads

Open **My Uploads** from the home page to rename or delete locally stored
images. In Design, open **My stickers** or **My backgrounds**, then choose
**Upload your own** or preview an existing upload. Stickers use the standard
position, rotation, size, and layer controls. Backgrounds sit behind the
photos and artwork. Choose **Fill strip** or **Fit whole image** and adjust
horizontal and vertical position before applying.

Imports accept still PNG, JPEG, and WebP files up to 20 MiB and 32 megapixels.
The browser normalizes images to at most 2,048 pixels on their longest side
and preserves transparency. The library uses IndexedDB. Drafts and saved
editable strips embed their own copies, so deleting a library entry leaves
those projects intact. Clearing browser site data removes local uploads.
Standalone uploads remain on the device. If you explicitly back up a saved
strip, its embedded editing images are included with that strip.

When cloud backup is enabled, **My Uploads → Cloud backup** lets signed-in
users select stickers and backgrounds, confirm a private upload, and restore
them into My Uploads on another browser or device. The backup keeps the name
from the time it was made. Delete a cloud copy and back up again to replace
that snapshot. Deleting a cloud backup leaves local copies intact. Signing
in alone leaves uploads on the device.

## Privacy information

The home page, sign-up, private backup and QR confirmation link to the
in-app privacy information at `/legal`. Serve this path through the SPA
fallback. After owner approval, set `VITE_LUMI_PRIVACY_URL` and
`VITE_LUMI_TERMS_URL` to the HTTPS URLs of the published documents. Builds
without those values still show the in-app information.
