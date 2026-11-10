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
3. Select **Take photo** for each shot. Use **Timer** to cycle through 3, 5, and 10 seconds or turn it off. The editor opens after the last photo.
4. Under **Frames → Illustrated**, try Tube TV, Camera Film, Vinyl Instant, Love Scrapbook, or Retro Zine. Find 14 more designs under **Templates**. You can also choose a solid color, gradient, or pattern. Drag stickers into position or focus a sticker and use the arrow keys to move it.
5. Select **Next** to see the finished strip. Choose **Save to Device** to download a PNG, **Print Photo** to open your browser's print dialog, or **Edit Strip** to make another change. Select **Finish Session** when you're done.

Photos and edits are held in the active tab. Finishing, cancelling, returning to the welcome screen, reloading, or leaving the booth idle for five minutes clears the active session. Save your strip before you leave. A downloaded PNG stays on your device.

## Camera troubleshooting

- **Permission denied.** Allow camera access in your browser's site settings, then select **Retry camera**.
- **Camera unavailable.** Check that the webcam is connected and close other apps that may be using it. Open the booth from `localhost` during development or use HTTPS on a deployed site.
- **Printing.** Choose your printer and paper settings in the browser print dialog. You can also save the PNG for printing later.

## Development and deployment

The React/Vite app lives in [`lumibooth_web/`](lumibooth_web/). The guest flow begins at `/`. The `/admin` screens display demo data.

See the [developer and deployment guide](lumibooth_web/README.md) for linting, browser tests, production builds, and static hosting configuration.

## Mobile app

The [Flutter mobile app](lumibooth_mobile/README.md) brings the guest photo booth flow to Android and iOS, including native camera capture, frame templates, PNG sharing, and printing.
