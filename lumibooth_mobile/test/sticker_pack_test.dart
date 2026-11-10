import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/sticker_pack.dart';
import 'package:lumibooth_mobile/strip.dart';

void main() {
  test(
    'image sticker packs load and a cutout is painted into the exported strip',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final packs = await StickerPack.loadCatalog();
      expect(packs, hasLength(8));
      expect(packs.expand((pack) => pack.items), hasLength(150));

      final pack = packs.singleWhere((pack) => pack.id == 'costume-props');
      final tile = pack.items.singleWhere(
        (tile) => tile.name == 'Black glasses',
      );
      final atlas = await pack.loadImage();
      try {
        final layout = StripLayout.choices.first;
        final sticker = StripSticker(
          tile.name,
          Offset.zero,
          120,
          image: atlas,
          source: tile.source,
        );
        final enlarged = sticker.resizeTo(140, const ui.Size(360, 504));
        final flat = await _inkBounds(
          StripDesign(layout: layout, stickers: [enlarged]),
        );
        final rotated = await _inkBounds(
          StripDesign(layout: layout, stickers: [enlarged.rotateBy(90)]),
        );
        expect(flat.width, greaterThan(flat.height * 2));
        expect(rotated.height, greaterThan(rotated.width * 2));
        expect(rotated.height, closeTo(flat.width, 2));
      } finally {
        atlas.dispose();
      }
    },
  );
}

Future<({int width, int height})> _inkBounds(StripDesign design) async {
  final codec = await ui.instantiateImageCodec(await design.exportPng());
  try {
    final image = (await codec.getNextFrame()).image;
    try {
      final rgba = (await image.toByteData())!.buffer.asUint8List();
      expect(rgba.take(4), [255, 253, 248, 255]);
      var left = 420, top = 420, right = 0, bottom = 0;
      for (var y = 0; y < 420; y++) {
        for (var x = 0; x < 420; x++) {
          final i = (y * image.width + x) * 4;
          if (rgba[i] < 25 && rgba[i + 1] < 25 && rgba[i + 2] < 25) {
            if (x < left) left = x;
            if (y < top) top = y;
            if (x > right) right = x;
            if (y > bottom) bottom = y;
          }
        }
      }
      expect(right, greaterThan(left));
      expect(bottom, greaterThan(top));
      return (width: right - left, height: bottom - top);
    } finally {
      image.dispose();
    }
  } finally {
    codec.dispose();
  }
}
