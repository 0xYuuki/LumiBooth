import 'dart:async';
import 'dart:isolate';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' show Size;

import 'package:camera/camera.dart';
import 'package:flutter/services.dart' show DeviceOrientation;
import 'package:image/image.dart' as image;

import 'camera_framing.dart';

const _sampleInterval = 125000;
const motionSeconds = 5;
const _bufferDuration = motionSeconds * Duration.microsecondsPerSecond;
const _maxFrames = _bufferDuration ~/ _sampleInterval;
const _maxEdge = 320;

class MotionFrame {
  const MotionFrame(this.time, this.width, this.height, this.rgb);

  final int time;
  final int width;
  final int height;
  final Uint8List rgb;
}

typedef MotionClip = ({List<MotionFrame> frames, int start, int end});

class MotionBuffer {
  final List<MotionFrame> _frames = [];
  int? _startedAt;

  bool wantsFrame(int time) =>
      _frames.isEmpty || time - _frames.last.time >= _sampleInterval;

  void add(MotionFrame frame) {
    if (_frames.isNotEmpty &&
        (_frames.last.width != frame.width ||
            _frames.last.height != frame.height)) {
      clear();
    }
    if (!wantsFrame(frame.time)) return;
    _startedAt ??= frame.time;
    _frames.removeWhere((item) => frame.time - item.time >= _bufferDuration);
    if (_frames.length == _maxFrames) _frames.removeAt(0);
    _frames.add(frame);
  }

  Duration remaining(int time) => Duration(
    microseconds: math.max(0, _bufferDuration - (time - (_startedAt ?? time))),
  );

  MotionClip take(int shutterTime) {
    final frames = _frames
        .where(
          (frame) =>
              frame.time < shutterTime &&
              shutterTime - frame.time <= _bufferDuration,
        )
        .toList();
    clear();

    final first = frames.isEmpty ? shutterTime : frames.first.time;
    final last = frames.isEmpty ? shutterTime : frames.last.time;
    final windowStart = shutterTime - _bufferDuration;
    // Hold the edge frames across ordinary camera and sampler jitter.
    final full =
        first - windowStart <= 2 * _sampleInterval &&
        shutterTime - last <= 2 * _sampleInterval;
    return (
      frames: frames,
      start: full ? windowStart : first,
      end: full ? shutterTime : math.min(shutterTime, last + _sampleInterval),
    );
  }

  void clear() {
    _frames.clear();
    _startedAt = null;
  }
}

int androidMotionRotation(
  CameraDescription camera,
  DeviceOrientation orientation,
) {
  final display = switch (orientation) {
    DeviceOrientation.portraitUp => 0,
    DeviceOrientation.landscapeLeft => 90,
    DeviceOrientation.portraitDown => 180,
    DeviceOrientation.landscapeRight => 270,
  };
  final sign = camera.lensDirection == CameraLensDirection.front ? -1 : 1;
  return (camera.sensorOrientation - display * sign) % 360;
}

