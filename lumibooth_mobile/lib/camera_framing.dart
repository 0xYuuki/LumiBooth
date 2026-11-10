import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

const _frameWidth = 4;
const _frameHeight = 3;
const cameraAspectRatio = _frameWidth / _frameHeight;

({Rect crop, int width, int height}) cameraFraming(Size source, int maxWidth) {
  final cropSize = applyBoxFit(
    BoxFit.cover,
    source,
    Size(_frameWidth.toDouble(), _frameHeight.toDouble()),
  ).source;
  final units = math.min(cropSize.width, maxWidth) ~/ _frameWidth;
  return (
    crop: Alignment.center.inscribe(cropSize, Offset.zero & source),
    width: units * _frameWidth,
    height: units * _frameHeight,
  );
}

Future<ui.Image> decodeCameraPhoto(Uint8List bytes) async {
  const maxWidth = 960;
  final codec = await ui.instantiateImageCodec(
    bytes,
    targetWidth: maxWidth,
    allowUpscaling: false,
  );
  final ui.Image image;
  try {
    image = (await codec.getNextFrame()).image;
  } finally {
    codec.dispose();
  }

  final source = Size(image.width.toDouble(), image.height.toDouble());
  final (:crop, :width, :height) = cameraFraming(source, maxWidth);
  if (width == image.width && height == image.height) return image;

  try {
    final recorder = ui.PictureRecorder();
    Canvas(recorder).drawImageRect(
      image,
      crop,
      Rect.fromLTWH(0, 0, width.toDouble(), height.toDouble()),
      Paint()..filterQuality = FilterQuality.medium,
    );
    final picture = recorder.endRecording();
    try {
      return await picture.toImage(width, height);
    } finally {
      picture.dispose();
    }
  } finally {
    image.dispose();
  }
}
