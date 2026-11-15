import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:lumibooth_mobile/booth.dart';
import 'package:lumibooth_mobile/strip.dart';

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/local_draft.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';

class DraftDirectory extends PathProviderPlatform {
  DraftDirectory(this.path);
  final String path;
  @override
  Future<String?> getApplicationSupportPath() async => path;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('lumibooth-draft-test');
    PathProviderPlatform.instance = DraftDirectory(directory.path);
    await LocalDraft.clear();
  });
  tearDown(() async {
    await LocalDraft.clear();
    await directory.delete(recursive: true);
  });
  test('local draft stores order and design and rejects writes from a cleared session', () async {
    final generation = LocalDraft.generation;
    final draft = {
      'version': 1,
      'photos': ['one', 'two'],
      'selected': [1, 0],
      'caption': 'Keep this',
      'crops': [
        {'zoom': 2},
      ],
    };
    await LocalDraft.save(draft, generation);
    expect(await LocalDraft.load(), draft);
    final pending = LocalDraft.save({...draft, 'caption': 'Stale'}, generation);
    await LocalDraft.clear();
    await pending;
    await LocalDraft.save(draft, generation);
    expect(await LocalDraft.load(), isNull);
    await LocalDraft.save({...draft, 'caption': 'New'}, LocalDraft.generation);
    expect((await LocalDraft.load())!['caption'], 'New');
    expect(
      await File('${directory.path}/photo-draft.json.tmp').exists(),
      isFalse,
    );
  });
  testWidgets('a reopened app restores its photo, crop, caption and layout', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final recorder = ui.PictureRecorder();
      Canvas(recorder).drawColor(Colors.green, BlendMode.src);
      final picture = recorder.endRecording();
      final photo = await picture.toImage(40, 40);
      final bytes = await photo.toByteData(format: ui.ImageByteFormat.png);
      picture.dispose();
      photo.dispose();
      await LocalDraft.save({
        'version': 1,
        'photos': [base64Encode(bytes!.buffer.asUint8List())],
        'selected': [0],
        'layout': 1,
        'manualLayout': true,
        'crops': [
          {'x': .2, 'y': .4, 'zoom': 2},
        ],
        'caption': 'Recovered memory',
        'font': 'outfit',
        'frame': 'studio',
        'stickers': [],
      }, LocalDraft.generation);
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
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue your strip'));
    await tester.pumpAndSettle();
    final design = tester
        .widgetList<CustomPaint>(find.byType(CustomPaint))
        .map((widget) => widget.painter)
        .whereType<StripPainter>()
        .first
        .design;
    expect(design.photos.length, 1);
    expect(design.layout.count, 1);
    expect(design.cropAt(0).zoom, 2);
    expect(design.footerCaption, 'Recovered memory');
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
