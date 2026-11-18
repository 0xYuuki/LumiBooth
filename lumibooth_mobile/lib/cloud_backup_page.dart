import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'backup_archive.dart';
import 'cloud_backup.dart';
import 'cloud_upload_backup.dart';
import 'custom_uploads.dart';
import 'online_booth.dart';
import 'saved_works.dart';
import 'upload_backup_archive.dart';

Future<void> openCloudBackup(
  BuildContext context, {
  bool uploads = false,
}) async {
  final auth = OnlineBooth.accountAuth;
  final user = auth?.currentUser;
  if (auth == null ||
      user == null ||
      user.isAnonymous ||
      OnlineBooth.accountRecovery.value) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sign in from Me to use cloud backup.')),
    );
    return;
  }
  await Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) => CloudBackupPage(auth: auth, user: user, uploads: uploads),
    ),
  );
}

class CloudBackupPage extends StatefulWidget {
  const CloudBackupPage({
    super.key,
    required this.auth,
    required this.user,
    this.uploads = false,
  });

  final GoTrueClient auth;
  final User user;
  final bool uploads;

  @override
  State<CloudBackupPage> createState() => _CloudBackupPageState();
}

typedef _DeviceCopy = ({
  String id,
  String title,
  String? kind,
  DateTime created,
  File thumbnail,
  int bytes,
  Future<void> Function() upload,
});

class _CloudBackupPageState extends State<CloudBackupPage> {
  final _selected = <String>{};
  List<_DeviceCopy> _local = [];
  List<CloudCopy> _cloud = [];
  late final StreamSubscription<AuthState> _account;
  bool _loading = false;
  bool _busy = false;
  bool _signedIn = true;
  String? _notice;
  String? _loadError;
  String? _error;

  String get _owner => widget.user.id;
  String get _email => widget.user.email ?? 'your account';
  String get _noun => widget.uploads ? 'upload' : 'strip';
  String get _destination => widget.uploads ? 'My Uploads' : 'Your works';
  String _name(String id) =>
      widget.uploads ? uploadBackupName(id) : mobileBackupName(id);

  Future<List<_DeviceCopy>> _deviceCopies() async {
    if (widget.uploads) {
      final items = await CustomUploads.list();
      return Future.wait(
        items.map(
          (item) async => (
            id: item.id,
            title: item.name,
            kind: item.kind,
            created: item.created,
            thumbnail: item.thumbnail,
            bytes: await item.image.length().onError<FileSystemException>(
              (_, _) => 0,
            ),
            upload: () => CloudUploadBackup.upload(_owner, item),
          ),
        ),
      );
    }
    return (await SavedWorks.list())
        .map<_DeviceCopy>(
          (work) => (
            id: work.id,
            title: 'Saved strip',
            kind: null,
            created: work.created,
            thumbnail: work.thumbnail,
            bytes: work.bytes,
            upload: () => CloudBackup.upload(_owner, work),
          ),
        )
        .toList();
  }

  Future<List<CloudCopy>> _cloudCopies() async => widget.uploads
      ? CloudUploadBackup.list(_owner)
      : (await CloudBackup.list(_owner))
            .map<CloudCopy>((file) => (file: file, title: null, kind: null))
            .toList();

  @override
  void initState() {
    super.initState();
    _account = widget.auth.onAuthStateChange.listen((_) {
      if (mounted &&
          (widget.auth.currentUser?.id != _owner ||
              OnlineBooth.accountRecovery.value)) {
        setState(() => _signedIn = false);
      }
    }, onError: (Object _) {});
    unawaited(_reload());
  }

  @override
  void dispose() {
    unawaited(_account.cancel());
    super.dispose();
  }

