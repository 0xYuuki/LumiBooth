# LumiBooth Mobile

A Flutter photo booth for Android and iOS. Choose a layout with 1, 2, 3, 4, or 6 photos, capture them with the device camera, then decorate the strip with one of 19 frames, including Tube TV, Camera Film, Vinyl Instant, Love Scrapbook, and Retro Zine. Tap to add a sticker, drag it into place, and use the size control to resize it.

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
- Select **Preview strip** to render a PNG. **Save or share PNG** opens the system share sheet, where the available save destinations depend on the device. **Print photo** opens the system print interface.
- Photos stay in the active session. **End session**, leaving the session, or five minutes of inactivity releases the session images. Sharing hands a temporary PNG to the platform and can create copies outside the app.

## Verify and build

```sh
flutter analyze
flutter test
flutter build apk --debug
```

The tests cover layout selection, the three-photo transition to editing, and PNG dimensions and frame color. For a release, configure your own application identifier and signing credentials. On macOS, use `flutter build ios --no-codesign` for an unsigned build check or follow the Xcode signing workflow for distribution.
