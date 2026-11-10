import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class StickerTile {
  const StickerTile(this.name, this.source);

  final String name;
  final Rect source;
}

class StickerPack {
  const StickerPack(this.id, this.name, this.items);

  static const emoji = StickerPack('emoji', 'Emoji', []);

  final String id;
  final String name;
  final List<StickerTile> items;

  static Future<List<StickerPack>> loadCatalog() async {
    final data = jsonDecode(
      await rootBundle.loadString('assets/stickers/catalog.json'),
    ) as List<dynamic>;
    return [
      emoji,
      for (final pack in data.cast<Map<String, dynamic>>())
        StickerPack(pack['id'] as String, pack['name'] as String, [
          for (final item
              in (pack['items'] as List).cast<Map<String, dynamic>>())
            StickerTile(
              item['name'] as String,
              Rect.fromLTWH(
                (item['x'] as num).toDouble(),
                (item['y'] as num).toDouble(),
                (item['width'] as num).toDouble(),
                (item['height'] as num).toDouble(),
              ),
            ),
        ]),
    ];
  }

  Future<ui.Image> loadImage() async {
    final data = await rootBundle.load('assets/stickers/$id.webp');
    final codec = await ui.instantiateImageCodec(
      data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
    );
    try {
      return (await codec.getNextFrame()).image;
    } finally {
      codec.dispose();
    }
  }
}

class StickerImagePainter extends CustomPainter {
  const StickerImagePainter(this.image, this.source);

  final ui.Image image;
  final Rect source;

  static void draw(Canvas canvas, ui.Image image, Rect source, Rect bounds) {
    final fit = applyBoxFit(BoxFit.contain, source.size, bounds.size);
    canvas.drawImageRect(
      image,
      source,
      Alignment.center.inscribe(fit.destination, bounds),
      Paint()..filterQuality = FilterQuality.low,
    );
  }

  @override
  void paint(Canvas canvas, Size size) =>
      draw(canvas, image, source, Offset.zero & size);

  @override
  bool shouldRepaint(StickerImagePainter oldDelegate) =>
      image != oldDelegate.image || source != oldDelegate.source;
}
