import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as image;
import 'package:lumibooth_mobile/camera_framing.dart';
import 'package:lumibooth_mobile/strip.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('the fixed view centers the crop on a portrait camera', () {
    final frame = cameraFraming(const Size(480, 640), 960);
    expect(frame.crop, const Rect.fromLTWH(0, 140, 480, 360));
    expect((frame.width, frame.height), (480, 360));
  });

  test(
    'the fixed camera crop fits both portrait and illustrated exports',
    () async {
      final source = image.Image(width: 64, height: 36);
      for (final pixel in source) {
        final inCamera = pixel.x >= 8 && pixel.x < 56;
        final inCenter = pixel.x >= 15 && pixel.x < 49;
        pixel.setRgb(
          inCamera && !inCenter ? 255 : 0,
          inCamera ? 255 : 0,
          inCamera ? 0 : 255,
        );
      }
      final photo = await decodeCameraPhoto(image.encodePng(source));
      addTearDown(photo.dispose);
      expect((photo.width, photo.height), (48, 36));
      final pixels = (await photo.toByteData())!;
      expect(pixels.buffer.asUint8List(pixels.offsetInBytes, 4), [
        255,
        255,
        0,
        255,
      ]);

      const layout = StripLayout('Single Photo', 1, 1);
      final portrait = image.decodePng(
        await StripDesign(layout: layout, photos: [photo]).exportPng(),
      )!;
      final portraitPixel = portrait.getPixel(102, 300);
      expect((portraitPixel.r, portraitPixel.g, portraitPixel.b), (0, 255, 0));

      const tube = StripFrame.tubeTV;
      final artwork = await FrameImages.load(tube.art!);
      addTearDown(artwork.dispose);
      final illustrated = image.decodePng(
        await StripDesign(
          layout: layout,
          photos: [photo],
          frame: tube,
          frameImages: artwork,
        ).exportPng(),
      )!;
      final tubePixel = illustrated.getPixel(180, 400);
      expect((tubePixel.r, tubePixel.g, tubePixel.b), (255, 255, 0));
    },
  );
}