MotionFrame? sampleMotionFrame(
  CameraImage frame,
  int time, {
  int rotation = 0,
}) {
  if (frame.width <= 0 || frame.height <= 0) return null;
  final bgra =
      frame.format.group == ImageFormatGroup.bgra8888 &&
      frame.planes.length == 1;
  final yuv =
      frame.format.group == ImageFormatGroup.yuv420 && frame.planes.length == 3;
  if (!bgra && !yuv) return null;

  final swapped = rotation == 90 || rotation == 270;
  final sourceWidth = swapped ? frame.height : frame.width;
  final sourceHeight = swapped ? frame.width : frame.height;
  final (:crop, :width, :height) = cameraFraming(
    Size(sourceWidth.toDouble(), sourceHeight.toDouble()),
    _maxEdge,
  );
  if (width == 0 || height == 0) return null;
  final bytes = Uint8List(width * height * 3);
  final first = frame.planes.first;
  final uPlane = yuv ? frame.planes[1] : null;
  final vPlane = yuv ? frame.planes[2] : null;

  int sample(Plane plane, int x, int y, int defaultStride) =>
      y * plane.bytesPerRow + x * (plane.bytesPerPixel ?? defaultStride);

  var offset = 0;
  for (var row = 0; row < height; row++) {
    final y = (crop.top + (row + .5) * crop.height / height).floor();
    for (var column = 0; column < width; column++) {
      final x = (crop.left + (column + .5) * crop.width / width).floor();
      final (sx, sy) = switch (rotation) {
        90 => (y, frame.height - 1 - x),
        180 => (frame.width - 1 - x, frame.height - 1 - y),
        270 => (frame.width - 1 - y, x),
        _ => (x, y),
      };

      if (bgra) {
        final index = sample(first, sx, sy, 4);
        if (index + 2 >= first.bytes.length) return null;
        bytes[offset++] = first.bytes[index + 2];
        bytes[offset++] = first.bytes[index + 1];
        bytes[offset++] = first.bytes[index];
      } else {
        final yIndex = sample(first, sx, sy, 1);
        final uIndex = sample(uPlane!, sx ~/ 2, sy ~/ 2, 1);
        final vIndex = sample(vPlane!, sx ~/ 2, sy ~/ 2, 1);
        if (yIndex >= first.bytes.length ||
            uIndex >= uPlane.bytes.length ||
            vIndex >= vPlane.bytes.length) {
          return null;
        }
        final yy = (first.bytes[yIndex] - 16) * 298;
        final u = uPlane.bytes[uIndex] - 128;
        final v = vPlane.bytes[vIndex] - 128;
        bytes[offset++] = ((yy + 409 * v + 128) >> 8).clamp(0, 255);
        bytes[offset++] = ((yy - 100 * u - 208 * v + 128) >> 8).clamp(0, 255);
        bytes[offset++] = ((yy + 516 * u + 128) >> 8).clamp(0, 255);
      }
    }
  }
  return MotionFrame(time, width, height, bytes);
}

typedef _TransferFrame = ({
  int width,
  int height,
  int time,
  TransferableTypedData pixels,
});
typedef _EncodeRequest = ({
  SendPort reply,
  List<_TransferFrame> frames,
  int start,
  int end,
});

class MotionGifJob {
  MotionGifJob(MotionClip clip) {
    _port.listen((message) {
      final data = message is TransferableTypedData
          ? message.materialize().asUint8List()
          : null;
      _finish(data);
    });
    unawaited(_start(clip));
  }

  final _port = ReceivePort();
  final _result = Completer<Uint8List?>();
  Isolate? _worker;

  Future<Uint8List?> get result => _result.future;

  Future<void> _start(MotionClip clip) async {
    try {
      final worker = await Isolate.spawn<_EncodeRequest>(_encode, (
        reply: _port.sendPort,
        start: clip.start,
        end: clip.end,
        frames: [
          for (final frame in clip.frames)
            (
              width: frame.width,
              height: frame.height,
              time: frame.time,
              pixels: TransferableTypedData.fromList([frame.rgb]),
            ),
        ],
      ), onError: _port.sendPort);
      if (_result.isCompleted) {
        worker.kill(priority: Isolate.immediate);
      } else {
        _worker = worker;
      }
    } catch (_) {
      _finish(null);
    }
  }

  void cancel() => _finish(null);

  void _finish(Uint8List? bytes) {
    if (_result.isCompleted) return;
    _port.close();
    _worker?.kill(priority: Isolate.immediate);
    _worker = null;
    _result.complete(bytes);
  }

  static void _encode(_EncodeRequest request) {
    Uint8List? bytes;
    try {
      if (request.frames.length >= 2) {
        final encoder = image.GifEncoder(
          quantizerType: image.QuantizerType.octree,
          dither: image.DitherKernel.none,
        );
        final start = request.start;
        for (final (index, frame) in request.frames.indexed) {
          final frameStart = index == 0 ? start : frame.time;
          final end = index + 1 < request.frames.length
              ? request.frames[index + 1].time
              : request.end;
          final duration =
              (end - start) ~/ 10000 - (frameStart - start) ~/ 10000;
          encoder.addFrame(
            image.Image.fromBytes(
              width: frame.width,
              height: frame.height,
              bytes: frame.pixels.materialize(),
              numChannels: 3,
            ),
            duration: math.max(1, duration),
          );
        }
        bytes = encoder.finish();
      }
    } catch (_) {
      bytes = null;
    }
    Isolate.exit(
      request.reply,
      bytes == null ? null : TransferableTypedData.fromList([bytes]),
    );
  }
}
