import 'dart:isolate';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:image/image.dart' as image;

import 'motion_photo.dart';
import 'strip.dart';

Future<Uint8List> exportMotionStrip(
  StripDesign design,
  Map<int, Uint8List> gifs, {
  required bool Function() active,
}) async {
  final tracks = <int, _Track>{};
  try {
    for (final entry in gifs.entries) {
      final codec = await ui.instantiateImageCodec(entry.value);
      tracks[entry.key - 1] = _Track(codec);
    }
    final size = design.size;
    final scale = math.min(2.0, math.min(480 / size.width, 960 / size.height));
    final width = (size.width * scale).floor();
    final height = (size.height * scale).floor();
    final frames = <TransferableTypedData>[];
    final delays = <int>[];
    const interval = 125;
    for (var time = 0; time < motionSeconds * 1000; time += interval) {
      final motion = <int, ui.Image>{};
      for (final entry in tracks.entries) {
        final frame = await entry.value.at(time);
        if (frame != null) motion[entry.key] = frame;
      }
      if (!active()) throw StateError('Motion export was cancelled.');
      if (motion.isEmpty) break;
      final recorder = ui.PictureRecorder();
      StripPainter(design, motionFrames: motion).paint(
        ui.Canvas(recorder),
        ui.Size(width.toDouble(), height.toDouble()),
      );
      final picture = recorder.endRecording();
      final ui.Image rendered;
      try {
        rendered = await picture.toImage(width, height);
      } finally {
        picture.dispose();
      }
      try {
        final data = (await rendered.toByteData(
          format: ui.ImageByteFormat.rawRgba,
        ))!;
        frames.add(TransferableTypedData.fromList([data.buffer.asUint8List()]));
      } finally {
        rendered.dispose();
      }
      final end = tracks.values.every((track) => track.lastFrame)
          ? math.min(
              time + interval,
              tracks.values.map((track) => track.end).reduce(math.max),
            )
          : time + interval;
      delays.add(math.max(1, end ~/ 10 - time ~/ 10));
    }
    if (frames.isEmpty || !active()) throw StateError('Motion is unavailable.');
    return await _encode(frames, delays, width, height);
  } finally {
    for (final track in tracks.values) {
      track.dispose();
    }
  }
}

Future<Uint8List> _encode(
  List<TransferableTypedData> frames,
  List<int> delays,
  int width,
  int height,
) => Isolate.run(() {
  final encoder = image.GifEncoder(
    quantizerType: image.QuantizerType.octree,
    dither: image.DitherKernel.none,
  );
  for (final (index, frame) in frames.indexed) {
    encoder.addFrame(
      image.Image.fromBytes(
        width: width,
        height: height,
        bytes: frame.materialize(),
        numChannels: 4,
      ),
      duration: delays[index],
    );
  }
  return encoder.finish()!;
});

class _Track {
  _Track(this.codec);

  final ui.Codec codec;
  ui.Image? frame;
  int end = 0;
  int _index = 0;
  bool get lastFrame => _index == codec.frameCount;

  Future<ui.Image?> at(int time) async {
    while (time >= end && _index < codec.frameCount) {
      final next = await codec.getNextFrame();
      frame?.dispose();
      frame = next.image;
      end += math.max(10, next.duration.inMilliseconds);
      _index++;
    }
    return time < end ? frame : null;
  }

  void dispose() {
    frame?.dispose();
    codec.dispose();
  }
}
