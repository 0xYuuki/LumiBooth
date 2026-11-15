import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as image;
import 'package:lumibooth_mobile/strip.dart';
import 'package:lumibooth_mobile/booth.dart';
import 'package:lumibooth_mobile/capture.dart';
import 'package:lumibooth_mobile/motion_strip_export.dart';
import 'package:lumibooth_mobile/photo_crop_controls.dart';

Future<ui.Image> stripes() async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  for (final (i, color) in [Colors.red, Colors.green, Colors.blue].indexed) {
    canvas.drawRect(
      Rect.fromLTWH(i * 100, 0, 100, 100),
      Paint()..color = color,
    );
  }
  final picture = recorder.endRecording();
  try {
    return await picture.toImage(300, 100);
  } finally {
    picture.dispose();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'PNG rendering uses non-destructive crop in plain and illustrated frames',
    () async {
      final photo = await stripes();
      addTearDown(photo.dispose);
      for (final frame in [StripFrame.studio, StripFrame.tubeTV]) {
        final artwork = frame.art == null
            ? null
            : await FrameImages.load(frame.art!);
        addTearDown(() => artwork?.dispose());
        final design = StripDesign(
          layout: StripLayout.choices.first,
          frame: frame,
          frameImages: artwork,
          photos: [photo],
          crops: [const PhotoCrop(x: 1, zoom: 2)],
        );
        final bytes = image.decodePng(await design.exportPng())!;
        final opening = StripPainter.photoOpening(design, 0).bounds;
        final pixel = bytes.getPixel(
          (opening.center.dx * 3).floor(),
          (opening.center.dy * 3).floor(),
        );
        expect(pixel.b, greaterThan(200));
        expect(pixel.r, lessThan(80));
        // The original is still full-width, suitable for resetting or another frame.
        expect(photo.width, 300);
      }
    },
  );

  test('animated export uses the same crop region', () async {
    final photo = await stripes();
    addTearDown(photo.dispose);
    final encoder = image.GifEncoder();
    for (var i = 0; i < 2; i++) {
      final frame = image.Image(width: 300, height: 100);
      for (final pixel in frame) {
        pixel.setRgb(
          pixel.x < 100 ? 255 : 0,
          pixel.x >= 100 && pixel.x < 200 ? 255 : 0,
          pixel.x >= 200 ? 255 : 0,
        );
      }
      encoder.addFrame(frame, duration: 12);
    }
    final design = StripDesign(
      layout: StripLayout.choices.first,
      photos: [photo],
      crops: [const PhotoCrop(x: 1, zoom: 2)],
    );
    final gif = image.decodeGif(
      await exportMotionStrip(design, {
        1: encoder.finish()!,
      }, active: () => true),
    )!;
    final opening = StripPainter.photoOpening(design, 0).bounds;
    for (final frame in gif.frames) {
      final pixel = frame.getPixel(
        (opening.center.dx * gif.width / design.width).floor(),
        (opening.center.dy * gif.height / design.size.height).floor(),
      );
      expect(pixel.b, greaterThan(220));
      expect(pixel.r, lessThan(25));
      expect(pixel.g, lessThan(25));
    }
  });

  testWidgets('design crops survive review, reordering and back navigation', (
    tester,
  ) async {
    final photo = (await tester.runAsync(stripes))!;
    addTearDown(photo.dispose);
    await tester.pumpWidget(const LumiBooth());
    await tester.tap(find.text('Start photo booth'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dual Strip'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    for (var i = 0; i < 2; i++) {
      tester
          .widget<CapturePage>(find.byType(CapturePage))
          .onPhoto(photo.clone());
      await tester.pump();
    }
    await tester.pumpAndSettle();
    await tester.tap(find.text('Next: Decorate strip'));
    await tester.pump();
    StripDesign design() => tester
        .widgetList<CustomPaint>(find.byType(CustomPaint))
        .map((w) => w.painter)
        .whereType<StripPainter>()
        .singleWhere((p) => p.design.photos.length == 2)
        .design;
    final scroll = find
        .descendant(
          of: find.byKey(const ValueKey('editor')),
          matching: find.byType(Scrollable),
        )
        .first;
    await tester.scrollUntilVisible(
      find.text('Photos'),
      100,
      scrollable: scroll,
    );
    await tester.tap(find.text('Photos'));
    await tester.pump();
    final zoom = find.byType(Slider);
    await tester.scrollUntilVisible(zoom, 100, scrollable: scroll);
    tester.widget<Slider>(zoom).onChanged!(2);
    await tester.pump();
    expect(design().cropAt(0).zoom, 2);
    await tester.tap(find.byTooltip('Back to previous step'));
    await tester.pump();
    final review = find
        .descendant(
          of: find.byKey(const ValueKey('selection')),
          matching: find.byType(Scrollable),
        )
        .first;
    await tester.scrollUntilVisible(
      find.byTooltip('Move shot 1 down'),
      150,
      scrollable: review,
    );
    await tester.tap(find.byTooltip('Move shot 1 down'));
    await tester.pump();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Next: Decorate strip'));
    await tester.pump();
    expect(design().cropAt(0).zoom, 1);
    expect(design().cropAt(1).zoom, 2);
    await tester.tap(find.byTooltip('Back to previous step'));
    await tester.pump();
    await tester.tap(find.byTooltip('Back to previous step'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dual Strip'));
    await tester.pumpAndSettle();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Next: Decorate strip'));
    await tester.pump();
    expect(design().cropAt(1).zoom, 2);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('crop surface drags and pinches without moving the scroll view', (
    tester,
  ) async {
    final photo = (await tester.runAsync(stripes))!;
    addTearDown(photo.dispose);
    final crop = ValueNotifier(const PhotoCrop(zoom: 2));
    addTearDown(crop.dispose);
    final scroll = ScrollController();
    addTearDown(scroll.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ListView(
            controller: scroll,
            children: [
              SizedBox(
                height: 520,
                child: ValueListenableBuilder(
                  valueListenable: crop,
                  builder: (context, value, _) {
                    final design = StripDesign(
                      layout: StripLayout.choices.first,
                      photos: [photo],
                      crops: [value],
                    );
                    return Stack(
                      children: [
                        PhotoCropControls(
                          design: design,
                          index: 0,
                          scale: .8,
                          origin: Offset.zero,
                          selected: true,
                          onSelect: () {},
                          onChanged: (value) => crop.value = value,
                        ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: 1000),
            ],
          ),
        ),
      ),
    );
    final surface = find.descendant(
      of: find.byType(PhotoCropControls),
      matching: find.byType(GestureDetector),
    );
    await tester.drag(surface, const Offset(-70, 30));
    await tester.pump();
    expect(crop.value.x, greaterThan(.5));
    expect(scroll.offset, 0);
    final center = tester.getCenter(surface);
    final first = await tester.startGesture(
      center - const Offset(20, 0),
      pointer: 1,
    );
    final second = await tester.startGesture(
      center + const Offset(20, 0),
      pointer: 2,
    );
    await first.moveBy(const Offset(-15, 0));
    await second.moveBy(const Offset(15, 0));
    await tester.pump();
    await first.moveBy(const Offset(-20, 0));
    await second.moveBy(const Offset(20, 0));
    await tester.pump();
    await first.up();
    await second.up();
    expect(crop.value.zoom, greaterThan(2));
  });

  testWidgets('camera returns through layout without losing captured photos', (
    tester,
  ) async {
    final photo = (await tester.runAsync(stripes))!;
    addTearDown(photo.dispose);
    await tester.pumpWidget(const LumiBooth());
    await tester.tap(find.text('Start photo booth'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dual Strip'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    tester.widget<CapturePage>(find.byType(CapturePage)).onPhoto(photo.clone());
    await tester.pump();
    await tester.tap(find.byTooltip('Back to previous step'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Triple Strip'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Triple Strip'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    final camera = tester.widget<CapturePage>(find.byType(CapturePage));
    expect(camera.captured, 1);
    expect(camera.total, 3);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('gallery entry shares layout and opens an empty review page', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const LumiBooth());
    await tester.tap(find.text('Choose from gallery'));
    await tester.pumpAndSettle();
    expect(find.text('Choose your layout.'), findsOneWidget);
    await tester.tap(find.text('Dual Strip'));
    await tester.pumpAndSettle();
    expect(find.text('Your photos, your order.'), findsOneWidget);
    expect(find.text('Add photos'), findsOneWidget);
    expect(find.byType(PhotoCropControls), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.tap(find.byTooltip('Back to previous step'));
    await tester.pumpAndSettle();
    expect(find.text('Choose your layout.'), findsOneWidget);
    await tester.ensureVisible(find.text('Triple Strip'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Triple Strip'));
    await tester.pumpAndSettle();
    expect(find.text('Your photos, your order.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
