import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as image;
import 'package:lumibooth_mobile/motion_strip_export.dart';
import 'package:lumibooth_mobile/strip.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'animated export preserves frame artwork and puts motion in the opening',
    () async {
      final recorder = ui.PictureRecorder();
      ui.Canvas(recorder)
          .drawColor(const ui.Color(0xff1a991a), ui.BlendMode.src);
      final picture = recorder.endRecording();
      final still = await picture.toImage(16, 12);
      picture.dispose();
      addTearDown(still.dispose);

      final artwork = await FrameImages.load(StripFrame.tubeTV.art!);
      addTearDown(artwork.dispose);
      final clip = image.GifEncoder();
      for (final (r, b) in [(255, 0), (0, 255)]) {
        final frame = image.Image(width: 16, height: 12);
        for (final pixel in frame) {
          pixel.setRgb(r, 0, b);
        }
        clip.addFrame(frame, duration: 12);
      }
      final design = StripDesign(
        layout: StripLayout.choices.first,
        frame: StripFrame.tubeTV,
        frameImages: artwork,
        photos: [still],
        caption: 'Studio night',
      );
      final output = await exportMotionStrip(design, {
        1: clip.finish()!,
      }, active: () => true);
      final gif = image.decodeGif(output)!;
      expect(gif.numFrames, 2);
      expect(
        gif.frames.fold<int>(0, (sum, frame) => sum + frame.frameDuration),
        240,
      );
      final first = gif.frames.first;
      final last = gif.frames.last;
      final firstCenter = first.getPixel(192, 180);
      final lastCenter = last.getPixel(192, 180);
      expect(firstCenter.r, greaterThan(220));
      expect(lastCenter.b, greaterThan(220));
      expect(first.getPixel(5, 5).r, closeTo(last.getPixel(5, 5).r, 8));
      expect((gif.width, gif.height), (480, 429));
      await expectLater(
        exportMotionStrip(design, {
          1: Uint8List.fromList(output),
        }, active: () => false),
        throwsStateError,
      );
    },
  );
}
