import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/strip.dart';

void main() {
  test('the chosen font changes both lines in the exported PNG', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    for (final (font, file) in [
      (StripFont.playfair, 'PlayfairDisplay.ttf'),
      (StripFont.caveat, 'Caveat.ttf'),
    ]) {
      await (FontLoader(
        font.family,
      )..addFont(rootBundle.load('assets/fonts/$file'))).load();
    }

    final layout = StripLayout.choices.first;
    final serif = StripDesign(
      layout: layout,
      caption: 'Manila memories',
      font: StripFont.playfair,
    );
    final handwritten = StripDesign(
      layout: layout,
      caption: 'Manila memories',
      font: StripFont.caveat,
    );
    final before = await _pixels(serif);
    final after = await _pixels(handwritten);
    final footer = (serif.size.height - 51) * 3;
    final rowBytes = (serif.size.width * 3).ceil() * 4;

    for (final (start, end) in [
      (footer, footer + 54),
      (footer + 66, footer + 105),
    ]) {
      final first = (start * rowBytes).round();
      final last = (end * rowBytes).round();
      expect(
        List.generate(
          last - first,
          (i) => first + i,
        ).any((i) => before[i] != after[i]),
        isTrue,
      );
    }
  });
}

Future<Uint8List> _pixels(StripDesign design) async {
  final codec = await ui.instantiateImageCodec(await design.exportPng());
  try {
    final image = (await codec.getNextFrame()).image;
    try {
      return (await image.toByteData())!.buffer.asUint8List();
    } finally {
      image.dispose();
    }
  } finally {
    codec.dispose();
  }
}
