import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'dart:math' as math;

import 'package:path_provider/path_provider.dart';

class CustomUpload {
  const CustomUpload(
    this.id,
    this.name,
    this.kind,
    this.created,
    this.directory,
  );
  final String id, name, kind;
  final DateTime created;
  final Directory directory;
  File get image => File('${directory.path}/image.png');
  File get thumbnail => File('${directory.path}/thumbnail.png');
}

class PreparedUpload {
  const PreparedUpload(this.png, this.thumbnail);
  final Uint8List png, thumbnail;
}

class CustomUploads {
  static const maxBytes = 20 * 1024 * 1024;
  static const maxPixels = 32 * 1000 * 1000;
  static int _serial = 0;
  static Future<void> _queue = Future.value();
  static Future<Directory> _root() async =>
      Directory('${(await getApplicationSupportDirectory()).path}/uploads');
  static Future<T> _write<T>(Future<T> Function() action) {
    final next = _queue.catchError((_) {}).then((_) => action());
    _queue = next.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return next;
  }

  static Future<void> setPickerKind(String kind) async {
    final root = await _root();
    await root.create(recursive: true);
    await File('${root.path}/picker-kind').writeAsString(kind, flush: true);
  }

  static Future<String?> takePickerKind() async {
    final root = await _root();
    final file = File('${root.path}/picker-kind');
    if (!await file.exists()) return null;
    final kind = await file.readAsString();
    await file.delete();
    return ['sticker', 'background'].contains(kind) ? kind : null;
  }

  static Future<PreparedUpload> prepare(Uint8List bytes) async {
    if (bytes.isEmpty || bytes.length > maxBytes) {
      throw const FormatException('Choose an image smaller than 20 MB.');
    }
    final png =
        bytes.length >= 8 &&
        bytes[0] == 137 &&
        bytes[1] == 80 &&
        bytes[2] == 78 &&
        bytes[3] == 71;
    final jpeg =
        bytes.length >= 3 &&
        bytes[0] == 255 &&
        bytes[1] == 216 &&
        bytes[2] == 255;
    final webp =
        bytes.length >= 12 &&
        ascii.decode(bytes.sublist(0, 4), allowInvalid: true) == 'RIFF' &&
        ascii.decode(bytes.sublist(8, 12), allowInvalid: true) == 'WEBP';
    if (!png && !jpeg && !webp) {
      throw const FormatException('Choose a still PNG, JPEG or WebP image.');
    }
    ui.ImmutableBuffer? buffer;
    ui.ImageDescriptor? descriptor;
    ui.Codec? codec;
    ui.Image? decoded;
    try {
      buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
      descriptor = await ui.ImageDescriptor.encoded(buffer);
      if (descriptor.width * descriptor.height > maxPixels) {
        throw const FormatException(
          'Choose an image with at most 32 megapixels.',
        );
      }
      final scale = math.min(
        1.0,
        2048 / math.max(descriptor.width, descriptor.height),
      );
      codec = await descriptor.instantiateCodec(
        targetWidth: math.max(1, (descriptor.width * scale).round()),
        targetHeight: math.max(1, (descriptor.height * scale).round()),
      );
      if (codec.frameCount != 1) {
        throw const FormatException(
          'Animated images are not supported. Choose a still image.',
        );
      }
      decoded = (await codec.getNextFrame()).image;
      final full = (await decoded.toByteData(format: ui.ImageByteFormat.png))!
          .buffer
          .asUint8List();
      final thumbCodec = await ui.instantiateImageCodec(
        full,
        targetWidth: math.min(240, decoded.width),
      );
      try {
        final thumb = (await thumbCodec.getNextFrame()).image;
        try {
          return PreparedUpload(
            full,
            (await thumb.toByteData(format: ui.ImageByteFormat.png))!.buffer
                .asUint8List(),
          );
        } finally {
          thumb.dispose();
        }
      } finally {
        thumbCodec.dispose();
      }
    } on FormatException {
      rethrow;
    } catch (_) {
      throw const FormatException(
        'This image could not be opened. Choose another PNG, JPEG or WebP.',
      );
    } finally {
      decoded?.dispose();
      codec?.dispose();
      descriptor?.dispose();
      buffer?.dispose();
    }
  }

  static Future<List<CustomUpload>> list() async {
    final root = await _root();
    if (!await root.exists()) return [];
    final items = <CustomUpload>[];
    await for (final entry in root.list()) {
      if (entry is! Directory || entry.path.split('/').last.startsWith('.')) {
        continue;
      }
      try {
        final data = jsonDecode(
          await File('${entry.path}/metadata.json').readAsString(),
        ) as Map<String, dynamic>;
        items.add(
          CustomUpload(
            entry.path.split('/').last,
            data['name'] as String,
            data['kind'] as String,
            DateTime.parse(data['created']),
            entry,
          ),
        );
      } catch (_) {
        items.add(
          CustomUpload(
            entry.path.split('/').last,
            'Unavailable upload',
            'sticker',
            DateTime.fromMillisecondsSinceEpoch(0),
            entry,
          ),
        );
      }
    }
    items.sort((a, b) => b.created.compareTo(a.created));
    return items;
  }

  static Future<CustomUpload> add(
    PreparedUpload image,
    String name,
    String kind,
  ) => _write(() async {
    if (!['sticker', 'background'].contains(kind)) {
      throw ArgumentError('Invalid upload type');
    }
    final root = await _root();
    await root.create(recursive: true);
    final id = 'upload-${DateTime.now().microsecondsSinceEpoch}-${_serial++}';
    final temp = Directory('${root.path}/.$id');
    final created = DateTime.now().toUtc();
    try {
      await temp.create();
      await File('${temp.path}/image.png').writeAsBytes(image.png, flush: true);
      await File('${temp.path}/thumbnail.png')
          .writeAsBytes(image.thumbnail, flush: true);
      await File('${temp.path}/metadata.json').writeAsString(
        jsonEncode({
          'name': _name(name),
          'kind': kind,
          'created': created.toIso8601String(),
        }),
        flush: true,
      );
      final directory = await temp.rename('${root.path}/$id');
      return CustomUpload(id, _name(name), kind, created, directory);
    } catch (_) {
      if (await temp.exists()) await temp.delete(recursive: true);
      rethrow;
    }
  });
  static String _name(String name) => name.trim().isEmpty
      ? 'My upload'
      : name.trim().substring(0, math.min(64, name.trim().length));
  static Future<void> rename(CustomUpload item, String name) =>
      _write(() async {
        final root = await _root();
        if (item.directory.parent.path != root.path) {
          throw ArgumentError('Invalid upload');
        }
        final temp = File('${item.directory.path}/metadata.tmp');
        await temp.writeAsString(
          jsonEncode({
            'name': _name(name),
            'kind': item.kind,
            'created': item.created.toIso8601String(),
          }),
          flush: true,
        );
        await temp.rename('${item.directory.path}/metadata.json');
      });
  static Future<void> delete(CustomUpload item) => _write(() async {
    final root = await _root();
    if (item.directory.parent.path != root.path) {
      throw ArgumentError('Invalid upload');
    }
    if (await item.directory.exists()) {
      await item.directory.delete(recursive: true);
    }
  });
}
