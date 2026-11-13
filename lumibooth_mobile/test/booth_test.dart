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
    expect(find.text('0 of 5 photos captured'), findsOneWidget);
    expect(find.text('Pick your best 3 after shooting'), findsOneWidget);

    await tester.tap(find.text('End session'));
    await tester.pumpAndSettle();
    expect(find.text('Start photo booth'), findsOneWidget);
  });

  testWidgets('five captures open photo selection and allow choosing photos for strip', (
    tester,
  ) async {
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
    for (var count = 1; count <= 5; count++) {
      tester
          .widget<CapturePage>(find.byType(CapturePage))
          .onPhoto(image.clone());
      await tester.pump();
      if (count < 5) {
        expect(find.text('$count of 5 photos captured'), findsOneWidget);
      }
    }
    // Photo selection step (03 / CHOOSE PHOTOS)
    expect(find.text('Pick your favorites.'), findsOneWidget);
    expect(find.text('03 / CHOOSE PHOTOS'), findsOneWidget);
    expect(find.text('Shot 1'), findsOneWidget);
    expect(find.text('Shot 5'), findsOneWidget);

    // Swap shot 4 into selection
    final selectionScroll = find
        .descendant(
          of: find.byKey(const ValueKey('selection')),
          matching: find.byType(Scrollable),
        )
        .first;
    final shot4 = find.text('Shot 4');
    await tester.scrollUntilVisible(shot4, 120, scrollable: selectionScroll);
    await Scrollable.ensureVisible(tester.element(shot4), alignment: .4);
    await tester.pumpAndSettle();
    await tester.tap(shot4);
    await tester.pump();

    // Proceed to editor
    await tester.tap(find.text('Next: Decorate strip'));
    await tester.pump();

    expect(find.text('Make it yours.'), findsOneWidget);
    expect(find.text('Change photos'), findsOneWidget);
    final editorScroll = find
        .descendant(
          of: find.byKey(const ValueKey('editor')),
          matching: find.byType(Scrollable),
        )
        .first;
    await tester.scrollUntilVisible(
      find.text('Soft Postcard'),
      140,
      scrollable: editorScroll,
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
    final captionField = find.byType(TextField);
    String caption() => tester.widget<TextField>(captionField).controller!.text;
    await tester.scrollUntilVisible(
      captionField,
      -100,
      scrollable: editorScroll,
    );
    await Scrollable.ensureVisible(tester.element(captionField), alignment: .4);
    await tester.pumpAndSettle();
    expect(caption(), StripFrame.postcard.caption);
    await tester.enterText(
      captionField,
      '123456789012345678901234567890123456',
    );
    expect(caption(), '12345678901234567890123456789012');
    await tester.enterText(captionField, 'Manila memories');
    await tester.pump();
    StripDesign currentDesign() => tester
        .widgetList<CustomPaint>(find.byType(CustomPaint))
        .map((widget) => widget.painter)
        .whereType<StripPainter>()
        .singleWhere((painter) => painter.design.photos.length == 3)
        .design;
    expect(currentDesign().footerCaption, 'Manila memories');
    await tester.tap(find.text('Remove caption'));
    await tester.pump();
    expect(caption(), isEmpty);
    expect(currentDesign().footerCaption, isEmpty);
    await tester.tap(find.text('Use frame caption'));
    await tester.pump();
    expect(currentDesign().footerCaption, StripFrame.postcard.caption);
    final font = find.byType(DropdownButtonFormField<StripFont>);
    await tester.scrollUntilVisible(font, -100, scrollable: editorScroll);
    await Scrollable.ensureVisible(tester.element(font), alignment: .35);
    await tester.pumpAndSettle();
    await tester.tap(font);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Caveat').last);
    await tester.pumpAndSettle();
    expect(currentDesign().font, StripFont.caveat);
    expect(currentDesign().footerCaption, StripFrame.postcard.caption);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });

  testWidgets(
    'guest can finish shooting early after meeting minimum required photos',
    (tester) async {
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
      await tester.tap(find.text('Dual Strip'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('0 of 4 photos captured'), findsOneWidget);

      tester
          .widget<CapturePage>(find.byType(CapturePage))
          .onPhoto(image.clone());
      await tester.pump();
      expect(find.text('1 of 4 photos captured'), findsOneWidget);

      tester
          .widget<CapturePage>(find.byType(CapturePage))
          .onPhoto(image.clone());
      await tester.pump();
      expect(find.text('2 of 4 photos captured'), findsOneWidget);

      final cameraScroll = find
          .descendant(
            of: find.byType(CapturePage),
            matching: find.byType(Scrollable),
          )
          .first;
      final doneButton = find.text('Done shooting (2/4)');
      await tester.scrollUntilVisible(doneButton, 200, scrollable: cameraScroll);
      await tester.tap(doneButton);
      await tester.pump();

      // Exactly 2 required photos taken, so directly goes to editor
      expect(find.text('Make it yours.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    },
  );

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
      expect(StripFrame.values, hasLength(36));
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
