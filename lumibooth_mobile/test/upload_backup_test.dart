import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:lumibooth_mobile/cloud_upload_backup.dart';
import 'package:lumibooth_mobile/custom_uploads.dart';
import 'package:lumibooth_mobile/online_booth.dart';
import 'package:lumibooth_mobile/upload_backup_archive.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _LocalHttp extends HttpOverrides {}

class _UploadsDirectory extends PathProviderPlatform {
  _UploadsDirectory(this.path);
  final String path;
  @override
  Future<String?> getApplicationSupportPath() async => path;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('upload backups match the web archive and support the same IDs', () {
    final id = 'upload-1700000000000000-3';
    final header = utf8.encode(
      '{"version":1,"name":"Café","kind":"sticker","createdAt":1700000000000,"type":"image/png"}',
    );
    final prefix = ByteData(4)..setUint32(0, header.length);
    final image = Uint8List.fromList([137, 80, 78, 71]);
    final fixture = Uint8List.fromList([
      ...prefix.buffer.asUint8List(),
      ...header,
      ...image,
    ]);
    final restored = unpackUploadBackup(fixture, uploadBackupName(id));
    expect(restored.id, id);
    expect(restored.name, 'Café');
    expect(restored.image, image);
    expect(
      packUploadBackup(
        name: restored.name,
        kind: restored.kind,
        created: restored.created,
        png: image,
      ),
      fixture,
    );
    expect(
      () => unpackUploadBackup(fixture, '../invalid.lumi'),
      throwsFormatException,
    );
  });

  const localBackend = String.fromEnvironment('LUMI_SUPABASE_URL');
  test(
    'Flutter uploads and restores a private backup against local Supabase',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'upload-backup-test',
      );
      addTearDown(() => directory.delete(recursive: true));
      PathProviderPlatform.instance = _UploadsDirectory(directory.path);
      await HttpOverrides.runWithHttpOverrides(() async {
        FlutterSecureStorage.setMockInitialValues({});
        SharedPreferences.setMockInitialValues({});
        await OnlineBooth.initialize();
        addTearDown(Supabase.instance.dispose);
        final auth = OnlineBooth.accountAuth!;
        final account = await auth.signUp(
          email: 'flutter-${DateTime.now().microsecondsSinceEpoch}@example.com',
          password: 'local-uploads-test-password',
        );
        final owner = account.user!.id;
        final source = img.Image(width: 24, height: 16, numChannels: 4);
        source.setPixelRgba(4, 8, 255, 0, 0, 255);
        final local = await CustomUploads.add(
          await CustomUploads.prepare(
            Uint8List.fromList(img.encodePng(source)),
          ),
          'Cloud star',
          'sticker',
        );
        expect(await CloudUploadBackup.list(owner), isEmpty);
        await CloudUploadBackup.upload(owner, local);
        try {
          await CloudUploadBackup.upload(owner, local);
          final backup = (await CloudUploadBackup.list(owner)).single;
          expect(backup.title, 'Cloud star');
          expect(backup.kind, 'sticker');
          await CustomUploads.delete(local);
          expect(
            await CloudUploadBackup.restore(owner, backup.file, (_) {}),
            isTrue,
          );
          expect(
            await CloudUploadBackup.restore(owner, backup.file, (_) {}),
            isFalse,
          );
          final restored = (await CustomUploads.list()).single;
          expect(restored.id, local.id);
          final restoredImage = img.decodePng(
            await restored.image.readAsBytes(),
          )!;
          expect(restoredImage.getPixel(4, 8).r, 255);
          expect(restoredImage.getPixel(0, 0).a, 0);
        } finally {
          await CloudUploadBackup.delete(owner, uploadBackupName(local.id));
        }
        expect(await CloudUploadBackup.list(owner), isEmpty);
        expect((await CustomUploads.list()).single.name, 'Cloud star');
      }, _LocalHttp());
    },
    skip:
        !const bool.fromEnvironment('LUMI_CLOUD_BACKUP') ||
        !const [
          'http://127.0.0.1:54321',
          'http://localhost:54321',
        ].contains(localBackend),
  );
}
