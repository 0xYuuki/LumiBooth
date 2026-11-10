# LumiBooth

LumiBooth is a browser-based photo booth. Take a series of webcam photos, decorate them with a frame and stickers, then download or print the finished photo strip.

## Quick start

You'll need Node.js 22.13 or later in the 22.x series, npm, and a browser with access to a webcam.

```sh
git clone https://github.com/0xYuuki/LumiBooth.git
cd LumiBooth/lumibooth_web
npm ci
npm run dev
```

Open the localhost address shown in the terminal and allow camera access when prompted.

## Make a photo strip

1. Select **Start photo booth** on the welcome screen.
2. Choose **1, 2, 3, 4, or 6 photos** per strip. Two and three photos stack vertically. Four and six use a two-column grid.
3. Select **Take photo** for each shot. Use **Timer** to cycle through 3, 5, and 10 seconds or turn it off. The camera uses a fixed 4:3 view. After the last photo, the editor opens and automatically crops each photo to fill the frame you choose.
   LumiBooth automatically keeps up to five silent seconds before each shutter. If the buffer is still filling, the shutter waits for the remaining time. A longer timer still applies. On the finish screen, select **Play strip** to see motion inside the frame or **Save animated strip** to save the decorated strip as a GIF. You can also play and export a GIF by shot number. Unsaved clips are cleared when you leave the app or end the session.
4. Under **Frames → Illustrated**, try Tube TV, Camera Film, Vinyl Instant, Love Scrapbook, or Retro Zine. Find 14 more designs under **Templates**. You can also choose a solid color, gradient, or pattern. Under **Stickers**, pick Emoji or one of seven image packs, then select a sticker. Drag it to move it and use its corner handles to resize or rotate it. On web, you can also focus it and use the arrow keys to move it. The optional caption below LumiBooth can be edited up to 32 characters, removed, or reset to the frame caption. **Strip font** applies your choice to both the name and the caption.
5. Select **Next** to see the finished strip. Choose **Save to Device** to download a PNG, **Print Photo** to open your browser's print dialog, or **Edit Strip** to make another change. Select **Finish Session** when you're done.

Photos and edits are held in the active tab. Finishing, cancelling, returning to the welcome screen, reloading, or leaving the booth idle for five minutes clears the active session. Save your strip before you leave. A downloaded PNG stays on your device.

## Online booth options

- Select **Share with QR** to display a gallery code or **Print with QR** to put it on paper. After you confirm the upload, anyone with the code can view and download the original JPEGs, finished PNG, and animated GIF when available. Links expire after 90 days. Use **Manage gallery links** on the device that uploaded the photos to revoke access early.
- **Booth with a friend** lets two devices take three pairs of stills with shared countdowns. Send the invite link and mark both devices ready. Each round gets one frame with the host on the left and the guest on the right. The host can customize the Tube TV design and send the finished strip. Both guests can save or print it before the room expires in one hour.

[Watch the Booth with a Friend demo](docs/lumibooth-booth-with-a-friend-demo.mp4) to see the invite, three shared countdowns, and the finished Tube TV strip.

These options require a configured [Supabase backend](supabase/README.md). Ordinary capture, saving, and printing work without it.

## Camera troubleshooting

- **Permission denied.** Allow camera access in your browser's site settings, then select **Retry camera**.
- **Camera unavailable.** Check that the webcam is connected and close other apps that may be using it. Open the booth from `localhost` during development or use HTTPS on a deployed site.
- **Printing.** Choose your printer and paper settings in the browser print dialog. You can also save the PNG for printing later.

## Development and deployment

The React/Vite app lives in [`lumibooth_web/`](lumibooth_web/). The guest flow begins at `/`. The `/admin` screens display demo data.

See the [developer and deployment guide](lumibooth_web/README.md) for linting, browser tests, production builds, and static hosting configuration.

## Mobile app

The [Flutter mobile app](lumibooth_mobile/README.md) brings the guest photo booth flow to Android and iOS, including native camera capture, frame templates, PNG sharing, and printing.
