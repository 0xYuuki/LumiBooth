import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/booth.dart';
import 'package:lumibooth_mobile/capture.dart';
import 'package:lumibooth_mobile/motion_photo.dart';
import 'package:lumibooth_mobile/motion_strip_view.dart';
import 'package:lumibooth_mobile/strip.dart';

void main() {
  testWidgets(
    'finish screen pairs clips by shot and discards them in the background',
    (tester) async {
      await tester.pumpWidget(const LumiBooth());
      await tester.tap(find.text('Start photo booth'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Triple Strip'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      final photo = (await tester.runAsync(() async {
        final recorder = ui.PictureRecorder();
        Canvas(recorder).drawColor(Colors.green, BlendMode.src);
        final picture = recorder.endRecording();
        try {
          return await picture.toImage(20, 20);
        } finally {
          picture.dispose();
        }
      }))!;
      addTearDown(photo.dispose);
      CapturePage camera() =>
          tester.widget<CapturePage>(find.byType(CapturePage));
      MotionFrame frame(int time, int red) =>
          MotionFrame(time, 2, 1, Uint8List.fromList([red, 0, 0, red, 0, 0]));

      camera().onPhoto(photo.clone());
      await tester.pump();
      final buffer = MotionBuffer();
      camera().onPhoto(photo.clone(), motion: buffer.take(0));
      await tester.pump();
      await tester.runAsync(() async {
        buffer.add(frame(1, 40));
        buffer.add(frame(125001, 160));
        camera().onPhoto(photo.clone(), motion: buffer.take(250000));
      });
      await tester.pump();

      await tester.runAsync(() async {
        await tester.tap(find.text('Preview strip'));
      });
      for (
        var attempt = 0;
        attempt < 30 && find.text('Your strip is ready.').evaluate().isEmpty;
        attempt++
      ) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 30)),
        );
        await tester.pump();
      }
      expect(find.text('Your strip is ready.'), findsOneWidget);
      final previewScroll = find
          .descendant(
            of: find.byKey(const ValueKey('preview')),
            matching: find.byType(Scrollable),
          )
          .first;
      final playStrip = find.text('Play strip');
      await tester.scrollUntilVisible(
        playStrip,
        100,
        scrollable: previewScroll,
      );
      await tester.runAsync(() async {
        await tester.tap(playStrip);
      });
      await tester.pump();
      final animated = find.byType(MotionStripView);
      expect(animated, findsOneWidget);
      StripPainter painter() =>
          tester
                  .widget<CustomPaint>(
                    find.descendant(
                      of: animated,
                      matching: find.byType(CustomPaint),
                    ),
                  )
                  .painter!
              as StripPainter;
      for (
        var attempt = 0;
        attempt < 30 && painter().motionFrames.isEmpty;
        attempt++
      ) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 30)),
        );
        await tester.pump();
      }
      expect(painter().motionFrames.keys, [2]);
      expect(painter().design.photos, hasLength(3));
      await tester.tap(find.text('Stop strip'));
      await tester.pump();
      expect(animated, findsNothing);
      await tester.tap(playStrip);
      await tester.pump();
      expect(animated, findsOneWidget);

      await tester.scrollUntilVisible(
        find.text('Shot 3'),
        170,
        scrollable: previewScroll,
      );
      expect(find.text('Shot 1'), findsNothing);
      expect(find.text('Shot 2'), findsOneWidget);
      expect(find.text('Motion unavailable for this shot.'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Play'),
        100,
        scrollable: previewScroll,
      );
      await tester.tap(find.text('Play'));
      await tester.pump();
      expect(find.bySemanticsLabel('Motion from shot 3'), findsOneWidget);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(find.text('Share GIF'), findsNothing);
      expect(animated, findsNothing);
      expect(find.text('Motion unavailable for this shot.'), findsNWidgets(2));
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
