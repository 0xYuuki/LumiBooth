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
- Still photos, order, crops and design are saved in app-local storage and recovered after reopening. **Start fresh** clears the draft after confirmation. Sharing hands a temporary PNG to the platform and can create copies outside the app.

## Choose from gallery

- On Android, the system photo picker is used where available; on iOS, the native Photos picker opens. The platform picker may show only selected or limited photos, and cancelling returns to the booth without changing the camera flow.
- **Create photo strip** opens the Photos workspace. Take photos or add from gallery, choose a layout inline, select and arrange up to 12 photos, then continue to Design and Save. Gallery imports suggest a fitting layout until you choose one manually. Five photos suggest six slots: add another or choose four favorites. Back from camera returns to Photos; Back from Photos returns Home. Home preserves the unfinished strip and offers **Continue your strip** and **Start fresh**, which confirms before clearing it.
- Imported images are decoded to a maximum 1600-pixel edge to bound memory use while retaining the full photo composition for crop and frame changes. The source file is not modified.
- Import and editing work offline and do not upload photos. One still-photo draft is saved locally until starting fresh or clearing app data. Motion clips are temporary and are not recovered. Remote Booth is a separate online feature.
- If Android closes the app while the system picker is open, LumiBooth attempts to recover the picker result when the app restarts. Unsupported or damaged images are reported so they can be replaced.

## Adjust photos in frames

In Design, tap a photo directly on the strip. An enlarged adjustment view shows the whole image with the area outside the frame dimmed. Drag to reposition, pull one of four corner handles to resize proportionally, or pinch to zoom. **Show full photo** fits the entire image within the opening and follows that photo when you switch frames. **Fill frame** brings back your previous zoom and position. **Fit image** brings all handles back into view without changing the crop. **Reset crop** restores the automatic fit; **Done**, system Back, or tapping outside closes the controls. There is no Photos tab. Crops remain attached to their photos through review, reordering and frame changes. Originals stay unchanged, and the same crop is used for previews, PNG output, animated playback and GIF export.

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

## Photo cards and editing workspace

Tap **Choose order**, then tap photos in sequence; numbered badges show their position in the strip. Tapping a selected photo deselects it. The X on each photo asks for confirmation before removing it. **Undo** restores recent selection, removal, layout, crop and design changes during the current session.

The editor keeps the preview and Frames / Stickers tabs visible while the controls scroll. A labeled frame-category dropdown matches the sticker-pack selector; caption and strip font sit after the frame/sticker controls. Save feedback reports when the local draft is saved or storage is unavailable.

## Your works (mobile library)

On the finished preview, **Save to Your works** explicitly archives the still strip and its editable project on this device. Repeated taps on the same preview do not create duplicates. Export/share is a separate system action. Home shows a two-column grid below Create / Continue, with an optional list view; Me links to the same library. Tap a card for a full preview, or use its three-dot menu to Edit, Export/share, Print, or Delete with confirmation.

Opening an editable work replaces the active draft only after confirmation. Saving its edits creates a new work; the previous saved version stays intact. Each work owns its PNG, thumbnail and source project; deleting one removes only its local files. Completed works survive app restart and Start fresh. They are not uploaded, and uninstalling/clearing app data removes them. Motion clips are not archived. Shared Remote Booth strips support preview/export only. Missing or damaged files show a recoverable error and remain deletable. The library reports estimated space used; storage failures keep the current draft and offer a retry.


## My Uploads (mobile, local only)

Use **My stickers / Upload your own** in Stickers or **My backgrounds / Upload your own** in Frames. Me → My Uploads provides the same local library, with separate sticker/background types, recent sorting, previews, rename and confirmed delete. A background is drawn behind photos; it is not an overlay frame or photo mask. Use Fill strip, Fit whole image, or Reposition background to choose its composition. Transparent PNG/WebP stickers use the existing move, resize, rotate and remove controls.

Imports accept still PNG, JPEG and WebP, up to 20 MB and 32 megapixels, and normalize a private copy to a maximum 2048-pixel edge with a small thumbnail. Unsupported, animated, corrupt and oversized images produce an error. Android interrupted-picker recovery keeps custom uploads separate from booth photos.

Drafts and saved works embed their used uploaded images and transforms, so deleting a library upload leaves existing works editable. Starting fresh does not delete My Uploads. Clearing app data or uninstalling can remove local uploads; this is not a guaranteed backup. **My Uploads → Cloud backup** is available when private cloud backups are enabled. Sign in from Me, select the stickers or backgrounds to back up, and confirm. Restore adds a local copy on this or another device. The backup keeps its original name until you delete and back it up again. Deleting a cloud backup leaves device copies intact. Signing in alone leaves uploads on the device.

## Feedback

Guests can open **Me → Settings → Feedback** (also available from About LumiBooth). Choose Suggestion or Bug report, enter a 10–3,000 character message, and optionally provide a reply email. **Open email draft** launches the device's email app addressed to `alfortearjay0@gmail.com`; the user reviews and sends it there. LumiBooth never claims the draft was sent or delivered. The draft includes only the form fields, without photos, device logs, account identifiers or automatic attachments. Feedback form text is held only while the screen is open, with a prompt before leaving an unsent message.

If no email app can open, **Copy feedback instead** copies the report and destination for manual sending. Users can retry without losing their message. Operators may override the recipient at build time with `--dart-define=LUMIBOOTH_FEEDBACK_EMAIL=your-address@example.com`. No feedback backend or sign-in is required. The receiving email provider handles messages once sent; a formal privacy policy remains a separate tracked task.

## Privacy information

Guests can open **Me → Settings → Legal documents**. Sign-up, private backup
and QR confirmation link to the same information. After owner approval, build
with `--dart-define=LUMI_PRIVACY_URL=https://...` and
`--dart-define=LUMI_TERMS_URL=https://...` to link the published documents.
The in-app information and open-source licenses remain available without
those values.
