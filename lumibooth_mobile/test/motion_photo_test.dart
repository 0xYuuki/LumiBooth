import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/services.dart' show DeviceOrientation;
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as image;
import 'package:lumibooth_mobile/motion_photo.dart';

MotionFrame frameAt(int time, [int red = 240]) =>
    MotionFrame(time, 2, 1, Uint8List.fromList([red, 0, 0, red, 0, 0]));

void main() {
  test('motion buffer keeps the last five seconds before a shutter and then clears', () {
    final buffer = MotionBuffer();
    for (var time = 0; time <= 5375000; time += 125000) {
      buffer.add(frameAt(time));
    }
    expect(buffer.wantsFrame(5375001), isFalse);
    final clip = buffer.take(5375001);
    final frames = clip.frames;
    expect(frames, hasLength(40));
    expect(frames.first.time, 500000);
    expect(frames.last.time, 5375000);
    expect(clip.end - clip.start, 5000000);
    expect(buffer.take(5500000).frames, isEmpty);

    buffer.add(frameAt(5600000));
    expect(buffer.take(10700000).frames, isEmpty);
    buffer.add(frameAt(10800000));
    buffer.clear();
    expect(buffer.take(10900000).frames, isEmpty);

    buffer.add(frameAt(11000000));
    buffer.add(frameAt(11125000));
    expect(buffer.take(11125000).frames.map((frame) => frame.time), [11000000]);
  });

  test(
    'successive shots wait only for missing motion and encode five seconds',
    () async {
      final buffer = MotionBuffer();
      for (final firstSample in [400000, 5800000]) {
        final pressed = firstSample + 250000;
        buffer.add(frameAt(firstSample));
        expect(buffer.remaining(pressed), const Duration(milliseconds: 4750));
        final shutter = pressed + buffer.remaining(pressed).inMicroseconds;
        for (var time = firstSample + 131000; time < shutter; time += 131000) {
          buffer.add(frameAt(time));
        }
        final clip = buffer.take(shutter);
        expect(clip.frames.first.time, firstSample);
        expect(clip.frames.last.time, lessThan(shutter));
        expect(buffer.remaining(shutter), const Duration(seconds: 5));
        final gif = image.decodeGif((await MotionGifJob(clip).result)!)!;
        expect(
          gif.frames.fold(0, (sum, frame) => sum + frame.frameDuration),
          5000,
        );
      }
    },
  );

  test('iOS BGRA crops wide frames to 4:3 and respects row stride', () {
    const stride = 640 * 4 + 4;
    final bytes = Uint8List(stride * 360);
    bytes.setAll(80 * 4, [20, 30, 200, 255]);
    bytes.setAll(2 * stride + 80 * 4, [60, 90, 210, 255]);
    final result = sampleMotionFrame(
      _CameraFrame(ImageFormatGroup.bgra8888, 640, 360, [
        _Plane(bytes, stride),
      ]),
      0,
    )!;
    expect((result.width, result.height), (320, 240));
    expect(result.rgb.take(3), [200, 30, 20]);
    expect(result.rgb.skip(320 * 3).take(3), [210, 90, 60]);
  });

  test(
    'Android YUV sampling rotates sensor frames and reads chroma strides',
    () {
      const camera = CameraDescription(
        name: 'fixture',
        lensDirection: CameraLensDirection.back,
        sensorOrientation: 90,
      );
      final rotation = androidMotionRotation(
        camera,
        DeviceOrientation.portraitUp,
      );
      final result = sampleMotionFrame(
        _CameraFrame(ImageFormatGroup.yuv420, 6, 8, [
          _Plane(
            Uint8List.fromList([
              for (var row = 0; row < 8; row++) ...[
                row.isEven ? 16 : 81,
                145,
                16,
                235,
                16,
                16,
              ],
            ]),
            6,
            1,
          ),
          for (var plane = 0; plane < 2; plane++)
            _Plane(
              Uint8List.fromList([
                for (var row = 0; row < 4; row++) ...[
                  128,
                  0,
                  128,
                  0,
                  128,
                  0,
                  0,
                ],
              ]),
              7,
              2,
            ),
        ]),
        0,
        rotation: rotation,
      )!;
      expect((result.width, result.height), (8, 6));
      expect(result.rgb.take(3), [76, 76, 76]);
      expect(result.rgb.skip(7 * 3).take(3), [0, 0, 0]);
      expect(result.rgb.skip(8 * 3).take(3), [150, 150, 150]);
    },
  );

  test(
    'GIF isolate preserves frame order, timing, and supports cancellation',
    () async {
      final frames = [
        frameAt(1000, 40),
        frameAt(151000, 100),
        frameAt(326000, 210),
      ];
      final buffer = MotionBuffer();
      frames.forEach(buffer.add);
      final clip = buffer.take(455000);
      final bytes = await MotionGifJob(clip).result;
      final gif = image.decodeGif(bytes!)!;
      expect(gif.numFrames, 3);
      expect(gif.frames.map((frame) => frame.getPixel(0, 0).r), [40, 100, 210]);
      expect(gif.frames.map((frame) => frame.frameDuration), [150, 170, 130]);

      final cancelled = MotionGifJob(clip);
      cancelled.cancel();
      expect(await cancelled.result, isNull);
      buffer.add(frameAt(500000));
      expect(await MotionGifJob(buffer.take(625000)).result, isNull);
    },
  );
}

class _CameraFrame extends Fake implements CameraImage {
  _CameraFrame(ImageFormatGroup group, this.width, this.height, this.planes)
    : format = _Format(group);

  @override
  final ImageFormat format;
  @override
  final int width;
  @override
  final int height;
  @override
  final List<Plane> planes;
}

class _Format extends Fake implements ImageFormat {
  _Format(this.group);

  @override
  final ImageFormatGroup group;
}

class _Plane extends Fake implements Plane {
  _Plane(this.bytes, this.bytesPerRow, [this.bytesPerPixel]);

  @override
  final Uint8List bytes;
  @override
  final int bytesPerRow;
  @override
  final int? bytesPerPixel;
}
