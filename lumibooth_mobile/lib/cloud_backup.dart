import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'backup_archive.dart';
import 'online_booth.dart';
import 'saved_works.dart';

abstract final class CloudBackup {
  static bool get enabled =>
      const bool.fromEnvironment('LUMI_CLOUD_BACKUP') &&
      OnlineBooth.accountAuth != null;
  static const _timeout = Duration(seconds: 45);
  static const _bucket = 'lumi-private-backups';

  static StorageFileApi _storage(String owner) {
    final user = OnlineBooth.accountAuth?.currentSession?.user;
    if (!enabled ||
        user == null ||
        user.id != owner ||
        user.isAnonymous ||
        OnlineBooth.accountRecovery.value) {
      throw StateError('Sign in again to use cloud backup.');
    }
    return Supabase.instance.client.storage.from(_bucket);
  }

  static String _path(String owner, String name) {
    if (!backupNamePattern.hasMatch(name)) {
      throw ArgumentError('Invalid backup name.');
    }
    return '$owner/$name';
  }

  static Future<List<FileObject>> list(String owner) async {
    final storage = _storage(owner);
    final backups = <FileObject>[];
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
      backups.addAll(
        page.where(
          (item) => item.id != null && backupNamePattern.hasMatch(item.name),
        ),
      );
      if (page.length < 100) break;
    }
    backups.sort((a, b) => (b.createdAt ?? '').compareTo(a.createdAt ?? ''));
    return backups;
  }

  static Future<void> upload(String owner, SavedWork work) async {
    if (work.bytes > maxBackupBytes) {
      throw const FormatException('This strip exceeds the 24 MB backup limit.');
    }
    final bytes = packMobileBackup(
      poster: await work.poster.readAsBytes(),
      created: work.created,
      project: work.editable ? await work.project() : null,
    );
    final storage = _storage(owner);
    final path = _path(owner, mobileBackupName(work.id));
    try {
      await storage
          .uploadBinary(
            path,
            bytes,
            fileOptions: const FileOptions(
              contentType: 'application/octet-stream',
              cacheControl: '0',
            ),
            retryAttempts: 0,
          )
          .timeout(_timeout);
    } on StorageException catch (error) {
      if (error.statusCode != '409' &&
          !RegExp(
            r'already exists|duplicate',
            caseSensitive: false,
          ).hasMatch(error.message)) {
        rethrow;
      }
      await storage.info(path).timeout(_timeout);
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
      if (bytes.length + chunk.length > maxBackupBytes) {
        throw const FormatException('This backup exceeds the size limit.');
      }
      bytes.add(chunk);
      progress(bytes.length);
    }
    final work = await compute(_prepareRestore, (
      bytes.takeBytes(),
      backup.name,
    ));
    _storage(owner);
    return SavedWorks.restore(
      work.backup.id,
      work.backup.created,
      work.backup.project,
      work.backup.poster,
      work.thumbnail,
    );
  }

  static Future<void> delete(String owner, String name) async {
    await _storage(owner).remove([_path(owner, name)]).timeout(_timeout);
  }
}

({RestoredBackup backup, Uint8List thumbnail}) _prepareRestore(
  (Uint8List, String) input,
) {
  final backup = unpackMobileBackup(input.$1, input.$2);
  final image = img.decodePng(backup.poster);
  if (image == null) throw const FormatException('Invalid strip PNG.');
  final thumbnail = image.width >= image.height
      ? img.copyResize(image, width: 280)
      : img.copyResize(image, height: 280);
  return (backup: backup, thumbnail: img.encodePng(thumbnail));
}
