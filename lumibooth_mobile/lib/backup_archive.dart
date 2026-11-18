import 'dart:convert';
import 'dart:typed_data';

const maxBackupBytes = 24 * 1024 * 1024;
const _maxHeaderBytes = 128 * 1024;
final backupNamePattern = RegExp(
  r'^(web-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|flutter-[0-9]{1,20}-[0-9]{1,10})\.lumi$',
);

String mobileBackupName(String id) {
  final existing = '$id.lumi';
  return backupNamePattern.hasMatch(existing) ? existing : 'flutter-$id.lumi';
}

Uint8List packMobileBackup({
  required Uint8List poster,
  required DateTime created,
  required Map<String, dynamic>? project,
}) {
  final edits = project == null
      ? const <int>[]
      : utf8.encode(jsonEncode(project));
  final header = utf8.encode(
    jsonEncode({
      'version': 1,
      'platform': 'flutter',
      'title': 'Saved strip',
      'createdAt': created.millisecondsSinceEpoch,
      'posterBytes': poster.length,
      'projectBytes': edits.length,
    }),
  );
  final length = 4 + header.length + poster.length + edits.length;
  if (poster.isEmpty ||
      header.length > _maxHeaderBytes ||
      length > maxBackupBytes) {
    throw const FormatException(
      'This strip exceeds the 24 MB backup limit or is damaged.',
    );
  }
  final prefix = ByteData(4)..setUint32(0, header.length);
  return (BytesBuilder(copy: false)
        ..add(prefix.buffer.asUint8List())
        ..add(header)
        ..add(poster)
        ..add(edits))
      .takeBytes();
}

typedef RestoredBackup = ({
  String id,
  Uint8List poster,
  DateTime created,
  Map<String, dynamic>? project,
});

RestoredBackup unpackMobileBackup(Uint8List bytes, String name) {
  if (!backupNamePattern.hasMatch(name) ||
      bytes.length < 28 ||
      bytes.length > maxBackupBytes) {
    throw const FormatException('Invalid backup.');
  }
  final headerBytes = ByteData.sublistView(bytes).getUint32(0);
  if (headerBytes == 0 ||
      headerBytes > _maxHeaderBytes ||
      headerBytes + 4 >= bytes.length) {
    throw const FormatException('Invalid backup header.');
  }
  var offset = 4 + headerBytes;
  final header = jsonDecode(
    utf8.decode(Uint8List.sublistView(bytes, 4, offset)),
  ) as Map<String, dynamic>;
  Uint8List take(Object? length) {
    if (length is! int || length < 1 || length > bytes.length - offset) {
      throw const FormatException('Incomplete backup.');
    }
    final result = Uint8List.sublistView(bytes, offset, offset + length);
    offset += length;
    return result;
  }

  final platform = header['platform'];
  if (header['version'] != 1 || (platform != 'web' && platform != 'flutter')) {
    throw const FormatException('Unsupported backup.');
  }
  final poster = take(header['posterBytes']);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (poster.length < 24 ||
      !signature.asMap().entries.every(
        (entry) => poster[entry.key] == entry.value,
      )) {
    throw const FormatException('Invalid strip PNG.');
  }
  final dimensions = ByteData.sublistView(poster);
  final width = dimensions.getUint32(16), height = dimensions.getUint32(20);
  if (width == 0 ||
      height == 0 ||
      width > 8192 ||
      height > 8192 ||
      width * height > 24000000) {
    throw const FormatException('Unsupported strip dimensions.');
  }
  Map<String, dynamic>? project;
  if (platform == 'flutter' && header['projectBytes'] != 0) {
    project = jsonDecode(
      utf8.decode(take(header['projectBytes'])),
    ) as Map<String, dynamic>;
    if (project['version'] != 1) {
      throw const FormatException('Unsupported editable project.');
    }
  }
  if (platform == 'web' && header['edits'] != null) {
    final edits = header['edits'] as Map<String, dynamic>;
    final items = edits['items'] as List;
    if (edits['version'] != 1 || items.length > 12) {
      throw const FormatException('Invalid editable project.');
    }
    for (final item in items) {
      take((item as Map)['bytes']);
    }
  }
  if (offset != bytes.length) {
    throw const FormatException('Invalid backup length.');
  }
  final key = name.substring(0, name.length - 5);
  final millis = header['createdAt'];
  return (
    id: key.startsWith('flutter-') ? key.substring(8) : key,
    poster: poster,
    project: project,
    created: millis is int && millis.abs() <= 8640000000000000
        ? DateTime.fromMillisecondsSinceEpoch(millis, isUtc: true)
        : DateTime.now(),
  );
}
