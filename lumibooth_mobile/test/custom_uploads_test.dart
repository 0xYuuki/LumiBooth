import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:lumibooth_mobile/custom_uploads.dart';
import 'package:lumibooth_mobile/my_uploads_page.dart';
import 'package:lumibooth_mobile/strip.dart';
import 'package:lumibooth_mobile/local_draft.dart';
import 'package:lumibooth_mobile/booth.dart';
import 'package:lumibooth_mobile/saved_works.dart';
import 'package:lumibooth_mobile/motion_strip_export.dart';

class UploadDirectory extends PathProviderPlatform {
  UploadDirectory(this.path);
  final String path;
  @override
  Future<String?> getApplicationSupportPath() async => path;
}

Future<ui.Image> solid(Color color) async {
  final recorder = ui.PictureRecorder();
  Canvas(recorder).drawColor(color, BlendMode.src);
  final picture = recorder.endRecording();
  try {
    return await picture.toImage(40, 40);
  } finally {
    picture.dispose();
  }
}

Future<Uint8List> encoded(ui.Image image) async =>
    (await image.toByteData(format: ui.ImageByteFormat.png))!.buffer
        .asUint8List();
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('uploads-test');
    PathProviderPlatform.instance = UploadDirectory(directory.path);
  });
  tearDown(() async {
    await directory.delete(recursive: true);
  });
  test('validated imports preserve alpha, resize, persist, rename, and reject invalid files', () async {
    final source = img.Image(width: 2100, height: 10, numChannels: 4);
    source.setPixelRgba(0, 0, 255, 0, 0, 255);
    final prepared = await CustomUploads.prepare(
      Uint8List.fromList(img.encodePng(source)),
    );
    final decoded = img.decodePng(prepared.png)!;
    expect(decoded.width, 2048);
    expect(decoded.getPixel(100, 0).a, 0);
    final upload = await CustomUploads.add(
      prepared,
      'My transparent sticker',
      'sticker',
    );
    await CustomUploads.rename(upload, 'Renamed sticker');
    final items = await CustomUploads.list();
    expect(items.single.name, 'Renamed sticker');
    expect(await items.single.image.readAsBytes(), prepared.png);
    await expectLater(
      CustomUploads.prepare(Uint8List.fromList([1, 2, 3])),
      throwsFormatException,
    );
    await expectLater(
      CustomUploads.prepare(Uint8List(CustomUploads.maxBytes + 1)),
      throwsFormatException,
    );
    await expectLater(
      CustomUploads.prepare(Uint8List.fromList([137, 80, 78, 71, 1, 2, 3, 4])),
      throwsFormatException,
    );
    await CustomUploads.setPickerKind('background');
    expect(await CustomUploads.takePickerKind(), 'background');
    expect(await CustomUploads.takePickerKind(), isNull);
  });
  test(
    'custom background stays behind photos in PNG and animated export',
    () async {
      final background = await solid(Colors.red),
          photo = await solid(Colors.blue);
      addTearDown(background.dispose);
      addTearDown(photo.dispose);
      final design = StripDesign(
        layout: StripLayout.choices.first,
        photos: [photo],
        background: background,
      );
      final png = img.decodePng(await design.exportPng())!;
      expect(png.getPixel(0, 0).r, greaterThan(240));
      final opening = StripPainter.photoOpening(design, 0).bounds;
      expect(
        png
            .getPixel(
              (opening.center.dx * 3).floor(),
              (opening.center.dy * 3).floor(),
            )
            .b,
        greaterThan(240),
      );
      final gifImage = img.Image(width: 40, height: 40);
      img.fill(gifImage, color: img.ColorRgb8(0, 0, 255));
      final gif = img.decodeGif(
        await exportMotionStrip(design, {
          1: Uint8List.fromList(img.encodeGif(gifImage)),
        }, active: () => true),
      )!;
      expect(gif.getPixel(0, 0).r, greaterThan(220));
    },
  );
  testWidgets(
    'embedded uploads reopen after library deletion, with background and sticker intact',
    (tester) async {
      await tester.runAsync(() async {
        final image = await solid(Colors.green);
        final png = await encoded(image);
        image.dispose();
        final upload = await CustomUploads.add(
          await CustomUploads.prepare(png),
          'Leaf',
          'sticker',
        );
        final project = <String, dynamic>{
          'version': 1,
          'photos': [base64Encode(png)],
          'selected': [0],
          'layout': 1,
          'crops': [
            {'x': .5, 'y': .5, 'zoom': 1},
          ],
          'frame': 'studio',
          'font': 'outfit',
          'uploads': {upload.id: base64Encode(png)},
          'background': upload.id,
          'backgroundCrop': {'x': .3, 'y': .7, 'zoom': 2},
          'containBackground': false,
          'stickers': [
            {
              'symbol': 'Leaf',
              'x': .2,
              'y': .4,
              'size': 80,
              'angle': 35,
              'pack': upload.id,
              'source': [0, 0, 40, 40],
            },
          ],
        };
        await SavedWorks.save(project, png, png);
        await CustomUploads.delete(upload);
        expect(await CustomUploads.list(), isEmpty);
        final saved = (await SavedWorks.list()).single;
        await LocalDraft.save(await saved.project(), LocalDraft.generation);
        await tester.pumpWidget(const LumiBooth());
        for (
          var i = 0;
          i < 100 && find.text('Continue your strip').evaluate().isEmpty;
          i++
        ) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
          await tester.pump();
        }
      });
      await tester.runAsync(() async {
        for (var i = 0; i < 50; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
          await tester.pump();
        }
      });
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continue your strip'));
      await tester.runAsync(() async {
        for (
          var i = 0;
          i < 100 && find.text('Your strip starts here.').evaluate().isEmpty;
          i++
        ) {
          await Future<void>.delayed(const Duration(milliseconds: 10));
          await tester.pump();
        }
      });
      await tester.pumpAndSettle();
      final design = tester
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((w) => w.painter)
          .whereType<StripPainter>()
          .first
          .design;
      expect(design.background, isNotNull);
      expect(design.backgroundCrop.zoom, 2);
      expect(design.stickers.single.image, isNotNull);
      expect(design.stickers.single.angle, 35);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets('My Uploads shows a local grid and confirms deletion', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final image = await solid(Colors.green);
      final png = await encoded(image);
      image.dispose();
      await CustomUploads.add(
        await CustomUploads.prepare(png),
        'Green sticker',
        'sticker',
      );
      await tester.pumpWidget(const MaterialApp(home: MyUploadsPage()));
      for (var i = 0; i < 30; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 10));
        await tester.pump();
      }
    });
    await tester.pumpAndSettle();
    expect(find.text('Green sticker'), findsOneWidget);
    await tester.ensureVisible(find.byTooltip('Upload options'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Upload options'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    expect(find.text('Delete this upload?'), findsOneWidget);
    await tester.tap(find.text('Keep upload'));
    await tester.pumpAndSettle();
    expect(find.text('Green sticker'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
