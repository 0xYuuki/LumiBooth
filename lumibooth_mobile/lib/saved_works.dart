import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

class SavedWork {
  const SavedWork(
    this.id,
    this.created,
    this.bytes,
    this.directory,
    this.editable,
  );
  final String id;
  final DateTime created;
  final int bytes;
  final Directory directory;
  final bool editable;
  File get poster => File('${directory.path}/strip.png');
  File get thumbnail => File('${directory.path}/thumbnail.png');
  Future<Map<String, dynamic>> project() async =>
      jsonDecode(await File('${directory.path}/project.json').readAsString())
          as Map<String, dynamic>;
}

/// Each completed work owns its sources; deleting a draft or another work cannot affect it.
class SavedWorks {
  static Future<Directory> _root() async =>
      Directory('${(await getApplicationSupportDirectory()).path}/works');
  static Future<void> _queue = Future.value();
  static int _serial = 0;
  static Future<T> _write<T>(Future<T> Function() action) {
    final next = _queue.catchError((_) {}).then((_) => action());
    _queue = next.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return next;
  }

  static Future<List<SavedWork>> list() async {
    final root = await _root();
    if (!await root.exists()) return [];
    final works = <SavedWork>[];
    await for (final entity in root.list()) {
      if (entity is! Directory || entity.path.split('/').last.startsWith('.')) {
        continue;
      }
      try {
        final data = jsonDecode(
          await File('${entity.path}/metadata.json').readAsString(),
        ) as Map<String, dynamic>;
        var bytes = 0;
        await for (final file in entity.list()) {
          if (file is File) bytes += await file.length();
        }
        works.add(
          SavedWork(
            entity.path.split('/').last,
            DateTime.parse(data['created'] as String),
            bytes,
            entity,
            await File('${entity.path}/project.json').exists(),
          ),
        );
      } catch (_) {
        // Keep a damaged item visible so the owner can delete it.
        works.add(
          SavedWork(
            entity.path.split('/').last,
            DateTime.fromMillisecondsSinceEpoch(0),
            0,
            entity,
            false,
          ),
        );
      }
    }
    works.sort((a, b) => b.created.compareTo(a.created));
    return works;
  }

  static Future<void> save(
    Map<String, dynamic>? project,
    Uint8List png,
    Uint8List thumbnail,
  ) => _write(() async {
    final root = await _root();
    await root.create(recursive: true);
    final id = '${DateTime.now().microsecondsSinceEpoch}-${_serial++}';
    final temp = Directory('${root.path}/.$id');
    try {
      await temp.create();
      await File('${temp.path}/strip.png').writeAsBytes(png, flush: true);
      await File('${temp.path}/thumbnail.png')
          .writeAsBytes(thumbnail, flush: true);
      if (project != null) {
        await File('${temp.path}/project.json')
            .writeAsString(jsonEncode(project), flush: true);
      }
      await File('${temp.path}/metadata.json').writeAsString(
        jsonEncode({
          'version': 1,
          'created': DateTime.now().toUtc().toIso8601String(),
        }),
        flush: true,
      );
      await temp.rename('${root.path}/$id');
    } catch (_) {
      if (await temp.exists()) await temp.delete(recursive: true);
      rethrow;
    }
  });
  static Future<void> delete(SavedWork work) => _write(() async {
    final root = await _root();
    if (work.directory.parent.path != root.path) {
      throw ArgumentError('Invalid work');
    }
    if (await work.directory.exists()) {
      await work.directory.delete(recursive: true);
    }
  });
}
