import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/booth.dart';
import 'package:lumibooth_mobile/capture.dart';
import 'package:lumibooth_mobile/strip.dart';

void main() {
  testWidgets('guest can choose any supported layout and end a session', (
    tester,
  ) async {
    await tester.pumpWidget(const LumiBooth());
    await tester.tap(find.text('Start photo booth'));
    await tester.pumpAndSettle();

    for (final name in [
      'Single Photo',
      'Dual Strip',
      'Triple Strip',
      '4-Grid Classic',
      '6-Grid Wide',
    ]) {
      await tester.scrollUntilVisible(find.text(name), 120);
      expect(find.text(name), findsOneWidget);
    }

    await tester.scrollUntilVisible(find.text('Triple Strip'), -100);
    await tester.tap(find.text('Triple Strip'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('0 of 3 photos captured'), findsOneWidget);

    await tester.tap(find.text('End session'));
    await tester.pumpAndSettle();
    expect(find.text('Start photo booth'), findsOneWidget);
  });

  testWidgets('three captures open the frame editor', (tester) async {
    final image = await tester.runAsync(() async {
      final recorder = ui.PictureRecorder();
      Canvas(recorder).drawColor(Colors.green, BlendMode.src);
      final picture = recorder.endRecording();
      try {
        return await picture.toImage(20, 20);
      } finally {
        picture.dispose();
      }
    });
    addTearDown(image!.dispose);

    await tester.pumpWidget(const LumiBooth());
    await tester.tap(find.text('Start photo booth'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Triple Strip'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    for (var count = 1; count <= 3; count++) {
      tester
          .widget<CapturePage>(find.byType(CapturePage))
          .onPhoto(image.clone());
      await tester.pump();
      if (count < 3) {
        expect(find.text('$count of 3 photos captured'), findsOneWidget);
      }
    }
    expect(find.text('Make it yours.'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Soft Postcard'),
      140,
      scrollable: find
          .descendant(
            of: find.byKey(const ValueKey('editor')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    final target = find.text('Soft Postcard');
    await Scrollable.ensureVisible(tester.element(target), alignment: .4);
    await tester.pumpAndSettle();
    await tester.tap(target);
    await tester.pump();
    final chip = find.ancestor(
      of: find.text('Soft Postcard'),
      matching: find.byType(ChoiceChip),
    );
    expect(tester.widget<ChoiceChip>(chip).selected, isTrue);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });

  test(
    'export encodes the chosen frame at three times the design size',
    () async {
      final design = StripDesign(
        layout: StripLayout.choices[2],
        frame: StripFrame.postcard,
      );
      final bytes = await design.exportPng();
      expect(bytes.take(8), [137, 80, 78, 71, 13, 10, 26, 10]);

      final codec = await ui.instantiateImageCodec(bytes);
      try {
        final frame = await codec.getNextFrame();
        final image = frame.image;
        try {
          expect(image.width, (design.size.width * 3).ceil());
          expect(image.height, (design.size.height * 3).ceil());
          final rgba = (await image.toByteData())!.buffer.asUint8List();
          expect(rgba.take(4), [245, 228, 216, 255]);
        } finally {
          image.dispose();
        }
      } finally {
        codec.dispose();
      }
    },
  );

  test(
    'Retro Flash exports a checkerboard and Instant Print adds footer space',
    () async {
      expect(StripFrame.values, hasLength(19));
      final layout = StripLayout.choices.first;
      final retro = StripDesign(layout: layout, frame: StripFrame.retro);
      final instant = StripDesign(layout: layout, frame: StripFrame.instant);
      expect(instant.size.height, retro.size.height + 28);

      final codec = await ui.instantiateImageCodec(await retro.exportPng());
      try {
        final frame = await codec.getNextFrame();
        final image = frame.image;
        try {
          final rgba = (await image.toByteData())!.buffer.asUint8List();
          final row = image.width * 6 * 4;
          expect(rgba.sublist(row + 6 * 4, row + 6 * 4 + 4), [
            169,
            70,
            55,
            255,
          ]);
          expect(rgba.sublist(row + 42 * 4, row + 42 * 4 + 4), [
            244,
            211,
            141,
            255,
          ]);
        } finally {
          image.dispose();
        }
      } finally {
        codec.dispose();
      }
    },
  );

  test('illustrated templates have transparent photo windows and export their artwork', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    for (final frame in StripFrame.values.where((frame) => frame.art != null)) {
      final artwork = await FrameImages.load(frame.art!);
      try {
        final overlay = artwork.overlay;
        final rgba = (await overlay.toByteData())!.buffer.asUint8List();
        final center = frame.art!.window.center;
        final index =
            (center.dy.round() * 2 * overlay.width + center.dx.round() * 2) * 4;
        expect(rgba[index + 3], 0, reason: frame.label);
        final design = StripDesign(
          layout: StripLayout.choices[2],
          frame: frame,
          frameImages: artwork,
        );
        expect((await design.exportPng()).take(8), [
          137,
          80,
          78,
          71,
          13,
          10,
          26,
          10,
        ]);
        if (frame == StripFrame.cameraFilm) expect(artwork.header, isNotNull);
      } finally {
        artwork.dispose();
      }
    }
  });
}
