# LumiBooth Mobile

A Flutter photo booth for Android and iOS. Choose a layout with 1, 2, 3, 4, or 6 photos, capture them with the device camera or choose existing photos from your gallery, then decorate the strip with one of 19 frames, including Tube TV, Camera Film, Vinyl Instant, Love Scrapbook, and Retro Zine. Choose Emoji or one of seven image packs. Tap a sticker to add it, drag it into place, and use its corner handles to resize or rotate it. Edit the optional caption under LumiBooth with up to 32 characters, or remove it. **Strip font** applies your choice to both the name and the caption.

## Run on a phone

Use Flutter 3.47.9 or a compatible newer SDK. Android requires the Android SDK and an Android 7.0 or newer device. iOS requires macOS, Xcode, and an iOS 15 or newer device. A phone with a working camera is recommended for the capture flow.

From the repository root:

```sh
cd lumibooth_mobile
flutter doctor
flutter pub get
flutter devices
flutter run
```

Select your phone if Flutter lists multiple devices. For iOS, configure a signing team in Xcode before installing on a physical device. For Android, enable USB debugging if using a USB connection.

## Navigation and guest profile

- **Photo tab:** The main photo booth experience is immediately available with one tap and no login required. Active camera capture and strip editing states are preserved when switching tabs.
- **Me tab:** Minimal guest profile view highlighting local-first privacy, session lifetime, and quick access to photo booth actions and gallery link management.
- **Settings:** Accessible from the top right of the Me tab. Features camera framing and timer details, image memory cache controls, online backend status, privacy/terms and feedback deferrals, and transparent information for upcoming features (no paywalls or fake subscriptions).

## Capture and export

- Allow camera access when prompted. If access is denied, enable Camera in the device's app settings and tap **Retry camera**.
- The timer cycles through off, 3, 5, and 10 seconds. A camera switch is available when both front and rear cameras are detected.
- The camera uses a fixed 4:3 view. Choose a frame after taking your photos, and the editor crops them to fill each opening without stretching.
- Select **Preview strip** to render a PNG. **Save or share PNG** opens the system share sheet, where the available save destinations depend on the device. **Print photo** opens the system print interface.
- Photos stay in the active session. **End session**, leaving the session, or five minutes of inactivity releases the session images. Sharing hands a temporary PNG to the platform and can create copies outside the app.

## Choose from gallery

- On Android, the system photo picker is used where available; on iOS, the native Photos picker opens. The platform picker may show only selected or limited photos, and cancelling returns to the booth without changing the camera flow.
- Both **Start photo booth** and **Choose from gallery** open the same layout picker first. Gallery then opens an empty review page with **Add photos**; camera capture opens that same review page when the layout is filled. Mix gallery photos and camera shots, choose favorites, reorder selected shots, and remove unwanted ones before editing. The editor opens only when the selected count matches the layout. Back arrows beside the step label preserve the active photos, layout and design.
- Imported images are decoded to a maximum 1600-pixel edge to bound memory use while retaining the full photo composition for crop and frame changes. The source file is not modified.
- Import and editing work offline and do not upload photos. Gallery selection is temporary: photos are released when the session ends or after five minutes of inactivity. Remote Booth is a separate online feature.
- If Android closes the app while the system picker is open, LumiBooth attempts to recover the picker result when the app restarts. Unsupported or damaged images are reported so they can be replaced.

## Adjust photos in frames

In Design, tap a photo directly on the strip. An enlarged adjustment view shows the whole image with the area outside the frame dimmed. Drag to reposition, pull one of four corner handles to resize proportionally, or pinch to zoom. **Fit image** brings all handles back into view without changing the crop. **Reset crop** restores the automatic fit; **Done**, system Back, or tapping outside closes the controls. There is no Photos tab. Crops remain attached to their photos through review, reordering and frame changes. Originals stay unchanged, and the same crop is used for previews, PNG output, animated playback and GIF export.

## Motion photos

LumiBooth automatically keeps up to five silent seconds before each shutter. If the buffer is still filling, the shutter waits for the remaining time. A longer timer still applies. Select **Play strip** on the finish screen to play motion inside the frame. Select **Save or share animated strip** to save a GIF with the frame, stickers, and caption. You can also play or share the GIF for each shot. If the camera stream is interrupted, the shot may have a shorter clip or only a still. Unsaved motion is cleared when the app moves to the background or the session ends.

With the [online backend configured](../supabase/README.md), select **Share with QR** to show a download gallery on screen or **Print with QR** to include it on paper. The gallery contains the undecorated JPEGs, finished PNG, and animated GIF when available. Select **Booth with a friend** to create a remote room or paste an invite link. The shared strip starts with three Tube TVs, each showing the host and guest side by side from the same round.

## Verify and build

```sh
flutter analyze
flutter test
flutter build apk --debug
```

The tests cover the shared layout and review flow, camera alternatives, back navigation, crop gestures and persistence, PNG/GIF crop pixels, artwork, stickers, and session cleanup. For a release, configure your own application identifier and signing credentials. On macOS, use `flutter build ios --no-codesign` for an unsigned build check or follow the Xcode signing workflow for distribution.
