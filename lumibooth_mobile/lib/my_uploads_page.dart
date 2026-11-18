import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'booth.dart';
import 'cloud_backup.dart';
import 'cloud_backup_page.dart';
import 'custom_uploads.dart';

class MyUploadsPage extends StatefulWidget {
  const MyUploadsPage({
    super.key,
    this.kind = 'sticker',
    this.selecting = false,
  });
  final String kind;
  final bool selecting;
  @override
  State<MyUploadsPage> createState() => _MyUploadsPageState();
}

class _MyUploadsPageState extends State<MyUploadsPage> {
  late String _kind = widget.kind;
  late Future<List<CustomUpload>> _items = CustomUploads.list();
  bool _busy = false;
  String? _error;
  void _refresh() {
    if (mounted) setState(() => _items = CustomUploads.list());
  }

  Future<void> _import() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await CustomUploads.setPickerKind(_kind);
      final file = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (file == null) return;
      if (await file.length() > CustomUploads.maxBytes) {
        throw const FormatException('Choose an image smaller than 20 MB.');
      }
      final prepared = await CustomUploads.prepare(await file.readAsBytes());
      final item = await CustomUploads.add(prepared, file.name, _kind);
      _refresh();
      if (mounted && widget.selecting) await _preview(item);
    } on FormatException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Could not import this image. Check device storage and try again.',
        );
      }
    } finally {
      try {
        await CustomUploads.takePickerKind();
      } catch (_) {}
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _preview(CustomUpload item) async {
    final use = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item.name),
        content: SizedBox(
          width: 280,
          height: 240,
          child: Image.file(
            item.image,
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) => const Text(
              'This upload is missing or damaged. Remove it and import it again.',
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Close'),
          ),
          if (widget.selecting)
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(
                _kind == 'sticker' ? 'Use sticker' : 'Use background',
              ),
            ),
        ],
      ),
    );
    if (use == true && mounted) Navigator.pop(context, item);
  }

  Future<void> _manage(CustomUpload item, String action) async {
    if (action == 'rename') {
      final name = await showDialog<String>(
        context: context,
        builder: (_) => _RenameUploadDialog(name: item.name),
      );
      if (name != null) {
        try {
          await CustomUploads.rename(item, name);
          _refresh();
        } catch (_) {
          if (mounted) {
            setState(() => _error = 'Could not rename this upload. Try again.');
          }
        }
      }
    } else {
      final yes = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Delete this upload?'),
          content: const Text(
            'This removes it from My Uploads. Saved strips and the current draft keep their own copies. Your original gallery file stays on your device.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep upload'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete'),
            ),
          ],
        ),
      );
      if (yes == true) {
        try {
          await CustomUploads.delete(item);
          _refresh();
        } catch (_) {
          if (mounted) {
            setState(() => _error = 'Could not delete this upload. Try again.');
          }
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('My Uploads')),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'A little more you.',
            style: TextStyle(fontFamily: 'Playfair Display', fontSize: 30),
          ),
          const SizedBox(height: 12),
          const Text(
            'My Uploads stores local copies. Clearing app data or uninstalling removes them from this device.',
            style: TextStyle(color: muted, height: 1.5),
          ),
          if (!widget.selecting && CloudBackup.enabled)
            TextButton(
              onPressed: _busy
                  ? null
                  : () async {
                      await openCloudBackup(context, uploads: true);
                      _refresh();
                    },
              child: const Text('Cloud backup'),
            ),
          const SizedBox(height: 20),
          if (!widget.selecting)
            DropdownButtonFormField<String>(
              initialValue: _kind,
              decoration: const InputDecoration(labelText: 'Upload type'),
              items: const [
                DropdownMenuItem(value: 'sticker', child: Text('Stickers')),
                DropdownMenuItem(
                  value: 'background',
                  child: Text('Backgrounds'),
                ),
              ],
              onChanged: _busy
                  ? null
                  : (value) {
                      if (value != null) setState(() => _kind = value);
                    },
            ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _busy ? null : _import,
            icon: const Icon(Icons.add_photo_alternate_outlined),
            label: Text(
              _busy
                  ? 'Importing image…'
                  : 'Upload your own ${_kind == 'sticker' ? 'sticker' : 'background'}',
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Still PNG, JPEG or WebP · up to 20 MB / 32 MP. Imported copies use a maximum 2048-pixel edge.',
            style: TextStyle(fontSize: 12, color: muted, height: 1.5),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                _error!,
                style: const TextStyle(color: Color(0xffa03040)),
              ),
            ),
          const SizedBox(height: 20),
          FutureBuilder<List<CustomUpload>>(
            future: _items,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return TextButton(
                  onPressed: _refresh,
                  child: const Text('Could not load uploads. Tap to retry.'),
                );
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final items = snapshot.data!
                  .where((item) => item.kind == _kind)
                  .toList();
              if (items.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text(
                    'Make room for your own style. Upload an image to begin.',
                    style: TextStyle(color: muted),
                  ),
                );
              }
              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: items.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: .85,
                ),
                itemBuilder: (context, i) {
                  final item = items[i];
                  return Card(
                    margin: EdgeInsets.zero,
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: _busy ? null : () => _preview(item),
                            child: Container(
                              width: double.infinity,
                              color: wash,
                              padding: const EdgeInsets.all(12),
                              child: Image.file(
                                item.thumbnail,
                                fit: BoxFit.contain,
                                errorBuilder: (_, _, _) =>
                                    const Icon(Icons.broken_image_outlined),
                              ),
                            ),
                          ),
                        ),
                        Row(
                          children: [
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(left: 12),
                                child: Text(
                                  item.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                            PopupMenuButton<String>(
                              tooltip: 'Upload options',
                              enabled: !_busy,
                              onSelected: (action) => _manage(item, action),
                              itemBuilder: (_) => const [
                                PopupMenuItem(
                                  value: 'rename',
                                  child: Text('Rename'),
                                ),
                                PopupMenuItem(
                                  value: 'delete',
                                  child: Text('Delete'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ],
      ),
    ),
  );
}

class _RenameUploadDialog extends StatefulWidget {
  const _RenameUploadDialog({required this.name});
  final String name;
  @override
  State<_RenameUploadDialog> createState() => _RenameUploadDialogState();
}

class _RenameUploadDialogState extends State<_RenameUploadDialog> {
  late final TextEditingController _name = TextEditingController(
    text: widget.name,
  );
  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Rename upload'),
    content: TextField(
      controller: _name,
      maxLength: 64,
      decoration: const InputDecoration(labelText: 'Name'),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (_name.text.trim().isNotEmpty) {
            Navigator.pop(context, _name.text.trim());
          }
        },
        child: const Text('Save'),
      ),
    ],
  );
}
