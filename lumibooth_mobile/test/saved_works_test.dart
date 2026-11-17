import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:lumibooth_mobile/booth.dart';
import 'package:lumibooth_mobile/strip.dart';

import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/saved_works.dart';
import 'package:lumibooth_mobile/local_draft.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';

class WorkDirectory extends PathProviderPlatform {
  WorkDirectory(this.path);
  final String path;
  @override
  Future<String?> getApplicationSupportPath() async => path;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory directory;
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('works-test');
    PathProviderPlatform.instance = WorkDirectory(directory.path);
  });
  tearDown(() async {
    await directory.delete(recursive: true);
  });
  test(
    'works survive draft clearing and deletion removes only the selected work',
    () async {
      final project = {
        'version': 1,
        'photos': ['original'],
        'selected': [0],
        'caption': 'Memory',
        'crops': [
          {'zoom': 2},
        ],
      };
      final png = Uint8List.fromList([1, 2, 3]);
      await SavedWorks.save(project, png, png);
      await SavedWorks.save({...project, 'caption': 'Second'}, png, png);
      await LocalDraft.clear();
      var works = await SavedWorks.list();
      expect(works.length, 2);
      expect((await works.first.project())['caption'], 'Second');
      expect(await works.last.project(), project);
      expect(await works.last.poster.readAsBytes(), png);
      expect(works.every((work) => work.bytes > 0), isTrue);
      await SavedWorks.delete(works.first);
      works = await SavedWorks.list();
      expect(works.length, 1);
      expect(await works.single.project(), project);
      expect(works.single.editable, isTrue);
    },
  );
  test(
    'incomplete saves are hidden and damaged works remain deletable',
    () async {
      final root = Directory('${directory.path}/works');
      await Directory('${root.path}/.unfinished').create(recursive: true);
      await Directory('${root.path}/damaged').create();
      final works = await SavedWorks.list();
      expect(works.length, 1);
      expect(works.single.editable, isFalse);
      await SavedWorks.delete(works.single);
      expect(await SavedWorks.list(), isEmpty);
    },
  );
  test('preview-only work can be retained without editable sources', () async {
    final png = Uint8List.fromList([4, 5]);
    await SavedWorks.save(null, png, png);
    final work = (await SavedWorks.list()).single;
    expect(work.editable, isFalse);
    expect(await work.poster.readAsBytes(), png);
  });
  testWidgets(
    'Home opens saved work in editor and deletion asks before removing it',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.runAsync(() async {
        final recorder = ui.PictureRecorder();
        Canvas(recorder).drawColor(Colors.green, BlendMode.src);
        final picture = recorder.endRecording();
        final image = await picture.toImage(40, 40);
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        final png = data!.buffer.asUint8List();
        picture.dispose();
        image.dispose();
        await SavedWorks.save(
          {
            'version': 1,
            'photos': [base64Encode(png)],
            'selected': [0],
            'layout': 1,
            'manualLayout': true,
            'crops': [
              {'x': .3, 'y': .5, 'zoom': 2},
            ],
            'caption': 'Saved memory',
            'font': 'outfit',
            'frame': 'studio',
            'stickers': [],
          },
          png,
          png,
        );
      });
      Future<void> io() async {
        await tester.runAsync(() async {
          for (var i = 0; i < 20; i++) {
            await Future<void>.delayed(const Duration(milliseconds: 10));
            await tester.pump();
          }
        });
        await tester.pumpAndSettle();
      }

      await tester.pumpWidget(const LumiBooth());
      await io();
      for (final state in tester.stateList<ScaffoldMessengerState>(
        find.byType(ScaffoldMessenger),
      )) {
        state.clearSnackBars();
      }
      await tester.pumpAndSettle();
      final home = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(
        find.text('Photo strip').first,
        200,
        scrollable: home,
      );
      await io();
      expect(find.byType(GridView), findsOneWidget);
      await tester.tap(find.byTooltip('More options for saved strip').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delete').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Keep work'));
      await tester.pumpAndSettle();
      expect(find.text('Photo strip'), findsOneWidget);
      await tester.tap(find.byTooltip('More options for saved strip').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Edit').last);
      await io();
      expect(find.text('Make it yours.'), findsOneWidget);
      final design = tester
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((widget) => widget.painter)
          .whereType<StripPainter>()
          .first
          .design;
      expect(design.cropAt(0).zoom, 2);
      expect(design.footerCaption, 'Saved memory');
      await tester.tap(find.text('Preview strip'));
      for (
        var i = 0;
        i < 20 && find.byKey(const ValueKey('preview')).evaluate().isEmpty;
        i++
      ) {
        await io();
      }
      expect(find.byKey(const ValueKey('preview')), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Save to Your works'),
        120,
        scrollable: find
            .descendant(
              of: find.byKey(const ValueKey('preview')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save to Your works'));
      for (
        var i = 0;
        i < 30 && find.text('Saved to Your works').evaluate().isEmpty;
        i++
      ) {
        await io();
      }
      expect(find.text('Saved to Your works'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await io();
      expect((await tester.runAsync(SavedWorks.list))!.length, 2);
    },
  );
}
