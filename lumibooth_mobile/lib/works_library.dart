import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import 'booth.dart';
import 'print_strip.dart';
import 'saved_works.dart';

typedef EditWork = Future<void> Function(SavedWork work);

class WorksLibrary extends StatefulWidget {
  const WorksLibrary({super.key, required this.onEdit});
  final EditWork onEdit;
  @override
  State<WorksLibrary> createState() => _WorksLibraryState();
}

class _WorksLibraryState extends State<WorksLibrary> {
  late Future<List<SavedWork>> _items = SavedWorks.list();
  bool _list = false;
  String? _busy;
  void refresh() {
    if (mounted) setState(() => _items = SavedWorks.list());
  }

  Future<void> _action(
    SavedWork work,
    String action,
    BuildContext anchor,
  ) async {
    if (_busy != null) return;
    if (action == 'delete') {
      final yes = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Delete this work?'),
          content: const Text(
            'This deletes its saved strip and editing copy from this device. Your current draft and exported files will stay.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep work'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete'),
            ),
          ],
        ),
      );
      if (yes != true || !mounted) return;
    }
    setState(() => _busy = work.id);
    try {
      if (action == 'delete') {
        await SavedWorks.delete(work);
        refresh();
      } else if (action == 'edit') {
        await widget.onEdit(work);
      } else {
        final bytes = await work.poster.readAsBytes();
        if (action == 'print') {
          await printStrip(bytes);
        } else if (anchor.mounted) {
          final box = anchor.findRenderObject() as RenderBox;
          await SharePlus.instance.share(
            ShareParams(
              files: [XFile.fromData(bytes, mimeType: 'image/png')],
              fileNameOverrides: ['lumibooth-strip.png'],
              sharePositionOrigin: box.localToGlobal(Offset.zero) & box.size,
            ),
          );
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Could not open this work or complete that action. Try again; you can delete damaged works.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Widget _menu(SavedWork work, {bool preview = false}) => Builder(
    builder: (anchor) => PopupMenuButton<String>(
      tooltip: 'More options for saved strip',
      enabled: _busy == null,
      onSelected: (action) async {
        if (preview && action == 'edit') Navigator.of(context).pop();
        await _action(work, action, anchor);
        if (preview && action == 'delete') {
          final exists = await work.directory.exists();
          if (mounted && !exists) Navigator.of(context).pop();
        }
      },
      itemBuilder: (_) => [
        if (work.editable)
          const PopupMenuItem(value: 'edit', child: Text('Edit')),
        const PopupMenuItem(value: 'export', child: Text('Export / share')),
        const PopupMenuItem(value: 'print', child: Text('Print')),
        const PopupMenuItem(value: 'delete', child: Text('Delete')),
      ],
    ),
  );
  String _date(SavedWork work) {
    if (work.created.year == 1970) return 'Unavailable work';
    final date = work.created.toLocal();
    return '${date.day}/${date.month}/${date.year} · ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _open(SavedWork work) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(
            title: const Text('Your strip'),
            actions: [_menu(work, preview: true)],
          ),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Expanded(
                    child: Image.file(
                      work.poster,
                      fit: BoxFit.contain,
                      errorBuilder: (_, _, _) => const Center(
                        child: Text(
                          'This strip is missing or damaged. You can delete it from the menu.',
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(_date(work)),
                  if (!work.editable)
                    const Text(
                      'Preview and export only. Editable sources are unavailable.',
                    ),
                  if (work.editable)
                    FilledButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        _action(work, 'edit', context);
                      },
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Edit strip'),
                    ),
                  Builder(
                    builder: (anchor) => TextButton.icon(
                      onPressed: () => _action(work, 'export', anchor),
                      icon: const Icon(Icons.ios_share),
                      label: const Text('Export / share'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    refresh();
  }

  Widget _card(SavedWork work) => Card(
    margin: EdgeInsets.zero,
    clipBehavior: Clip.antiAlias,
    child: Column(
      children: [
        Expanded(
          child: InkWell(
            onTap: () => _open(work),
            child: Container(
              width: double.infinity,
              color: wash,
              padding: const EdgeInsets.all(12),
              child: Image.file(
                work.thumbnail,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) =>
                    const Icon(Icons.broken_image_outlined, color: muted),
              ),
            ),
          ),
        ),
        Row(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Photo strip',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      _date(work),
                      style: const TextStyle(color: muted, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),
            _menu(work),
          ],
        ),
      ],
    ),
  );
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          const Expanded(
            child: Text(
              'Your works',
              style: TextStyle(fontFamily: 'Playfair Display', fontSize: 28),
            ),
          ),
          IconButton(
            tooltip: _list ? 'Grid view' : 'List view',
            onPressed: () => setState(() => _list = !_list),
            icon: Icon(_list ? Icons.grid_view : Icons.view_list_outlined),
          ),
          IconButton(
            tooltip: 'Refresh works',
            onPressed: refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      const Text(
        'Saved on this device',
        style: TextStyle(color: muted, fontSize: 13),
      ),
      const SizedBox(height: 16),
      FutureBuilder<List<SavedWork>>(
        future: _items,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return TextButton(
              onPressed: refresh,
              child: const Text('Could not load your works. Tap to retry.'),
            );
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final works = snapshot.data!;
          if (works.isEmpty) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Text(
                'Your keepsakes will appear here. Finish a strip and tap Save to Your works.',
                style: TextStyle(color: muted, height: 1.5),
              ),
            );
          }
          final megabytes =
              works.fold<int>(0, (sum, work) => sum + work.bytes) /
              (1024 * 1024);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${works.length} works · ${megabytes.toStringAsFixed(1)} MB',
                style: const TextStyle(color: muted, fontSize: 12),
              ),
              const SizedBox(height: 12),
              if (_list)
                ...works.map(
                  (work) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Image.file(
                      work.thumbnail,
                      width: 48,
                      errorBuilder: (_, _, _) =>
                          const Icon(Icons.broken_image_outlined),
                    ),
                    title: const Text('Photo strip'),
                    subtitle: Text(_date(work)),
                    trailing: _menu(work),
                    onTap: () => _open(work),
                  ),
                )
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: works.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: .72,
                  ),
                  itemBuilder: (_, i) => _card(works[i]),
                ),
            ],
          );
        },
      ),
    ],
  );
}
