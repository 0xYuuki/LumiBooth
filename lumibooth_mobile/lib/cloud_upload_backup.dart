import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'cloud_backup.dart';
import 'custom_uploads.dart';
import 'upload_backup_archive.dart';

typedef CloudCopy = ({FileObject file, String? title, String? kind});

abstract final class CloudUploadBackup {
  static const _timeout = Duration(seconds: 45);

  static StorageFileApi _storage(String owner) =>
      CloudBackup.storageFor(owner, bucket: 'lumi-private-uploads');

  static String _path(String owner, String name) {
    if (uploadBackupId(name) == null) {
      throw const FormatException('Invalid upload backup.');
    }
    return '$owner/$name';
  }

  static Future<CloudCopy> _details(
    StorageFileApi storage,
    String owner,
    FileObject file,
  ) async {
    try {
      final info = await storage
          .info(_path(owner, file.name))
          .timeout(_timeout);
      final title = info.metadata?['name'];
      final kind = info.metadata?['kind'];
      return (
        file: file,
        title: title is String && title.length <= 64 ? title : null,
        kind: kind is String && const ['sticker', 'background'].contains(kind)
            ? kind
            : null,
      );
    } catch (_) {
      return (file: file, title: null, kind: null);
    }
  }

  static Future<List<CloudCopy>> list(String owner) async {
    final storage = _storage(owner);
    final backups = <CloudCopy>[];
    for (var offset = 0; ; offset += 100) {
      final page = await storage
          .list(
            path: owner,
            searchOptions: SearchOptions(
              limit: 100,
              offset: offset,
              sortBy: const SortBy(column: 'name'),
            ),
          )
          .timeout(_timeout);
      final files = page
          .where((file) => file.id != null && uploadBackupId(file.name) != null)
          .toList();
      for (var i = 0; i < files.length; i += 8) {
        backups.addAll(
          await Future.wait(
            files.skip(i).take(8).map((file) => _details(storage, owner, file)),
          ),
        );
      }
      if (page.length < 100) break;
    }
    backups.sort(
      (a, b) => (b.file.createdAt ?? '').compareTo(a.file.createdAt ?? ''),
    );
    return backups;
  }

  static Future<void> upload(String owner, CustomUpload item) async {
    if (await item.image.length() > maxUploadImageBytes) {
      throw const FormatException('The image exceeds the 20 MB backup limit.');
    }
    final bytes = packUploadBackup(
      name: item.name,
      kind: item.kind,
      created: item.created,
      png: await item.image.readAsBytes(),
    );
    final storage = _storage(owner);
    final path = _path(owner, uploadBackupName(item.id));
    try {
      await storage
          .uploadBinary(
            path,
            bytes,
            fileOptions: FileOptions(
              contentType: 'application/octet-stream',
              cacheControl: '0',
              metadata: {'name': item.name, 'kind': item.kind},
            ),
            retryAttempts: 0,
          )
          .timeout(_timeout);
    } on StorageException catch (error) {
      if (error.statusCode == '409' ||
          RegExp(
            r'already exists|duplicate',
            caseSensitive: false,
          ).hasMatch(error.message)) {
        await storage.info(path).timeout(_timeout);
      } else if (error.statusCode == '413' ||
          RegExp(
            r'quota|limit|capacity',
            caseSensitive: false,
          ).hasMatch(error.message)) {
        throw const FormatException('The cloud storage limit was reached.');
      } else {
        rethrow;
      }
    }
  }

  static Future<bool> restore(
    String owner,
    FileObject backup,
    void Function(int) progress,
  ) async {
    final stream = _storage(owner).downloadStream(_path(owner, backup.name));
    final bytes = BytesBuilder(copy: false);
    await for (final chunk in stream.timeout(_timeout)) {
      if (bytes.length + chunk.length > maxUploadBackupBytes) {
        throw const FormatException('This backup exceeds the size limit.');
      }
      bytes.add(chunk);
      progress(bytes.length);
    }
    final item = unpackUploadBackup(bytes.takeBytes(), backup.name);
    final image = await CustomUploads.prepare(item.image);
    return CustomUploads.restore(item, image, () => _storage(owner));
  }

  static Future<void> delete(String owner, String name) async {
    final deleted = await _storage(owner)
        .remove([_path(owner, name)])
        .timeout(_timeout);
    if (deleted.isEmpty) {
      throw const FormatException(
        'The cloud copy could not be deleted. Refresh the list and try again.',
      );
    }
  }
}
