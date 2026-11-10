# LumiBooth Mobile

A Flutter photo booth for Android and iOS. Choose a layout with 1, 2, 3, 4, or 6 photos, capture them with the device camera, then decorate the strip with one of 19 frames, including Tube TV, Camera Film, Vinyl Instant, Love Scrapbook, and Retro Zine. Choose Emoji or one of seven image packs. Tap a sticker to add it, drag it into place, and use its corner handles to resize or rotate it. Edit the optional caption under LumiBooth with up to 32 characters, or remove it. **Strip font** applies your choice to both the name and the caption.

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

## Capture and export

- Allow camera access when prompted. If access is denied, enable Camera in the device's app settings and tap **Retry camera**.
- The timer cycles through off, 3, 5, and 10 seconds. A camera switch is available when both front and rear cameras are detected.
- The camera uses a fixed 4:3 view. Choose a frame after taking your photos, and the editor crops them to fill each opening without stretching.
- Select **Preview strip** to render a PNG. **Save or share PNG** opens the system share sheet, where the available save destinations depend on the device. **Print photo** opens the system print interface.
- Photos stay in the active session. **End session**, leaving the session, or five minutes of inactivity releases the session images. Sharing hands a temporary PNG to the platform and can create copies outside the app.

## Motion photos

LumiBooth automatically keeps up to five silent seconds before each shutter. If the buffer is still filling, the shutter waits for the remaining time. A longer timer still applies. Select **Play strip** on the finish screen to play motion inside the frame. Select **Save or share animated strip** to save a GIF with the frame, stickers, and caption. You can also play or share the GIF for each shot. If the camera stream is interrupted, the shot may have a shorter clip or only a still. Unsaved motion is cleared when the app moves to the background or the session ends.

With the [online backend configured](../supabase/README.md), select **Share with QR** to show a download gallery on screen or **Print with QR** to include it on paper. The gallery contains the undecorated JPEGs, finished PNG, and animated GIF when available. Select **Booth with a friend** to create a remote room or paste an invite link. The shared strip starts with three Tube TVs, each showing the host and guest side by side from the same round.

## Verify and build

```sh
flutter analyze
flutter test
flutter build apk --debug
```

The tests cover layout selection, the three-photo transition to editing, and PNG dimensions and frame color. For a release, configure your own application identifier and signing credentials. On macOS, use `flutter build ios --no-codesign` for an unsigned build check or follow the Xcode signing workflow for distribution.
