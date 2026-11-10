import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:pdf/widgets.dart' as pdf;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import 'capture.dart';
import 'strip.dart';

const paper = Color(0xfffaf8f4);
const lavender = Color(0xffeee8f7);
const purple = Color(0xff523884);

class LumiBooth extends StatelessWidget {
  const LumiBooth({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: purple,
      surface: paper,
    ).copyWith(primary: purple);
    return MaterialApp(
      title: 'LumiBooth',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: scheme,
        scaffoldBackgroundColor: paper,
        appBarTheme: const AppBarTheme(
          backgroundColor: paper,
          surfaceTintColor: Colors.transparent,
        ),
        cardTheme: const CardThemeData(color: Colors.white, elevation: 0),
      ),
      home: const _WelcomePage(),
    );
  }
}

class _WelcomePage extends StatelessWidget {
  const _WelcomePage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LumiBooth.')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const _Heading(
              'THE DIGITAL PHOTO BOOTH',
              'Make a little keepsake.',
              'Pick a layout, take your photos, and give your strip a frame of its own.',
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const _LayoutPage()),
              ),
              icon: const Icon(Icons.arrow_forward),
              label: const Text('Start photo booth'),
            ),
            const SizedBox(height: 24),
            const _Stage(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  StripPreview(
                    StripDesign(
                      layout: StripLayout('Three', 3, 1),
                      frame: StripFrame.postcard,
                    ),
                    maxWidth: 60,
                  ),
                  SizedBox(width: 18),
                  StripPreview(
                    StripDesign(
                      layout: StripLayout('Four', 4, 2),
                      frame: StripFrame.lavender,
                    ),
                    maxWidth: 112,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LayoutPage extends StatelessWidget {
  const _LayoutPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LumiBooth.')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const _Heading(
              'STEP 01 OF 04',
              'Choose your layout.',
              'How many photos would you like on your strip?',
            ),
            const SizedBox(height: 16),
            for (final layout in StripLayout.choices)
              Card(
                clipBehavior: Clip.antiAlias,
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 6,
                  ),
                  leading: SizedBox(
                    width: 42,
                    child: Center(
                      child: StripPreview(
                        StripDesign(layout: layout, frame: StripFrame.lavender),
                        maxWidth: layout.count == 3 ? 17 : 28,
                      ),
                    ),
                  ),
                  title: Text(layout.name),
                  subtitle: Text(
                    '${layout.count} ${layout.count == 1 ? 'photo' : 'photos'}',
                  ),
                  trailing: const Icon(Icons.arrow_outward, size: 18),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => _SessionPage(layout: layout),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SessionPage extends StatefulWidget {
  const _SessionPage({required this.layout});

  final StripLayout layout;

  @override
  State<_SessionPage> createState() => _SessionPageState();
}

class _SessionPageState extends State<_SessionPage> {
  final List<ui.Image> _photos = [];
  final List<StripSticker> _stickers = [];
  StripFrame _frame = StripFrame.studio;
  FrameImages? _frameImages;
  bool _loadingFrame = false;
  Uint8List? _png;
  Timer? _idle;
  int? _selected;
  bool _exporting = false;
  bool _sharing = false;

  bool get _captured => _photos.length == widget.layout.count;

  StripDesign get _design => StripDesign(
    layout: widget.layout,
    frame: _frame,
    frameImages: _frameImages,
    photos: _photos,
    stickers: List.unmodifiable(_stickers),
  );

  @override
  void initState() {
    super.initState();
    _keepAlive();
  }

  void _keepAlive() {
    _idle?.cancel();
    _idle = Timer(const Duration(minutes: 5), () {
      if (mounted && (ModalRoute.of(context)?.isCurrent ?? false)) _finish();
    });
  }

  void _finish() {
    _idle?.cancel();
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  void _onPhoto(ui.Image image) {
    if (_captured) {
      image.dispose();
      return;
    }
    _keepAlive();
    setState(() => _photos.add(image));
  }

  Future<void> _chooseFrame(StripFrame frame) async {
    if (_loadingFrame || _exporting || frame == _frame) return;
    final art = frame.art;
    if (art != null) setState(() => _loadingFrame = true);
    try {
      final images = art == null ? null : await FrameImages.load(art);
      if (!mounted) {
        images?.dispose();
        return;
      }
      final previous = _frameImages;
      setState(() {
        _frame = frame;
        _frameImages = images;
        _loadingFrame = false;
      });
      previous?.dispose();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingFrame = false);
      _message('Could not load this frame. Try again.');
    }
  }

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      final png = await _design.exportPng();
      if (mounted) setState(() => _png = png);
    } catch (_) {
      if (mounted) _message('Could not export the strip. Try again.');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  void _message(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _share(BuildContext buttonContext) async {
    final bytes = _png;
    if (bytes == null || _sharing) return;
    final box = buttonContext.findRenderObject() as RenderBox;
    final origin = box.localToGlobal(Offset.zero) & box.size;
    setState(() => _sharing = true);
    try {
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(bytes, mimeType: 'image/png')],
          fileNameOverrides: ['lumibooth-strip.png'],
          sharePositionOrigin: origin,
        ),
      );
    } catch (_) {
      if (mounted) _message('Could not open sharing. Try again.');
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  Future<void> _print() async {
    final bytes = _png;
    if (bytes == null || _sharing) return;
    setState(() => _sharing = true);
    try {
      await Printing.layoutPdf(
        name: 'LumiBooth photo strip',
        onLayout: (format) async {
          final document = pdf.Document();
          document.addPage(
            pdf.Page(
              pageFormat: format,
              margin: const pdf.EdgeInsets.all(18),
              build: (_) => pdf.Center(
                child: pdf.Image(
                  pdf.MemoryImage(bytes),
                  fit: pdf.BoxFit.contain,
                ),
              ),
            ),
          );
          return document.save();
        },
      );
    } catch (_) {
      if (mounted) _message('Could not open printing. Try again.');
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  void _moveSticker(int index, Offset delta) {
    _keepAlive();
    final sticker = _stickers[index];
    final size = _design.size;
    final position = Offset(
      (sticker.position.dx + delta.dx / (size.width - sticker.size)).clamp(
        0.0,
        1.0,
      ),
      (sticker.position.dy + delta.dy / (size.height - sticker.size)).clamp(
        0.0,
        1.0,
      ),
    );
    setState(() {
      _selected = index;
      _stickers[index] = StripSticker(sticker.symbol, position, sticker.size);
    });
  }

  @override
  void dispose() {
    _idle?.cancel();
    _frameImages?.dispose();
    for (final photo in _photos) {
      photo.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final png = _png;
    return PopScope(
      canPop: png == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _png != null) setState(() => _png = null);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            png != null
                ? '04 / FINISH'
                : _captured
                ? '03 / DESIGN'
                : '02 / CAPTURE',
          ),
          actions: [
            TextButton(onPressed: _finish, child: const Text('End session')),
          ],
        ),
        body: SafeArea(
          child: Listener(
            behavior: HitTestBehavior.translucent,
            onPointerDown: (_) => _keepAlive(),
            onPointerMove: (_) => _keepAlive(),
            child: png != null
                ? _preview(png)
                : _captured
                ? _editor()
                : CapturePage(
                    captured: _photos.length,
                    total: widget.layout.count,
                    onPhoto: _onPhoto,
                  ),
          ),
        ),
        bottomNavigationBar: _captured && png == null
            ? SafeArea(
                minimum: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: FilledButton(
                  onPressed: _exporting || _loadingFrame ? null : _export,
                  child: Text(_exporting ? 'Preparing…' : 'Preview strip'),
                ),
              )
            : null,
      ),
    );
  }

  Widget _editor() {
    final design = _design;
    final selected = _selected;
    return ListView(
      key: const ValueKey('editor'),
      padding: const EdgeInsets.all(20),
      children: [
        const _Heading(
          'STEP 03 OF 04',
          'Make it yours.',
          'Choose a frame and decorate your strip.',
        ),
        const SizedBox(height: 16),
        _Stage(
          child: SizedBox(
            height: math.min(MediaQuery.sizeOf(context).height * .46, 440),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final width = math.min(
                  constraints.maxWidth,
                  constraints.maxHeight * design.size.aspectRatio,
                );
                final scale = width / design.width;
                return Center(
                  child: SizedBox(
                    width: width,
                    height: design.size.height * scale,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        CustomPaint(
                          painter: StripPainter(design, selected: selected),
                        ),
                        for (var i = 0; i < _stickers.length; i++)
                          Positioned.fromRect(
                            rect: _scaleRect(
                              StripPainter.stickerBounds(design, _stickers[i]),
                              scale,
                            ),
                            child: Semantics(
                              button: true,
                              label: 'Select ${_stickers[i].symbol} sticker',
                              selected: selected == i,
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: _exporting
                                    ? null
                                    : () => setState(() => _selected = i),
                                onPanUpdate: _exporting
                                    ? null
                                    : (event) =>
                                          _moveSticker(i, event.delta / scale),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 20),
        Text('Frame templates', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final frame in StripFrame.values)
              ChoiceChip(
                avatar: frame.art != null
                    ? Image.asset(
                        FrameArt.asset(frame.art!.name),
                        width: 22,
                        fit: BoxFit.contain,
                        excludeFromSemantics: true,
                      )
                    : CircleAvatar(backgroundColor: frame.paper),
                label: Text(frame.label),
                selected: _frame == frame,
                onSelected: _exporting || _loadingFrame
                    ? null
                    : (_) => _chooseFrame(frame),
              ),
          ],
        ),
        const SizedBox(height: 16),
        Text('Stickers', style: Theme.of(context).textTheme.titleLarge),
        const Text('Tap to add a sticker, then drag it into place.'),
        Wrap(
          children: [
            for (final symbol in ['✨', '💖', '🎀', '🌸', '🌟', '🦋', '🌈'])
              IconButton(
                tooltip: 'Add $symbol sticker',
                onPressed: _exporting
                    ? null
                    : () => setState(() {
                        _stickers.add(
                          StripSticker(symbol, const Offset(.4, .4), 50),
                        );
                        _selected = _stickers.length - 1;
                      }),
                icon: Text(symbol, style: const TextStyle(fontSize: 24)),
              ),
          ],
        ),
        if (selected != null) ...[
          const Text('Sticker size'),
          Slider(
            min: 20,
            max: 120,
            label: 'Sticker size',
            value: _stickers[selected].size,
            onChanged: _exporting
                ? null
                : (size) => setState(() {
                    final sticker = _stickers[selected];
                    _stickers[selected] = StripSticker(
                      sticker.symbol,
                      sticker.position,
                      size,
                    );
                  }),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _exporting
                  ? null
                  : () => setState(() {
                      _stickers.removeAt(selected);
                      _selected = null;
                    }),
              icon: const Icon(Icons.delete_outline),
              label: const Text('Remove sticker'),
            ),
          ),
        ],
      ],
    );
  }

  Rect _scaleRect(Rect rect, double scale) => Rect.fromLTRB(
    rect.left * scale,
    rect.top * scale,
    rect.right * scale,
    rect.bottom * scale,
  );

  Widget _preview(Uint8List png) {
    return ListView(
      key: const ValueKey('preview'),
      padding: const EdgeInsets.all(20),
      children: [
        const _Heading(
          'STEP 04 OF 04',
          'Your strip is ready.',
          'Share it, save it, or print a copy.',
        ),
        const SizedBox(height: 16),
        _Stage(
          child: Image.memory(
            png,
            semanticLabel: 'Your finished LumiBooth photo strip',
            fit: BoxFit.contain,
            height: math.min(MediaQuery.sizeOf(context).height * .48, 480),
          ),
        ),
        const SizedBox(height: 16),
        Builder(
          builder: (context) => FilledButton.icon(
            onPressed: _sharing ? null : () => _share(context),
            icon: const Icon(Icons.ios_share),
            label: const Text('Save or share PNG'),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _sharing ? null : _print,
          icon: const Icon(Icons.print_outlined),
          label: const Text('Print photo'),
        ),
        TextButton(
          onPressed: _sharing ? null : () => setState(() => _png = null),
          child: const Text('Edit strip'),
        ),
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.step, this.title, this.subtitle);

  final String step;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          step,
          style: const TextStyle(
            color: purple,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            fontSize: 11,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          title,
          style: Theme.of(context).textTheme.displaySmall
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
      ],
    );
  }
}

class _Stage extends StatelessWidget {
  const _Stage({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: lavender,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Padding(padding: const EdgeInsets.all(16), child: child),
  );
}
