import 'dart:convert';
import 'dart:typed_data';

final _uploadId = RegExp(
  r'^(?:upload-[0-9]{1,20}-[0-9]{1,10}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$',
);
const _maxHeader = 4096;
const maxUploadImageBytes = 20 * 1024 * 1024;
const maxUploadBackupBytes = _maxHeader + 4 + maxUploadImageBytes;

String uploadBackupName(String id) {
  if (!_uploadId.hasMatch(id)) {
    throw const FormatException('Invalid upload identifier.');
  }
  return '$id.lumi';
}

String? uploadBackupId(String name) {
  if (!name.endsWith('.lumi')) return null;
  final id = name.substring(0, name.length - 5);
  return _uploadId.hasMatch(id) ? id : null;
}

bool _validDetails(Map<String, dynamic> details) {
  final name = details['name'];
  final createdAt = details['createdAt'];
  return details['version'] == 1 &&
      name is String &&
      name.trim().isNotEmpty &&
      name.length <= 64 &&
      const ['sticker', 'background'].contains(details['kind']) &&
      createdAt is int &&
      createdAt >= 0 &&
      createdAt <= 8640000000000000 &&
      const ['image/png', 'image/webp'].contains(details['type']);
}

Uint8List packUploadBackup({
  required String name,
  required String kind,
  required DateTime created,
  required Uint8List png,
}) {
  if (png.isEmpty || png.length > maxUploadImageBytes) {
    throw const FormatException('The image exceeds the 20 MB backup limit.');
  }
  final details = {
    'version': 1,
    'name': name,
    'kind': kind,
    'createdAt': created.millisecondsSinceEpoch,
    'type': 'image/png',
  };
  if (!_validDetails(details)) {
    throw const FormatException('Invalid upload backup details.');
  }
  final header = utf8.encode(jsonEncode(details));
  final prefix = ByteData(4)..setUint32(0, header.length);
  return (BytesBuilder(copy: false)
        ..add(prefix.buffer.asUint8List())
        ..add(header)
        ..add(png))
      .takeBytes();
}

typedef RestoredUpload = ({
  String id,
  String name,
  String kind,
  DateTime created,
  Uint8List image,
});

RestoredUpload unpackUploadBackup(Uint8List bytes, String fileName) {
  final id = uploadBackupId(fileName);
  if (id == null || bytes.length < 6 || bytes.length > maxUploadBackupBytes) {
    throw const FormatException('Invalid upload backup.');
  }
  final length = ByteData.sublistView(bytes).getUint32(0);
  final end = 4 + length;
  if (length == 0 ||
      length > _maxHeader ||
      end >= bytes.length ||
      bytes.length - end > maxUploadImageBytes) {
    throw const FormatException('Invalid upload backup size.');
  }
  final details = jsonDecode(utf8.decode(Uint8List.sublistView(bytes, 4, end)));
  if (details is! Map<String, dynamic> || !_validDetails(details)) {
    throw const FormatException('Invalid upload backup details.');
  }
  return (
    id: id,
    name: details['name'] as String,
    kind: details['kind'] as String,
    created: DateTime.fromMillisecondsSinceEpoch(
      details['createdAt'] as int,
      isUtc: true,
    ),
    image: Uint8List.sublistView(bytes, end),
  );
}