  Future<void> _reload() async {
    if (_loading || !_signedIn) return;
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      await Future.wait<void>([
        _deviceCopies().then((items) {
          if (mounted) setState(() => _local = items);
        }),
        _cloudCopies().then((items) {
          if (mounted) setState(() => _cloud = items);
        }),
      ]);
    } catch (_) {
      if (mounted) {
        setState(
          () => _loadError = 'Could not refresh every list. Check your connection or try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<bool> _confirm(String title, String content, String label) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(title),
          content: Text(content),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(label),
            ),
          ],
        ),
      ) ??
      false;

  void _progress(String message) {
    if (mounted) setState(() => _notice = message);
  }

  Future<void> _run(Future<void> Function() action) async {
    if (!mounted || _busy || !_signedIn) return;
    setState(() {
      _busy = true;
      _notice = null;
      _error = null;
    });
    try {
      await action();
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error is FormatException ? error.message : 'Could not finish that action. Check your connection and try again.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        await _reload();
      }
    }
  }

  Future<void> _upload(List<_DeviceCopy> chosen, int bytes) async {
    if (!await _confirm(
      'Back up selected ${_noun}s?',
      'Upload ${chosen.length} ${widget.uploads ? 'stickers and backgrounds' : 'strips and their editing files'} (about ${_size(bytes)}) to the private backups for $_email.',
      'Back up',
    )) {
      return;
    }
    await _run(() async {
      final failures = <String>[];
      var done = 0;
      for (final (i, work) in chosen.indexed) {
        if (!mounted || !_signedIn) return;
        _progress('Backing up ${i + 1} of ${chosen.length}…');
        try {
          await work.upload();
          done++;
          if (mounted) setState(() => _selected.remove(work.id));
        } catch (error) {
          failures.add(
            error is FormatException
                ? error.message
                : 'Upload failed. Try again when online.',
          );
        }
      }
      _progress('$done of ${chosen.length} selected ${_noun}s backed up.');
      if (mounted && failures.isNotEmpty) {
        setState(() => _error = failures.toSet().join(' '));
      }
    });
  }

  Future<void> _restore(FileObject backup) => _run(() async {
    _progress('Downloading $_noun…');
    final total = _bytes(backup);
    void progress(int bytes) => _progress(
      'Downloading $_noun · ${_size(bytes)}${total == 0 ? '' : ' of ${_size(total)}'}',
    );
    final inserted = widget.uploads
        ? await CloudUploadBackup.restore(_owner, backup, progress)
        : await CloudBackup.restore(_owner, backup, progress);
    _progress(
      inserted
          ? '${widget.uploads ? 'Upload' : 'Strip'} restored to $_destination.'
          : 'This $_noun is already in $_destination.',
    );
  });

  Future<void> _delete(FileObject backup) async {
    if (!await _confirm(
      'Delete cloud backup?',
      'Copies in $_destination on your devices will stay.',
      'Delete backup',
    )) {
      return;
    }
    await _run(() async {
      if (widget.uploads) {
        await CloudUploadBackup.delete(_owner, backup.name);
      } else {
        await CloudBackup.delete(_owner, backup.name);
      }
      _progress('Cloud backup deleted.');
    });
  }

  static String _kindLabel(String kind) =>
      kind == 'sticker' ? 'Sticker' : 'Background';

  static String _size(int bytes) =>
      '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  static int _bytes(FileObject backup) =>
      (backup.metadata?['size'] as num?)?.toInt() ?? 0;

  String _date(DateTime? value) {
    if (value == null) return 'Date unavailable';
    final date = value.toLocal();
    final localizations = MaterialLocalizations.of(context);
    return '${localizations.formatMediumDate(date)} · ${localizations.formatTimeOfDay(TimeOfDay.fromDateTime(date))}';
  }

  @override
  Widget build(BuildContext context) {
    final names = _cloud.map((backup) => backup.file.name).toSet();
    final chosen = _local
        .where(
          (work) =>
              _selected.contains(work.id) && !names.contains(_name(work.id)),
        )
        .toList();
    final bytes = chosen.fold(0, (sum, work) => sum + work.bytes);
    final enabled = !_loading && !_busy;
    final heading = Theme.of(context).textTheme.titleLarge;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.uploads ? 'Upload cloud backup' : 'Cloud backup'),
      ),
      body: !_signedIn
          ? const Center(child: Text('Sign in again to use cloud backup.'))
          : SafeArea(
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Text(
                    'Backups are private to $_email. Only selected ${widget.uploads ? 'stickers and backgrounds' : 'strips'} are uploaded after confirmation. Restoring adds a local copy.',
                  ),
                  if (_loading) const LinearProgressIndicator(),
                  if (_loadError != null) ...[
                    Text(_loadError!),
                    TextButton(
                      onPressed: enabled ? _reload : null,
                      child: const Text('Retry'),
                    ),
                  ],
                  if (_notice != null)
                    Semantics(liveRegion: true, child: Text(_notice!)),
                  if (_error != null)
                    Semantics(liveRegion: true, child: Text(_error!)),
                  const SizedBox(height: 16),
                  Text('On this device', style: heading),
                  if (!_loading && _local.isEmpty)
                    Text(
                      widget.uploads
                          ? 'Import a sticker or background in My Uploads to back it up.'
                          : 'Save a finished strip to Your works to back it up.',
                    ),
                  for (final work in _local)
                    CheckboxListTile(
                      secondary: Image.file(
                        work.thumbnail,
                        width: 40,
                        height: 48,
                        fit: BoxFit.contain,
                        excludeFromSemantics: true,
                        errorBuilder: (_, _, _) =>
                            const Icon(Icons.photo_outlined),
                      ),
                      title: Text(work.title),
                      subtitle: Text(
                        '${work.kind == null ? '' : '${_kindLabel(work.kind!)} · '}${_date(work.created)} · ${names.contains(_name(work.id)) ? 'Backed up' : _size(work.bytes)}',
                      ),
                      value:
                          _selected.contains(work.id) ||
                          names.contains(_name(work.id)),
                      onChanged: enabled && !names.contains(_name(work.id))
                          ? (value) {
                              setState(() {
                                if (value == true) {
                                  _selected.add(work.id);
                                } else {
                                  _selected.remove(work.id);
                                }
                              });
                            }
                          : null,
                    ),
                  FilledButton(
                    onPressed: enabled && chosen.isNotEmpty
                        ? () => _upload(chosen, bytes)
                        : null,
                    child: Text(
                      chosen.isEmpty
                          ? 'Back up selected'
                          : 'Back up ${chosen.length} · about ${_size(bytes)}',
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text('In your cloud backup', style: heading),
                  if (!_loading && _loadError == null && _cloud.isEmpty)
                    const Text('No backups yet.'),
                  for (final backup in _cloud)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${backup.title ?? (widget.uploads ? 'Upload' : 'Strip')}${backup.kind == null ? '' : ' · ${_kindLabel(backup.kind!)}'} backed up ${_date(DateTime.tryParse(backup.file.createdAt ?? ''))} · ${_size(_bytes(backup.file))}',
                            ),
                            Wrap(
                              children: [
                                TextButton(
                                  onPressed: enabled
                                      ? () => _restore(backup.file)
                                      : null,
                                  child: Text('Restore $_noun'),
                                ),
                                TextButton(
                                  onPressed: enabled
                                      ? () => _delete(backup.file)
                                      : null,
                                  child: const Text('Delete backup'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
