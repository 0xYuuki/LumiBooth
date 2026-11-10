import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:share_plus/share_plus.dart';

import 'camera_framing.dart';
import 'capture.dart';
import 'gallery_qr.dart';
import 'motion_photo.dart';
import 'motion_strip_export.dart';
import 'motion_strip_view.dart';
import 'online_booth.dart';
import 'print_strip.dart';
import 'remote_booth.dart';
import 'strip.dart';
import 'sticker_pack.dart';
import 'sticker_controls.dart';

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
            if (OnlineBooth.remoteEnabled)
              OutlinedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => RemoteBoothPage(
                      onDesign: (context, room, photos) =>
                          Navigator.of(context).push<void>(
                            MaterialPageRoute(
                              builder: (_) => _SessionPage(
                                layout: StripLayout.remoteDuo,
                                initialPhotos: photos,
                                roomId: room,
                              ),
                            ),
                          ),
                    ),
                  ),
                ),
                child: const Text('Booth with a friend'),
              ),
            if (OnlineBooth.printEnabled)
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const _PrintLinksPage(),
                  ),
                ),
                child: const Text('Manage gallery links'),
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
  const _SessionPage({
    required this.layout,
    this.initialPhotos = const [],
    this.roomId,
  });

  final StripLayout layout;
  final List<ui.Image> initialPhotos;
  final String? roomId;

  @override
  State<_SessionPage> createState() => _SessionPageState();
}

