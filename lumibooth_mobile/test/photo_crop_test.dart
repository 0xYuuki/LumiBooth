import 'draft_test_support.dart';

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
  setUp(useUnavailableDraftStorage);
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
    addTearDown(() => disposeBooth(tester));
    await tester.pumpWidget(const LumiBooth());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Create photo strip'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('2 photos'),
      100,
      scrollable: find
          .descendant(
            of: find.byKey(const ValueKey('selection')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('2 photos'));
    await tester.pump();
    await tester.scrollUntilVisible(
      find.text('Take photos'),
      -100,
      scrollable: find
          .descendant(
            of: find.byKey(const ValueKey('selection')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Take photos'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    for (var i = 0; i < 2; i++) {
      tester
          .widget<CapturePage>(find.byType(CapturePage))
          .onPhoto(photo.clone());
      await tester.pump();
    }
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue to design'));
    await tester.pump();
    StripDesign design() => tester
        .widgetList<CustomPaint>(find.byType(CustomPaint))
        .map((w) => w.painter)
        .whereType<StripPainter>()
        .singleWhere((p) => p.design.photos.length == 2)
        .design;
    expect(find.text('Photos'), findsNothing);
    final photoTap = find.descendant(
      of: find.byType(PhotoCropControls).first,
      matching: find.byType(GestureDetector),
    );
    await tester.ensureVisible(photoTap);
    await tester.tap(photoTap);
    await tester.pumpAndSettle();
    final zoom = find.byType(Slider);
    tester.widget<Slider>(zoom).onChanged!(2);
    await tester.pump();
    expect(design().cropAt(0).zoom, 2);
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Back to previous step'));
    await tester.pump();
    final review = find
        .descendant(
          of: find.byKey(const ValueKey('selection')),
          matching: find.byType(Scrollable),
        )
        .first;
    await tester.scrollUntilVisible(
      find.text('Shot 1'),
      100,
      scrollable: review,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Shot 1'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Shot 1'));
    await tester.pump();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue to design'));
    await tester.pump();
    expect(design().cropAt(0).zoom, 1);
    expect(design().cropAt(1).zoom, 2);
    await tester.tap(find.byTooltip('Back to previous step'));
    await tester.pump();
    await tester.tap(find.byTooltip('Back to previous step'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue your strip'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue to design'));
    await tester.pump();
    expect(design().cropAt(1).zoom, 2);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'full-image transform supports drag, pinch, four corners and reset on a narrow screen',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final photo = (await tester.runAsync(stripes))!;
      addTearDown(photo.dispose);
      PhotoCrop crop = const PhotoCrop(zoom: 1.5);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PhotoTransformEditor(
              image: photo,
              aspect: .75,
              crop: crop,
              onChanged: (value) => crop = value,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final surface = find.byKey(const ValueKey('reposition-photo'));
      await tester.drag(surface, const Offset(-20, 0));
      await tester.pump();
      expect(crop.x, greaterThan(.5));
      final center = tester.getCenter(surface);
      final first = await tester.startGesture(
        center - const Offset(10, 0),
        pointer: 1,
      );
      final second = await tester.startGesture(
        center + const Offset(10, 0),
        pointer: 2,
      );
      await first.moveBy(const Offset(-10, 0));
      await second.moveBy(const Offset(10, 0));
      await tester.pump();
      await first.moveBy(const Offset(-10, 0));
      await second.moveBy(const Offset(10, 0));
      await tester.pump();
      await first.up();
      await second.up();
      expect(crop.zoom, greaterThan(1.5));
      await tester.tap(find.text('Reset crop'));
      await tester.pump();
      expect(crop.zoom, 1);
      for (final corner in [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
      ]) {
        final handle = find.byKey(ValueKey('resize-photo-$corner'));
        expect(handle, findsOneWidget);
        final box = tester.getRect(handle);
        expect(box.left, greaterThanOrEqualTo(0));
        expect(box.right, lessThanOrEqualTo(360));
      }
      await tester.drag(
        find.byKey(const ValueKey('resize-photo-top-left')),
        const Offset(-25, -25),
      );
      await tester.pump();
      expect(crop.zoom, greaterThan(1));
      final beforeFit = crop;
      await tester.tap(find.text('Fit image'));
      await tester.pump();
      expect(crop.zoom, beforeFit.zoom);
      expect(crop.x, beforeFit.x);
      expect(crop.y, beforeFit.y);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'camera returns to Photos and preserves shots through layout changes',
    (tester) async {
      final photo = (await tester.runAsync(stripes))!;
      addTearDown(photo.dispose);
      addTearDown(() => disposeBooth(tester));
      await tester.pumpWidget(const LumiBooth());
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create photo strip'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('2 photos'),
        100,
        scrollable: find
            .descendant(
              of: find.byKey(const ValueKey('selection')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('2 photos'));
      await tester.pump();
      await tester.scrollUntilVisible(
        find.text('Take photos'),
        -100,
        scrollable: find
            .descendant(
              of: find.byKey(const ValueKey('selection')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Take photos'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      tester
          .widget<CapturePage>(find.byType(CapturePage))
          .onPhoto(photo.clone());
      await tester.pump();
      await tester.tap(find.byTooltip('Back to previous step'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('3 photos'));
      await tester.pumpAndSettle();
      await tester.pumpAndSettle();
      await tester.tap(find.text('3 photos'));
      await tester.pump();
      await tester.scrollUntilVisible(
        find.text('Take photos'),
        -100,
        scrollable: find
            .descendant(
              of: find.byKey(const ValueKey('selection')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Take photos'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      final camera = tester.widget<CapturePage>(find.byType(CapturePage));
      expect(camera.captured, 1);
      expect(camera.total, 3);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('unified workspace is responsive and resumes after Home', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(() => disposeBooth(tester));
    await tester.pumpWidget(const LumiBooth());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Create photo strip'));
    await tester.pumpAndSettle();
    expect(find.text('Your strip starts here.'), findsOneWidget);
    expect(find.text('Add from gallery'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('2 photos'),
      100,
      scrollable: find
          .descendant(
            of: find.byKey(const ValueKey('selection')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('2 photos'));
    await tester.pump();
    expect(tester.takeException(), isNull);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Continue your strip'), findsOneWidget);
    await tester.tap(find.text('Continue your strip'));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, '2 photos'))
          .selected,
      isTrue,
    );
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Start fresh'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Keep editing'));
    await tester.pumpAndSettle();
    expect(find.text('Continue your strip'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets(
    'photo cards confirm removal, undo restores it, and taps set order',
    (tester) async {
      final photo = (await tester.runAsync(stripes))!;
      addTearDown(photo.dispose);
      addTearDown(() => disposeBooth(tester));
      await tester.pumpWidget(const LumiBooth());
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create photo strip'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2 photos'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Take photos'));
      await tester.pump();
      final first = photo.clone(), second = photo.clone();
      tester.widget<CapturePage>(find.byType(CapturePage)).onPhoto(first);
      await tester.pump();
      tester.widget<CapturePage>(find.byType(CapturePage)).onPhoto(second);
      await tester.pumpAndSettle();
      final scroll = find
          .descendant(
            of: find.byKey(const ValueKey('selection')),
            matching: find.byType(Scrollable),
          )
          .first;
      await tester.scrollUntilVisible(
        find.text('Choose order'),
        150,
        scrollable: scroll,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Choose order'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Shot 2'),
        150,
        scrollable: scroll,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Shot 2'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Shot 1'));
      await tester.pumpAndSettle();
      StripDesign design() => tester
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((w) => w.painter)
          .whereType<StripPainter>()
          .first
          .design;
      expect(design().photos, [second, first]);
      await tester.tap(find.byTooltip('Remove shot 2'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Keep photo'));
      await tester.pumpAndSettle();
      expect(find.text('Shot 2'), findsOneWidget);
      await tester.tap(find.byTooltip('Remove shot 2'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Remove photo'));
      await tester.pumpAndSettle();
      expect(find.text('Shot 2'), findsNothing);
      await tester.scrollUntilVisible(
        find.text('Undo'),
        -100,
        scrollable: scroll,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Undo'));
      await tester.pumpAndSettle();
      expect(design().photos, [second, first]);
      expect(find.textContaining('position'), findsNothing);
    },
  );
}
