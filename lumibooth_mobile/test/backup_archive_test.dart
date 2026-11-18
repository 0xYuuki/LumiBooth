import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/backup_archive.dart';

void main() {
  final png = Uint8List(24)..setAll(0, [137, 80, 78, 71, 13, 10, 26, 10]);
  ByteData.sublistView(png)
    ..setUint32(16, 1)
    ..setUint32(20, 1);
  const id = '1700000000000000-0';

  test('native backups preserve edit data and local identity', () {
    final project = {'version': 1, 'caption': 'Keepsake'};
    final archive = packMobileBackup(
      poster: png,
      created: DateTime.fromMillisecondsSinceEpoch(42, isUtc: true),
      project: project,
    );
    final name = mobileBackupName(id);
    final restore = unpackMobileBackup(archive, name);
    expect(restore.id, id);
    expect(restore.created.millisecondsSinceEpoch, 42);
    expect(restore.project, project);
    expect(restore.poster, png);
    expect(
      () => unpackMobileBackup(
        Uint8List.sublistView(archive, 0, archive.length - 1),
        name,
      ),
      throwsFormatException,
    );
    expect(
      () => unpackMobileBackup(archive, '../bad.lumi'),
      throwsFormatException,
    );
  });

  test('web archives restore a PNG on mobile without changing their cloud identity', () {
    final header = utf8.encode(
      jsonEncode({
        'version': 1,
        'platform': 'web',
        'posterBytes': png.length,
        'edits': {
          'version': 1,
          'items': [
            {'bytes': 2},
          ],
          'uploads': [
            {'bytes': 1, 'type': 'image/png'},
          ],
        },
      }),
    );
    final length = ByteData(4)..setUint32(0, header.length);
    final bytes = Uint8List.fromList([
      ...length.buffer.asUint8List(),
      ...header,
      ...png,
      1,
      2,
      3,
    ]);
    const name = 'web-12345678-1234-1234-1234-123456789abc.lumi';
    final restored = unpackMobileBackup(bytes, name);
    expect(restored.poster, png);
    expect(restored.project, isNull);
    expect(mobileBackupName(restored.id), name);
  });
}