class _SessionPageState extends State<_SessionPage>
    with WidgetsBindingObserver {
  final List<ui.Image> _photos = [];
  final Set<int> _motionShots = {};
  final Map<int, MotionGifJob> _motionJobs = {};
  final Map<int, Uint8List> _motionGifs = {};
  int? _playingMotion;
  bool _playingStrip = false;
  bool _ending = false;
  final List<StripSticker> _stickers = [];
  final Map<String, ui.Image> _stickerImages = {};
  late final Future<List<StickerPack>> _stickerCatalog =
      StickerPack.loadCatalog();
  StickerPack _stickerPack = StickerPack.emoji;
  bool _loadingStickerPack = false;
  static const _captionLimit = 32;
  final _captionController = TextEditingController(
    text: StripFrame.studio.caption,
  );
  String? _caption;
  StripFont _stripFont = StripFont.outfit;
  StripFrame _frame = StripFrame.studio;
  FrameImages? _frameImages;
  bool _loadingFrame = false;
  Uint8List? _png;
  Timer? _idle;
  int? _selected;
  bool _exporting = false;
  bool _sharing = false;
  bool _preparingMotion = false;
  int _motionGeneration = 0;
  Uint8List? _motionStrip;
  Map<String, dynamic>? _printTicket;
  bool? _galleryHasMotion;
  ({String url, String expiresAt})? _printLink;

  bool get _captured => _photos.length == widget.layout.requiredPhotos;

  StripDesign get _design => StripDesign(
    layout: widget.layout,
    frame: _frame,
    caption: _caption,
    font: _stripFont,
    frameImages: _frameImages,
    photos: _photos,
    stickers: List.unmodifiable(_stickers),
  );

  @override
  void initState() {
    super.initState();
    _photos.addAll(widget.initialPhotos);
    if (widget.roomId != null) {
      _caption = 'MILES APART, SAME MOMENT';
      _captionController.text = _caption!;
      unawaited(_chooseFrame(StripFrame.tubeTV));
    }
    WidgetsBinding.instance.addObserver(this);
    _keepAlive();
  }

  void _keepAlive() {
    _idle?.cancel();
    _idle = Timer(const Duration(minutes: 5), () {
      if (mounted && (ModalRoute.of(context)?.isCurrent ?? false)) _finish();
    });
  }

  void _finish() {
    _ending = true;
    _idle?.cancel();
    setState(_discardMotion);
    if (widget.roomId != null) {
      Navigator.of(context).pop();
    } else {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.hidden ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      setState(_discardMotion);
    }
  }

  void _discardMotion() {
    _motionGeneration++;
    _motionStrip = null;
    for (final job in _motionJobs.values) {
      job.cancel();
    }
    _motionJobs.clear();
    for (final bytes in _motionGifs.values) {
      PaintingBinding.instance.imageCache.evict(MemoryImage(bytes));
    }
    _motionGifs.clear();
    _playingMotion = null;
    _playingStrip = false;
  }

  void _onPhoto(ui.Image image, {MotionClip? motion}) {
    if (_ending || _captured || !(ModalRoute.of(context)?.isCurrent ?? false)) {
      image.dispose();
      return;
    }
    _keepAlive();
    final shot = _photos.length + 1;
    final job = motion != null && motion.frames.length >= 2
        ? MotionGifJob(motion)
        : null;
    setState(() {
      _photos.add(image);
      if (motion != null) _motionShots.add(shot);
      if (job != null) _motionJobs[shot] = job;
    });
    if (job != null) unawaited(_completeMotion(shot, job));
  }

  Future<void> _completeMotion(int shot, MotionGifJob job) async {
    final bytes = await job.result;
    if (!mounted || _motionJobs[shot] != job) return;
    setState(() {
      _motionJobs.remove(shot);
      if (bytes != null) _motionGifs[shot] = bytes;
    });
  }

  Future<void> _chooseStickerPack(StickerPack pack) async {
    if (_loadingStickerPack || pack == _stickerPack) return;
    if (pack == StickerPack.emoji || _stickerImages.containsKey(pack.id)) {
      setState(() => _stickerPack = pack);
      return;
    }
    setState(() => _loadingStickerPack = true);
    try {
      final image = await pack.loadImage();
      if (!mounted) {
        image.dispose();
        return;
      }
      setState(() {
        _stickerImages[pack.id] = image;
        _stickerPack = pack;
      });
    } catch (_) {
      if (mounted) _message('Could not load this sticker pack. Try again.');
    } finally {
      if (mounted) setState(() => _loadingStickerPack = false);
    }
  }

  void _addSticker(StripSticker sticker) {
    setState(() {
      _stickers.add(sticker);
      _selected = _stickers.length - 1;
    });
  }

  void _setCaption(String? value) {
    setState(() => _caption = value);
    _captionController.text = value ?? _frame.caption;
    _keepAlive();
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
      if (_caption == null) _captionController.text = frame.caption;
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

  Future<void> _share(
    BuildContext buttonContext,
    Uint8List bytes,
    String filename,
    String mimeType,
  ) async {
    if (_sharing) return;
    final box = buttonContext.findRenderObject() as RenderBox;
    final origin = box.localToGlobal(Offset.zero) & box.size;
    setState(() => _sharing = true);
    try {
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(bytes, mimeType: mimeType)],
          fileNameOverrides: [filename],
          sharePositionOrigin: origin,
        ),
      );
    } catch (_) {
      if (mounted) _message('Could not open sharing. Try again.');
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  Future<void> _print({String? replayUrl, String? expiry}) async {
    final bytes = _png;
    if (bytes == null || _sharing) return;
    setState(() => _sharing = true);
    try {
      await printStrip(bytes, replayUrl: replayUrl, expiry: expiry);
    } catch (_) {
      if (mounted) _message('Could not open printing. Try again.');
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  Future<Uint8List> _animatedStrip() async {
    if (_motionStrip case final cached?) return cached;
    final generation = _motionGeneration;
    bool active() => mounted && !_ending && generation == _motionGeneration;
    final bytes = await exportMotionStrip(
      _design,
      Map.of(_motionGifs),
      active: active,
    );
    if (!active()) throw StateError('Motion is no longer available.');
    return _motionStrip = bytes;
  }

  Future<void> _saveAnimation(BuildContext button) async {
    setState(() => _preparingMotion = true);
    try {
      final gif = await _animatedStrip();
      if (button.mounted && mounted) {
        await _share(button, gif, 'lumibooth-motion-strip.gif', 'image/gif');
      }
    } catch (_) {
      if (mounted) _message('Could not save the animated strip.');
    } finally {
      if (mounted) setState(() => _preparingMotion = false);
    }
  }

  Future<void> _shareWithQr(Uint8List png, {required bool print}) async {
    if (_printLink case final link?) {
      await _showGallery(link, print: print);
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(print ? 'Print with QR' : 'Share with QR'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.memory(png, height: 140, fit: BoxFit.contain),
            const SizedBox(height: 8),
            Text(
              'Upload your individual photos and finished strip'
              '${_motionGifs.isNotEmpty ? ', including the animated GIF,' : ''} through '
              '${MaterialLocalizations.of(dialog).formatShortDate(DateTime.now().add(const Duration(days: 90)))}. '
              'Anyone with the code can view and download these files.',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text(print ? 'Print without QR' : 'Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text(print ? 'Upload and print' : 'Upload and show QR'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed == null) return;
    if (!confirmed) {
      if (print) await _print();
      return;
    }
    setState(() => _preparingMotion = true);
    try {
      Uint8List? gif;
      if (_motionGifs.isNotEmpty) {
        try {
          gif = await _animatedStrip();
          if (gif.length > 16 * 1024 * 1024) gif = null;
        } catch (_) {
          // The gallery can still share every still when animation export fails.
        }
        if (gif == null && mounted && !_ending) {
          _message(
            'The animation was unavailable. The gallery includes your still photos.',
          );
        }
      }
      final originals = <Uint8List>[];
      for (final photo in _photos) {
        if (!mounted || _ending) return;
        originals.add(await encodeCameraJpeg(photo));
      }
      if (!mounted || _ending) return;
      final hasMotion = gif != null;
      if (_galleryHasMotion != hasMotion) _printTicket = null;
      final resuming = _printTicket != null;
      _printTicket ??= await OnlineBooth.request('share_begin', {
        'originals': originals.length,
        'hasMotion': hasMotion,
      }) as Map<String, dynamic>;
      _galleryHasMotion = hasMotion;
      final ticket = _printTicket!;
      if (!mounted || _ending) return;
      final uploads = resuming
          ? await OnlineBooth.request('share_uploads', {'id': ticket['id']})
                as Map<String, dynamic>
          : ticket;
      if (!mounted || _ending) return;
      if (uploads['published'] != true) {
        await Future.wait([
          OnlineBooth.upload(
            uploads['poster'] as Map<String, dynamic>,
            png,
            'image/png',
          ),
          if (gif != null)
            OnlineBooth.upload(
              uploads['motion'] as Map<String, dynamic>,
              gif,
              'image/gif',
            ),
          for (final (index, photo) in originals.indexed)
            OnlineBooth.upload(
              (uploads['originals'] as List)[index] as Map<String, dynamic>,
              photo,
              'image/jpeg',
            ),
        ]);
      }
      final result = await OnlineBooth.request('share_publish', {
        'id': ticket['id'],
      });
      if (!mounted || _ending) return;
      final expiry = DateTime.parse(result['expiresAt'] as String).toLocal();
      final link = (
        url: OnlineBooth.publicLink('p', ticket['token'] as String).toString(),
        expiresAt: MaterialLocalizations.of(context).formatShortDate(expiry),
      );
      setState(() => _printLink = link);
      await _showGallery(link, print: print);
    } catch (_) {
      if (mounted) {
        _message('Could not create a gallery link. Try again.');
      }
    } finally {
      if (mounted) setState(() => _preparingMotion = false);
    }
  }

  Future<void> _showGallery(
    ({String url, String expiresAt}) link, {
    required bool print,
  }) async {
    if (print) {
      await _print(replayUrl: link.url, expiry: link.expiresAt);
      return;
    }
    await showDialog<void>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('Scan to download photos'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            GalleryQr(url: link.url),
            Text('Gallery available until ${link.expiresAt}.'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Clipboard.setData(ClipboardData(text: link.url)),
            child: const Text('Copy link'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialog),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  Future<void> _sendToFriend(Uint8List png) async {
    setState(() => _sharing = true);
    final payload = {'id': widget.roomId};
    try {
      final ticket = await OnlineBooth.request(
        'room_prepare_final',
        payload,
      ) as Map<String, dynamic>;
      if (ticket['complete'] != true) {
        await OnlineBooth.upload(ticket, png, 'image/png');
        await OnlineBooth.request('room_finish', {
          ...payload,
          'attempt': ticket['asset'],
        });
      }
      if (mounted) _finish();
    } catch (_) {
      if (mounted) _message('Could not send the strip. Try again.');
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  void _updateSticker(int index, StripSticker sticker) {
    if (_exporting) return;
    _keepAlive();
    setState(() {
      _selected = index;
      _stickers[index] = sticker;
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _discardMotion();
    _idle?.cancel();
    _captionController.dispose();
    _frameImages?.dispose();
    for (final image in _stickerImages.values) {
      image.dispose();
    }
    for (final photo in _photos) {
      photo.dispose();
    }
    super.dispose();
  }

  void _editStrip() {
    setState(() {
      _motionGeneration++;
      _motionStrip = null;
      _printTicket = null;
      _galleryHasMotion = null;
      _printLink = null;
      _playingStrip = false;
      _playingMotion = null;
      _png = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final png = _png;
    return PopScope(
      canPop: png == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _png != null && !_preparingMotion && !_sharing) {
          _editStrip();
        }
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
                    total: widget.layout.requiredPhotos,
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
                final height = design.size.height * scale;
                final origin = Offset(
                  (constraints.maxWidth - width) / 2,
                  (constraints.maxHeight - height) / 2,
                );
                return Stack(
                  fit: StackFit.expand,
                  children: [
                    Positioned.fromRect(
                      rect: origin & Size(width, height),
                      child: CustomPaint(
                        painter: StripPainter(design, selected: selected),
                      ),
                    ),
                    for (var i = 0; i < _stickers.length; i++)
                      StickerControls(
                        key: ValueKey(i),
                        sticker: _stickers[i],
                        stripSize: design.size,
                        bounds: _scaleRect(
                          StripPainter.stickerBounds(design, _stickers[i]),
                          scale,
                        ).shift(origin),
                        scale: scale,
                        selected: selected == i,
                        enabled: !_exporting,
                        onSelect: () => setState(() => _selected = i),
                        onChanged: (sticker) => _updateSticker(i, sticker),
                      ),
                  ],
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 20),
        DropdownButtonFormField<StripFont>(
          initialValue: _stripFont,
          decoration: const InputDecoration(
            labelText: 'Strip font',
            border: OutlineInputBorder(),
          ),
          items: [
            for (final font in StripFont.values)
              DropdownMenuItem(value: font, child: Text(font.family)),
          ],
          onChanged: _exporting
              ? null
              : (font) {
                  if (font == null) return;
                  setState(() => _stripFont = font);
                  _keepAlive();
                },
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _captionController,
          enabled: !_exporting,
          maxLength: _captionLimit,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(
            labelText: 'Caption under LumiBooth (optional)',
            hintText: 'Write a short caption',
            border: OutlineInputBorder(),
          ),
          onChanged: (value) {
            setState(() => _caption = value);
            _keepAlive();
          },
        ),
        Wrap(
          spacing: 8,
          children: [
            TextButton(
              onPressed: _exporting || design.footerCaption.isEmpty
                  ? null
                  : () => _setCaption(''),
              child: const Text('Remove caption'),
            ),
            TextButton(
              onPressed: _exporting || _caption == null
                  ? null
                  : () => _setCaption(null),
              child: const Text('Use frame caption'),
            ),
          ],
        ),
        const SizedBox(height: 12),
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
        const Text(
          'Drag a sticker to move it. Use its corner handles to rotate or resize it.',
        ),
        _stickerPicker(),
        if (selected != null) ...[
          const Text('Sticker size'),
          Slider(
            min: StripSticker.minSize,
            max: StripSticker.maxSize,
            label: 'Sticker size',
            value: _stickers[selected].size,
            onChanged: _exporting
                ? null
                : (size) => _updateSticker(
                    selected,
                    _stickers[selected].resizeTo(size, design.size),
                  ),
          ),
          const Text('Sticker rotation'),
          Slider(
            min: -180,
            max: 180,
            label: 'Sticker rotation',
            value: _stickers[selected].angle,
            onChanged: _exporting
                ? null
                : (angle) => _updateSticker(
                    selected,
                    _stickers[selected].copyWith(angle: angle),
                  ),
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

  Widget _stickerPicker() {
    final image = _stickerImages[_stickerPack.id];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FutureBuilder(
          future: _stickerCatalog,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return const Text('Image sticker packs are unavailable.');
            }
            final packs = snapshot.data;
            if (packs == null) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 8),
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Sticker pack',
                  border: OutlineInputBorder(),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<StickerPack>(
                    value: _stickerPack,
                    isExpanded: true,
                    onChanged: _loadingStickerPack || _exporting
                        ? null
                        : (pack) {
                            if (pack != null) _chooseStickerPack(pack);
                          },
                    items: [
                      for (final pack in packs)
                        DropdownMenuItem(value: pack, child: Text(pack.name)),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
        if (_loadingStickerPack) const LinearProgressIndicator(),
        if (image == null)
          Wrap(
            children: [
              for (final symbol in ['✨', '💖', '🎀', '🌸', '🌟', '🦋', '🌈'])
                IconButton(
                  tooltip: 'Add $symbol sticker',
                  onPressed: _exporting
                      ? null
                      : () => _addSticker(
                          StripSticker(symbol, const Offset(.4, .4), 50),
                        ),
                  icon: Text(symbol, style: const TextStyle(fontSize: 24)),
                ),
            ],
          )
        else
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: [
              for (final sticker in _stickerPack.items)
                IconButton(
                  tooltip: 'Add ${sticker.name} sticker',
                  onPressed: _exporting
                      ? null
                      : () => _addSticker(
                          StripSticker(
                            sticker.name,
                            const Offset(.4, .4),
                            72,
                            image: image,
                            source: sticker.source,
                          ),
                        ),
                  icon: CustomPaint(
                    size: const Size(34, 34),
                    painter: StickerImagePainter(image, sticker.source),
                  ),
                ),
            ],
          ),
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
          child: SizedBox(
            height: math.min(MediaQuery.sizeOf(context).height * .48, 480),
            child: _playingStrip
                ? MotionStripView(design: _design, gifs: _motionGifs)
                : Image.memory(
                    png,
                    semanticLabel: 'Your finished LumiBooth photo strip',
                    fit: BoxFit.contain,
                  ),
          ),
        ),
        if (_motionGifs.isNotEmpty)
          TextButton(
            onPressed: _motionJobs.isEmpty
                ? () => setState(() => _playingStrip = !_playingStrip)
                : null,
            child: Text(_playingStrip ? 'Stop strip' : 'Play strip'),
          ),
        if (_motionGifs.isNotEmpty)
          Builder(
            builder: (button) => OutlinedButton(
              onPressed: _preparingMotion || _sharing || _motionJobs.isNotEmpty
                  ? null
                  : () => _saveAnimation(button),
              child: Text(
                _preparingMotion
                    ? 'Preparing animation…'
                    : 'Save or share animated strip',
              ),
            ),
          ),
        const SizedBox(height: 16),
        Builder(
          builder: (context) => FilledButton.icon(
            onPressed: _sharing
                ? null
                : () =>
                      _share(context, png, 'lumibooth-strip.png', 'image/png'),
            icon: const Icon(Icons.ios_share),
            label: const Text('Save or share PNG'),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _sharing ? null : () => _print(),
          icon: const Icon(Icons.print_outlined),
          label: const Text('Print photo'),
        ),
        if (OnlineBooth.printEnabled && widget.roomId == null) ...[
          OutlinedButton(
            onPressed: _sharing || _preparingMotion || _motionJobs.isNotEmpty
                ? null
                : () => _shareWithQr(png, print: false),
            child: const Text('Share with QR'),
          ),
          OutlinedButton(
            onPressed: _sharing || _preparingMotion || _motionJobs.isNotEmpty
                ? null
                : () => _shareWithQr(png, print: true),
            child: const Text('Print with QR'),
          ),
        ],
        if (_printLink case final link?)
          Text('Gallery available until ${link.expiresAt}.'),
        if (widget.roomId != null)
          FilledButton(
            onPressed: _sharing ? null : () => _sendToFriend(png),
            child: const Text('Send strip to friend'),
          ),
        TextButton(
          onPressed: _sharing || _preparingMotion ? null : _editStrip,
          child: const Text('Edit strip'),
        ),
        if (_motionShots.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Motion photos', style: Theme.of(context).textTheme.titleLarge),
          for (final shot in _motionShots) _motionTile(shot),
        ],
      ],
    );
  }

  Widget _motionTile(int shot) {
    final bytes = _motionGifs[shot];
    final playing = _playingMotion == shot;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Shot $shot'),
            if (bytes == null)
              Text(
                _motionJobs.containsKey(shot)
                    ? 'Preparing motion…'
                    : 'Motion unavailable for this shot.',
              )
            else ...[
              Wrap(
                spacing: 8,
                children: [
                  TextButton(
                    onPressed: () =>
                        setState(() => _playingMotion = playing ? null : shot),
                    child: Text(playing ? 'Stop' : 'Play'),
                  ),
                  Builder(
                    builder: (context) => TextButton(
                      onPressed: _sharing
                          ? null
                          : () => _share(
                              context,
                              bytes,
                              'lumibooth-shot-$shot.gif',
                              'image/gif',
                            ),
                      child: const Text('Share GIF'),
                    ),
                  ),
                ],
              ),
              if (playing)
                Image.memory(
                  bytes,
                  semanticLabel: 'Motion from shot $shot',
                  fit: BoxFit.contain,
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PrintLinksPage extends StatefulWidget {
  const _PrintLinksPage();

  @override
  State<_PrintLinksPage> createState() => _PrintLinksPageState();
}

class _PrintLinksPageState extends State<_PrintLinksPage> {
  late Future<dynamic> _links = OnlineBooth.request('share_list');
  bool _revoking = false;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Manage gallery links')),
    body: SafeArea(
      child: FutureBuilder<dynamic>(
        future: _links,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(
              child: TextButton(
                onPressed: () =>
                    setState(() => _links = OnlineBooth.request('share_list')),
                child: const Text('Could not load links. Retry'),
              ),
            );
          }
          final links = snapshot.data as List?;
          if (links == null) {
            return const Center(child: CircularProgressIndicator());
          }
          if (links.isEmpty) {
            return const Center(child: Text('No active links on this device.'));
          }
          return ListView(
            children: [
              for (final link in links)
                ListTile(
                  title: Text(
                    'Expires ${MaterialLocalizations.of(context).formatShortDate(DateTime.parse(link['expires_at'] as String).toLocal())}',
                  ),
                  subtitle: Text(
                    'Created ${MaterialLocalizations.of(context).formatShortDate(DateTime.parse(link['created_at'] as String).toLocal())}',
                  ),
                  trailing: TextButton(
                    onPressed: _revoking
                        ? null
                        : () async {
                            setState(() => _revoking = true);
                            try {
                              await OnlineBooth.request('share_revoke', {
                                'id': link['id'],
                              });
                              if (mounted) {
                                setState(
                                  () => _links = OnlineBooth.request(
                                    'share_list',
                                  ),
                                );
                              }
                            } catch (_) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Could not revoke the link. Try again.',
                                    ),
                                  ),
                                );
                              }
                            } finally {
                              if (mounted) setState(() => _revoking = false);
                            }
                          },
                    child: const Text('Revoke'),
                  ),
                ),
            ],
          );
        },
      ),
    ),
  );
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
