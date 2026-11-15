import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// One device-local still-photo draft. Writes are atomic and ordered.
class LocalDraft {
  static int generation = 0;
  static Future<void> _queue = Future.value();
  static Future<File> _file() async =>
      File('${(await getApplicationSupportDirectory()).path}/photo-draft.json');
  static Future<Map<String, dynamic>?> load() async {
    final file = await _file();
    if (!await file.exists()) return null;
    final data = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
    return data['version'] == 1 ? data : null;
  }

  static Future<void> clear() {
    generation++;
    return _queue = _queue.catchError((_) {}).then((_) async {
      final file = await _file();
      if (await file.exists()) await file.delete();
    });
  }

  static Future<void> save(Map<String, dynamic> data, int expectedGeneration) {
    return _queue = _queue.catchError((_) {}).then((_) async {
      if (expectedGeneration != generation) return;
      final file = await _file();
      await file.parent.create(recursive: true);
      final temporary = File('${file.path}.tmp');
      await temporary.writeAsString(jsonEncode(data), flush: true);
      if (expectedGeneration == generation) {
        await temporary.rename(file.path);
      } else if (await temporary.exists()) {
        await temporary.delete();
      }
    });
  }
}
