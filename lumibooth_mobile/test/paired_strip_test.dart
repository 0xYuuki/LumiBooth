import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as image;
import 'package:lumibooth_mobile/strip.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('exports three paired rounds with either TV or Studio frames', () async {
    const colors = [
      ui.Color(0xffdf2020),
      ui.Color(0xff20df20),
      ui.Color(0xff2020df),
      ui.Color(0xffdfdf20),
      ui.Color(0xffdf20df),
      ui.Color(0xff20dfdf),
    ];
    final photos = <ui.Image>[];
    for (final color in colors) {
      final recorder = ui.PictureRecorder();
      ui.Canvas(recorder).drawColor(color, ui.BlendMode.src);
      final picture = recorder.endRecording();
      final photo = await picture.toImage(32, 24);
      picture.dispose();
      photos.add(photo);
      addTearDown(photo.dispose);
    }
    final artwork = await FrameImages.load(StripFrame.tubeTV.art!);
    addTearDown(artwork.dispose);
    for (final frame in [StripFrame.tubeTV, StripFrame.studio]) {
      final design = StripDesign(
        layout: StripLayout.remoteDuo,
        frame: frame,
        photos: photos,
        frameImages: frame.art == null ? null : artwork,
      );
      final png = image.decodePng(await design.exportPng())!;
      expect(design.rows, 3);
      expect(
        (png.width, png.height),
        (960, 3 * (108 + 3 * 204 + frame.footer)),
      );
      final opening =
          frame.art?.window ?? const ui.Rect.fromLTWH(0, 0, 400, 300);
      for (var row = 0; row < 3; row++) {
        final y =
            24 +
            row * (design.cellHeight + 10) +
            opening.center.dy * design.cellHeight / 300;
        for (var side = 0; side < 2; side++) {
          final x =
              24 +
              (opening.left + (side == 0 ? 0.25 : 0.75) * opening.width) *
                  design.cellWidth /
                  400;
          final actual = png.getPixel((x * 3).floor(), (y * 3).floor());
          final expected = colors[2 * row + side];
          expect(
            (actual.r, actual.g, actual.b),
            (
              (expected.r * 255).round(),
              (expected.g * 255).round(),
              (expected.b * 255).round(),
            ),
          );
        }
      }
    }
  });
}
