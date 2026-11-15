import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';

import 'camera_framing.dart';
import 'capture.dart';
import 'gallery_qr.dart';
import 'motion_photo.dart';
import 'motion_strip_export.dart';
import 'motion_strip_view.dart';
import 'navigation.dart';
import 'online_booth.dart';
import 'print_strip.dart';
import 'remote_booth.dart';
import 'strip.dart';
import 'sticker_pack.dart';
import 'sticker_controls.dart';
import 'photo_crop_controls.dart';

const paper = Color(0xfffaf8f4);
const lavender = Color(0xffeee8f7);
const purple = Color(0xff523884);
const ink = Color(0xff23202a);
const muted = Color(0xff615a68);
const line = Color(0xffe4dfe6);
const wash = Color(0xffeee8f7);

class LumiBooth extends StatelessWidget {
  const LumiBooth({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: purple,
      surface: paper,
    ).copyWith(primary: purple, onSurface: ink);
    return MaterialApp(
      title: 'LumiBooth',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        fontFamily: 'Outfit',
        colorScheme: scheme,
        scaffoldBackgroundColor: paper,
        appBarTheme: const AppBarTheme(
          backgroundColor: paper,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: line),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: purple,
            foregroundColor: Colors.white,
            minimumSize: const Size(0, 48),
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(9),
            ),
            textStyle: const TextStyle(
              fontFamily: 'Outfit',
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: ink,
            backgroundColor: Colors.white,
            side: const BorderSide(color: line),
            minimumSize: const Size(0, 48),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(9),
            ),
            textStyle: const TextStyle(
              fontFamily: 'Outfit',
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: purple,
            textStyle: const TextStyle(
              fontFamily: 'Outfit',
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: line),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: line),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: purple, width: 1.5),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 12,
          ),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: Colors.white,
          selectedColor: const Color(0xfffaf7ff),
          side: const BorderSide(color: line),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          labelStyle: const TextStyle(
            fontFamily: 'Outfit',
            fontSize: 13,
            color: ink,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        ),
      ),
      home: const MainNavigationScaffold(),
    );
  }
}

/// The primary welcome screen and entrypoint to the photo booth workflow.
class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key});

  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage> {
  final ImagePicker _imagePicker = ImagePicker();
  bool _selectingGallery = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_restoreGallerySelection());
    });
  }

  Future<void> _restoreGallerySelection() async {
    try {
      final result = await _imagePicker.retrieveLostData();
      if (result.exception != null) {
        if (mounted) {
          _showMessage(
            'The previous photo selection was interrupted. Choose your photos again.',
          );
        }
        return;
      }
      final files = result.files;
      if (result.isEmpty || files == null || files.isEmpty || !mounted) return;
      await _openGalleryFiles(files);
    } catch (_) {
      if (mounted) {
        _showMessage('Could not restore the photo selection. Try again.');
      }
    }
  }

  Future<void> _chooseFromGallery() => Navigator.of(context).push<void>(
    MaterialPageRoute(builder: (_) => const _LayoutPage(fromGallery: true)),
  );

  Future<void> _openGalleryFiles(List<XFile> files) async {
    if (files.length > 12) {
      _showMessage('Choose up to 12 photos at a time.');
      return;
    }

    setState(() => _selectingGallery = true);
    final images = <ui.Image>[];
    var failed = 0;
    for (final file in files) {
      try {
        images.add(await _decodeGalleryImage(file));
      } catch (_) {
        failed++;
      }
    }

    if (!mounted) {
      for (final image in images) {
        image.dispose();
      }
      return;
    }
    if (images.isEmpty) {
      _showMessage(
        'No supported photos could be opened. Choose JPEG, PNG, or WebP images.',
      );
      setState(() => _selectingGallery = false);
      return;
    }
    setState(() => _selectingGallery = false);
    if (failed > 0) _showMessage('$failed photos could not be restored.');
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _LayoutPage(fromGallery: true, recoveredPhotos: images),
      ),
    );
    for (final image in images) {
      image.dispose();
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const _BoothHeader(step: 'THE PHOTO BOOTH'),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Row(
              children: [
                Image.asset(
                  'assets/images/logo_mark.png',
                  width: 28,
                  height: 28,
                  fit: BoxFit.contain,
                ),
                const SizedBox(width: 10),
                const Flexible(
                  child: Text(
                    'THE DIGITAL PHOTO BOOTH',
                    style: TextStyle(
                      fontFamily: 'Outfit',
                      color: purple,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.8,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text.rich(
              const TextSpan(
                children: [
                  TextSpan(text: 'Make a little\n'),
                  TextSpan(
                    text: 'keepsake.',
                    style: TextStyle(
                      fontFamily: 'Playfair Display',
                      fontStyle: FontStyle.italic,
                      color: purple,
                    ),
                  ),
                ],
              ),
              style: const TextStyle(
                fontFamily: 'Playfair Display',
                fontSize: 44,
                fontWeight: FontWeight.w400,
                height: 1.05,
                letterSpacing: -1.2,
                color: ink,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Pick a layout, take your photos, and give your strip a frame of its own.',
              style: TextStyle(
                fontFamily: 'Outfit',
                color: muted,
                fontSize: 15,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const _LayoutPage()),
              ),
              icon: const Icon(Icons.arrow_forward),
              label: const Text('Start photo booth'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _selectingGallery ? null : _chooseFromGallery,
              icon: _selectingGallery
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.photo_library_outlined),
              label: Text(
                _selectingGallery ? 'Preparing photos…' : 'Choose from gallery',
              ),
            ),
            if (OnlineBooth.remoteEnabled) ...[
              const SizedBox(height: 10),
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
            ],
            if (OnlineBooth.printEnabled) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const _PrintLinksPage(),
                  ),
                ),
                child: const Text('Manage gallery links'),
              ),
            ],
            const SizedBox(height: 28),
            Container(
              height: 260,
              decoration: BoxDecoration(
                gradient: const RadialGradient(
                  center: Alignment(0, -0.1),
                  radius: 0.95,
                  colors: [Color(0xfff8f2fd), Color(0xffe8def2)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Positioned(
                    top: 16,
                    right: 24,
                    child: Text(
                      '✳',
                      style: TextStyle(
                        fontSize: 28,
                        color: purple.withValues(alpha: 0.55),
                      ),
                    ),
                  ),
                  Transform.translate(
                    offset: const Offset(-45, -8),
                    child: Transform.rotate(
                      angle: -16 * math.pi / 180,
                      child: Container(
                        decoration: const BoxDecoration(
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x38392b52),
                              blurRadius: 18,
                              offset: Offset(0, 10),
                            ),
                          ],
                        ),
                        child: const StripPreview(
                          StripDesign(
                            layout: StripLayout('Three', 3, 1),
                            frame: StripFrame.postcard,
                          ),
                          maxWidth: 62,
                        ),
                      ),
                    ),
                  ),
                  Transform.translate(
                    offset: const Offset(42, 12),
                    child: Transform.rotate(
                      angle: 13 * math.pi / 180,
                      child: Container(
                        decoration: const BoxDecoration(
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x38392b52),
                              blurRadius: 18,
                              offset: Offset(0, 10),
                            ),
                          ],
                        ),
                        child: const StripPreview(
                          StripDesign(
                            layout: StripLayout('Four', 4, 2),
                            frame: StripFrame.lavender,
                          ),
                          maxWidth: 110,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            const _BoothFooter(),
          ],
        ),
      ),
    );
  }
}

Future<ui.Image> _decodeGalleryImage(XFile file) async {
  final bytes = await file.readAsBytes();
  if (bytes.isEmpty) throw const FormatException('The photo is empty.');
  final codec = await ui.instantiateImageCodec(
    bytes,
    targetWidth: 1600,
    targetHeight: 1600,
    allowUpscaling: false,
  );
  try {
    return (await codec.getNextFrame()).image;
  } finally {
    codec.dispose();
  }
}

class _LayoutPage extends StatelessWidget {
  const _LayoutPage({
    this.fromGallery = false,
    this.recoveredPhotos = const [],
    this.onSelected,
  });
  final bool fromGallery;
  final List<ui.Image> recoveredPhotos;
  final ValueChanged<StripLayout>? onSelected;

  Widget _layoutCard(BuildContext context, StripLayout layout) {
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: line),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {
          if (onSelected != null) {
            onSelected!(layout);
            return;
          }
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => _SessionPage(
                layout: layout,
                fromGallery: fromGallery,
                initialPhotos: [
                  for (final image in recoveredPhotos) image.clone(),
                ],
              ),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: wash,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Center(
                    child: StripPreview(
                      StripDesign(layout: layout, frame: StripFrame.lavender),
                      maxWidth: layout.count == 3 ? 24 : 44,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          layout.name,
                          style: const TextStyle(
                            fontFamily: 'Outfit',
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                            color: ink,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${layout.count} ${layout.count == 1 ? 'photo' : 'photos'}',
                          style: const TextStyle(
                            fontFamily: 'Outfit',
                            fontSize: 13,
                            color: muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_outward, size: 18, color: purple),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _BoothHeader(
        step: '01 / LAYOUT',
        onHome: () => Navigator.of(context).pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _StepBack(number: 1, onBack: () => Navigator.of(context).pop()),
            const _Heading(
              '',
              'Choose your layout.',
              'How many photos would you like on your strip?',
            ),
            const SizedBox(height: 20),
            LayoutBuilder(
              builder: (context, constraints) {
                final columns = constraints.maxWidth > 540 ? 3 : 2;
                final spacing = 12.0;
                final cardWidth =
                    (constraints.maxWidth - spacing * (columns - 1)) / columns;
                return Wrap(
                  spacing: spacing,
                  runSpacing: spacing,
                  children: [
                    for (final layout in StripLayout.choices)
                      SizedBox(
                        width: cardWidth,
                        height: 220,
                        child: _layoutCard(context, layout),
                      ),
                  ],
                );
              },
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
    this.fromGallery = false,
    this.roomId,
  });

  final StripLayout layout;
  final List<ui.Image> initialPhotos;
  final bool fromGallery;
  final String? roomId;

  @override
  State<_SessionPage> createState() => _SessionPageState();
}

class _SessionPageState extends State<_SessionPage>
    with WidgetsBindingObserver {
  final List<ui.Image> _photos = [];
  final List<int> _selectedIndices = [];
  final Set<int> _removedPhotos = {};
  final Map<int, PhotoCrop> _crops = {};
  int _cropPhoto = 0;
  int get _activeCount => _photos.length - _removedPhotos.length;
  bool _choosingPhotos = false;
  bool _reviewing = false;
  bool _pickingImages = false;
  late StripLayout _layout = widget.layout;
  late int _captureGoal = _layout.requiredPhotos;
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
  int _editorTab = 0;
  String _frameCategory = 'All';
  bool _exporting = false;
  bool _sharing = false;
  bool _preparingMotion = false;
  int _motionGeneration = 0;
  Uint8List? _motionStrip;
  Map<String, dynamic>? _printTicket;
  bool? _galleryHasMotion;
  ({String url, String expiresAt})? _printLink;

  int get _targetCaptureCount => _captureGoal;
  bool get _captured => _reviewing;

  List<ui.Image> get _stripPhotos => [
    for (final i in _selectedIndices)
      if (i >= 0 && i < _photos.length && !_removedPhotos.contains(i))
        _photos[i],
  ];

  Map<int, Uint8List> get _selectedMotionGifs {
    final map = <int, Uint8List>{};
    for (var i = 0; i < _selectedIndices.length; i++) {
      final bytes = _motionGifs[_selectedIndices[i] + 1];
      if (bytes != null) map[i + 1] = bytes;
    }
    return map;
  }

  StripDesign get _design => StripDesign(
    layout: _layout,
    frame: _frame,
    caption: _caption,
    font: _stripFont,
    frameImages: _frameImages,
    photos: _stripPhotos,
    crops: [
      for (final index in _selectedIndices) _crops[index] ?? const PhotoCrop(),
    ],
    stickers: List.unmodifiable(_stickers),
  );

  @override
  void initState() {
    super.initState();
    _photos.addAll(widget.initialPhotos);
    if (widget.initialPhotos.isNotEmpty || widget.fromGallery) {
      _initializeSelection(fill: true);
    }
    if (widget.roomId != null) _choosingPhotos = false;
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.roomId != null) {
        Navigator.of(context).pop();
      } else {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    });
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
    if (_ending ||
        _reviewing ||
        _activeCount >= 12 ||
        !(ModalRoute.of(context)?.isCurrent ?? false)) {
      image.dispose();
      return;
    }
    _keepAlive();
    late int shot;
    final job = motion != null && motion.frames.length >= 2
        ? MotionGifJob(motion)
        : null;
    setState(() {
      shot = _storePhoto(image) + 1;
      if (_selectedIndices.length < _layout.requiredPhotos) {
        _selectedIndices.add(shot - 1);
      }
      if (motion != null) _motionShots.add(shot);
      if (job != null) _motionJobs[shot] = job;
      if (_activeCount >= _targetCaptureCount) {
        _initializeSelection();
      }
    });
    if (job != null) unawaited(_completeMotion(shot, job));
  }

  void _finishCaptureEarly() => setState(_initializeSelection);

  void _initializeSelection({bool fill = false}) {
    _reviewing = true;
    if (fill) {
      for (
        var i = 0;
        i < _photos.length && _selectedIndices.length < _layout.requiredPhotos;
        i++
      ) {
        if (!_removedPhotos.contains(i) && !_selectedIndices.contains(i)) {
          _selectedIndices.add(i);
        }
      }
    }
    _choosingPhotos = true;
  }

  void _takeMore() {
    if (_activeCount >= 12) {
      _message('Remove a photo before taking more.');
      return;
    }
    setState(() {
      _reviewing = false;
      _captureGoal = math.max(_layout.requiredPhotos, _activeCount + 1);
    });
  }

  Future<void> _addGallery() async {
    if (_pickingImages) return;
    setState(() => _pickingImages = true);
    final decoded = <ui.Image>[];
    try {
      final files = await ImagePicker().pickMultiImage(
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 92,
      );
      if (!mounted || _ending || files.isEmpty) return;
      if (_activeCount + files.length > 12) {
        _message('Choose up to 12 photos. Remove a photo first.');
        return;
      }
      var failed = 0;
      for (final file in files) {
        try {
          decoded.add(await _decodeGalleryImage(file));
        } catch (_) {
          failed++;
        }
      }
      if (!mounted || _ending) return;
      setState(() {
        for (final image in decoded) {
          final index = _storePhoto(image);
          if (_selectedIndices.length < _layout.requiredPhotos) {
            _selectedIndices.add(index);
          }
        }
        decoded.clear();
        _initializeSelection();
      });
      if (failed > 0) _message('$failed photos could not be opened.');
    } catch (_) {
      if (mounted) _message('Could not open the photo library. Try again.');
    } finally {
      for (final image in decoded) {
        image.dispose();
      }
      if (mounted) setState(() => _pickingImages = false);
    }
  }

  void _moveSelected(int index, int offset) {
    final at = _selectedIndices.indexOf(index),
        target = _selectedIndices.indexOf(index) + offset;
    if (at < 0 || target < 0 || target >= _selectedIndices.length) return;
    setState(() {
      _selectedIndices.removeAt(at);
      _selectedIndices.insert(target, index);
    });
  }

  int _storePhoto(ui.Image image) {
    if (_removedPhotos.isEmpty) {
      _photos.add(image);
      return _photos.length - 1;
    }
    final index = _removedPhotos.first;
    _photos[index].dispose();
    _photos[index] = image;
    _removedPhotos.remove(index);
    _crops.remove(index);
    _motionJobs.remove(index + 1)?.cancel();
    _motionGifs.remove(index + 1);
    _motionShots.remove(index + 1);
    return index;
  }

  void _setCrop(int index, PhotoCrop crop) {
    if (_exporting || index >= _selectedIndices.length) return;
    setState(() {
      _crops[_selectedIndices[index]] = crop.normalized();
      _motionStrip = null;
      _png = null;
    });
    _keepAlive();
  }

  void _removePhoto(int index) {
    // Keep stable shot IDs for motion jobs; hide removed entries without renumbering the pool.
    setState(() {
      _selectedIndices.remove(index);
      _removedPhotos.add(index);
    });
  }

  Future<void> _changeLayout() async {
    if (_exporting || _pickingImages || _sharing || _preparingMotion) return;
    final wasCamera = !_reviewing;
    setState(() {
      _reviewing = true;
      _choosingPhotos = true;
    });
    final chosen = await Navigator.of(context).push<StripLayout>(
      MaterialPageRoute(
        builder: (_) => _LayoutPage(
          onSelected: (layout) => Navigator.of(context).pop(layout),
        ),
      ),
    );
    if (!mounted) return;
    if (chosen == null) {
      if (wasCamera) setState(() => _reviewing = false);
      return;
    }
    setState(() {
      _layout = chosen;
      if (_selectedIndices.length > chosen.requiredPhotos) {
        _selectedIndices.removeRange(
          chosen.requiredPhotos,
          _selectedIndices.length,
        );
      }
      _cropPhoto = 0;
      _reviewing =
          !wasCamera || _selectedIndices.length == chosen.requiredPhotos;
      if (!_reviewing) {
        _captureGoal = math.max(chosen.requiredPhotos, _activeCount + 1);
      }
      _choosingPhotos = true;
    });
    _keepAlive();
  }

  void _back() {
    if (_exporting || _pickingImages || _sharing || _preparingMotion) return;
    if (_png != null) {
      _editStrip();
    } else if (_reviewing && !_choosingPhotos) {
      setState(() => _choosingPhotos = true);
    } else if (widget.roomId != null) {
      _finish();
    } else {
      unawaited(_changeLayout());
    }
  }

  void _toggleSelection(int index) {
    if (_exporting) return;
    _keepAlive();
    setState(() {
      if (_selectedIndices.contains(index)) {
        _selectedIndices.remove(index);
      } else if (_selectedIndices.length < _layout.requiredPhotos) {
        _selectedIndices.add(index);
      } else {
        _selectedIndices.removeLast();
        _selectedIndices.add(index);
      }
    });
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
      _selectedMotionGifs,
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
      canPop: _ending,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        appBar: _BoothHeader(
          step: png != null
              ? '04 / FINISH'
              : _captured
              ? (_choosingPhotos ? '02 / PHOTOS' : '03 / DESIGN')
              : '02 / CAPTURE',
          onAction: _finish,
          onHome: _finish,
          actionLabel: 'End session',
        ),
        body: SafeArea(
          child: Listener(
            behavior: HitTestBehavior.translucent,
            onPointerDown: (_) => _keepAlive(),
            onPointerMove: (_) => _keepAlive(),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: _StepBack(
                    number: png != null
                        ? 4
                        : _reviewing && !_choosingPhotos
                        ? 3
                        : 2,
                    onBack: _back,
                  ),
                ),
                if (!_reviewing)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Wrap(
                      spacing: 8,
                      children: [
                        TextButton(
                          onPressed: () => setState(() {
                            _reviewing = true;
                            _choosingPhotos = true;
                          }),
                          child: const Text('Gallery & review'),
                        ),
                        TextButton(
                          onPressed: _pickingImages ? null : _addGallery,
                          child: const Text('Add photos'),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: png != null
                      ? _preview(png)
                      : _captured
                      ? (_choosingPhotos ? _selectionView() : _editor())
                      : CapturePage(
                          captured: _activeCount,
                          total: _targetCaptureCount,
                          minRequired: _layout.requiredPhotos,
                          onPhoto: _onPhoto,
                          onFinishEarly:
                              _photos.length >= _layout.requiredPhotos
                              ? _finishCaptureEarly
                              : null,
                        ),
                ),
              ],
            ),
          ),
        ),
        bottomNavigationBar: _captured && png == null
            ? SafeArea(
                minimum: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: _choosingPhotos
                    ? FilledButton(
                        onPressed:
                            !_pickingImages &&
                                _selectedIndices.length ==
                                    _layout.requiredPhotos
                            ? () => setState(() {
                                _cropPhoto = 0;
                                _choosingPhotos = false;
                              })
                            : null,
                        child: Text(
                          _selectedIndices.length == _layout.requiredPhotos
                              ? 'Next: Decorate strip'
                              : 'Select ${_layout.requiredPhotos - _selectedIndices.length} more',
                        ),
                      )
                    : FilledButton(
                        onPressed: _exporting || _loadingFrame ? null : _export,
                        child: Text(
                          _exporting ? 'Preparing…' : 'Preview strip',
                        ),
                      ),
              )
            : null,
      ),
    );
  }

  Widget _selectionView() {
    final required = _layout.requiredPhotos;
    final selectedCount = _selectedIndices.length;

    return ListView(
      key: const ValueKey('selection'),
      padding: const EdgeInsets.all(20),
      children: [
        _Heading(
          '',
          'Your photos, your order.',
          'Choose $required ${required == 1 ? 'photo' : 'photos'} for your strip ($selectedCount/$required selected).',
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: _pickingImages ? null : _addGallery,
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: Text(_pickingImages ? 'Preparing photos…' : 'Add photos'),
            ),
            OutlinedButton.icon(
              onPressed: _takeMore,
              icon: const Icon(Icons.camera_alt_outlined),
              label: const Text('Take photos'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: wash,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: line),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.auto_awesome, size: 16, color: purple),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      'LIVE STRIP PREVIEW ($selectedCount/$required)',
                      style: const TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                        color: purple,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: math.min(MediaQuery.sizeOf(context).height * .28, 220),
                child: Center(child: StripPreview(_design, maxWidth: 100)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 12,
          runSpacing: 8,
          children: const [
            Text(
              'All captured shots',
              style: TextStyle(
                fontFamily: 'Outfit',
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: ink,
              ),
            ),
            Text(
              'Tap to select or swap',
              style: TextStyle(
                fontFamily: 'Outfit',
                fontSize: 13,
                color: muted,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth > 540 ? 3 : 2;
            const spacing = 12.0;
            final cardWidth =
                (constraints.maxWidth - spacing * (columns - 1)) / columns;
            final cardHeight = cardWidth * 3 / 4;
            return Wrap(
              spacing: spacing,
              runSpacing: spacing,
              children: [
                for (var i = 0; i < _photos.length; i++)
                  if (!_removedPhotos.contains(i))
                    _photoCard(i, cardWidth, cardHeight),
              ],
            );
          },
        ),
        const SizedBox(height: 16),
        for (final index in _selectedIndices)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'Shot ${index + 1} · position ${_selectedIndices.indexOf(index) + 1}',
            ),
            trailing: Wrap(
              children: [
                IconButton(
                  tooltip: 'Move shot ${index + 1} up',
                  onPressed: () => _moveSelected(index, -1),
                  icon: const Icon(Icons.arrow_upward),
                ),
                IconButton(
                  tooltip: 'Move shot ${index + 1} down',
                  onPressed: () => _moveSelected(index, 1),
                  icon: const Icon(Icons.arrow_downward),
                ),
              ],
            ),
          ),
        for (var i = 0; i < _photos.length; i++)
          if (!_removedPhotos.contains(i))
            TextButton(
              onPressed: () => _removePhoto(i),
              child: Text('Remove shot ${i + 1}'),
            ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _photoCard(int index, double width, double height) {
    final isSelected = _selectedIndices.contains(index);
    final slot = isSelected ? _selectedIndices.indexOf(index) + 1 : null;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _toggleSelection(index),
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? purple : line,
              width: isSelected ? 3.0 : 1.5,
            ),
            boxShadow: isSelected
                ? const [
                    BoxShadow(
                      color: Color(0x33523884),
                      blurRadius: 10,
                      offset: Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(9),
            child: Stack(
              fit: StackFit.expand,
              children: [
                RawImage(image: _photos[index], fit: BoxFit.cover),
                if (!isSelected)
                  Container(color: Colors.black.withValues(alpha: 0.15)),
                Positioned(
                  top: 8,
                  right: 8,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isSelected
                          ? purple
                          : Colors.white.withValues(alpha: 0.85),
                      border: Border.all(
                        color: isSelected ? Colors.white : line,
                        width: isSelected ? 2 : 1,
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x33000000),
                          blurRadius: 4,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Center(
                      child: isSelected
                          ? Text(
                              '$slot',
                              style: const TextStyle(
                                fontFamily: 'Outfit',
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            )
                          : const Icon(Icons.add, size: 16, color: muted),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 6,
                  left: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Shot ${index + 1}',
                      style: const TextStyle(
                        fontFamily: 'Outfit',
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _editor() {
    final design = _design;
    final selected = _selected;
    final categories = ['All', ...StripFrame.categories.keys];
    final displayedFrames = _frameCategory == 'All'
        ? StripFrame.values
        : StripFrame.categories[_frameCategory] ?? StripFrame.values;

    return ListView(
      key: const ValueKey('editor'),
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Expanded(
              child: _Heading(
                '',
                'Make it yours.',
                'Choose a frame and decorate your strip.',
              ),
            ),
            if (widget.roomId == null)
              TextButton.icon(
                onPressed: () => setState(() => _choosingPhotos = true),
                icon: const Icon(Icons.swap_horiz, size: 18),
                label: const Text('Change photos'),
              ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          children: [
            for (final (index, tabLabel) in [
              'Frames',
              'Photos',
              'Stickers',
            ].indexed)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: InkWell(
                  onTap: () => setState(() {
                    _editorTab = index;
                    _selected = null;
                  }),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: _editorTab == index ? wash : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      tabLabel,
                      style: TextStyle(
                        fontFamily: 'Outfit',
                        fontWeight: FontWeight.w600,
                        color: _editorTab == index ? purple : muted,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),

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
                    if (_editorTab == 1)
                      for (var i = 0; i < design.photos.length; i++)
                        PhotoCropControls(
                          key: ValueKey('crop-$i'),
                          design: design,
                          index: i,
                          scale: scale,
                          origin: origin,
                          selected: _cropPhoto == i,
                          onSelect: () => setState(() => _cropPhoto = i),
                          onChanged: (crop) => _setCrop(i, crop),
                        ),
                    if (_editorTab != 1)
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
        const SizedBox(height: 16),
        if (_editorTab != 1)
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: line),
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButtonFormField<StripFont>(
                  initialValue: _stripFont,
                  decoration: const InputDecoration(labelText: 'Strip font'),
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
              ],
            ),
          ),
        const SizedBox(height: 16),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: line),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 14),
              if (_editorTab == 0) ...[
                // Frame categories filter
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final category in categories)
                      ChoiceChip(
                        label: Text(category),
                        selected: _frameCategory == category,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() => _frameCategory = category);
                          }
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final frame in displayedFrames)
                      ChoiceChip(
                        avatar: frame.art != null
                            ? Image.asset(
                                FrameArt.asset(frame.art!.name),
                                width: 22,
                                fit: BoxFit.contain,
                                excludeFromSemantics: true,
                              )
                            : (frame.gradient != null
                                  ? Container(
                                      width: 18,
                                      height: 18,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        gradient: LinearGradient(
                                          colors: frame.gradient!,
                                        ),
                                      ),
                                    )
                                  : CircleAvatar(
                                      backgroundColor: frame.paper,
                                      radius: 9,
                                      child: frame.border != null
                                          ? Container(
                                              decoration: BoxDecoration(
                                                shape: BoxShape.circle,
                                                border: Border.all(
                                                  color: frame.border!,
                                                  width: 1.5,
                                                ),
                                              ),
                                            )
                                          : null,
                                    )),
                        label: Text(frame.label),
                        selected: _frame == frame,
                        onSelected: _exporting || _loadingFrame
                            ? null
                            : (_) => _chooseFrame(frame),
                      ),
                  ],
                ),
              ] else if (_editorTab == 1) ...[
                Text(
                  'Adjust photo ${_cropPhoto + 1}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const Text(
                  'Drag inside the photo opening or pinch to zoom. Originals stay unchanged.',
                ),
                Wrap(
                  spacing: 8,
                  children: [
                    for (var i = 0; i < _selectedIndices.length; i++)
                      ChoiceChip(
                        label: Text('Photo ${i + 1}'),
                        selected: _cropPhoto == i,
                        onSelected: (_) => setState(() => _cropPhoto = i),
                      ),
                  ],
                ),
                const Text('Zoom'),
                Slider(
                  label: 'Zoom',
                  min: 1,
                  max: 3,
                  value: _design.cropAt(_cropPhoto).zoom,
                  onChanged: (zoom) {
                    final crop = _design.cropAt(_cropPhoto);
                    _setCrop(
                      _cropPhoto,
                      PhotoCrop(x: crop.x, y: crop.y, zoom: zoom),
                    );
                  },
                ),
                Wrap(
                  spacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: () => _setCrop(_cropPhoto, const PhotoCrop()),
                      child: const Text('Reset crop'),
                    ),
                    FilledButton(
                      onPressed: () => setState(() => _editorTab = 0),
                      child: const Text('Done'),
                    ),
                  ],
                ),
              ] else ...[
                const Text(
                  'Drag a sticker to move it. Use its corner handles to rotate or resize it.',
                  style: TextStyle(color: muted, fontSize: 13),
                ),
                _stickerPicker(),
                if (selected != null) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Sticker size',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Slider(
                    min: StripSticker.minSize,
                    max: StripSticker.maxSize,
                    label: 'Sticker size',
                    activeColor: purple,
                    value: _stickers[selected].size,
                    onChanged: _exporting
                        ? null
                        : (size) => _updateSticker(
                            selected,
                            _stickers[selected].resizeTo(size, design.size),
                          ),
                  ),
                  const Text(
                    'Sticker rotation',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  Slider(
                    min: -180,
                    max: 180,
                    label: 'Sticker rotation',
                    activeColor: purple,
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
                      icon: const Icon(
                        Icons.delete_outline,
                        color: Color(0xffaa0000),
                      ),
                      label: const Text(
                        'Remove sticker',
                        style: TextStyle(color: Color(0xffaa0000)),
                      ),
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
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
          '',
          'Your strip is ready.',
          'Share it, save it, or print a copy.',
        ),
        const SizedBox(height: 16),
        _Stage(
          child: SizedBox(
            height: math.min(MediaQuery.sizeOf(context).height * .48, 480),
            child: _playingStrip
                ? MotionStripView(design: _design, gifs: _selectedMotionGifs)
                : Image.memory(
                    png,
                    semanticLabel: 'Your finished LumiBooth photo strip',
                    fit: BoxFit.contain,
                  ),
          ),
        ),
        if (_selectedMotionGifs.isNotEmpty)
          TextButton(
            onPressed: _motionJobs.isEmpty
                ? () => setState(() => _playingStrip = !_playingStrip)
                : null,
            child: Text(_playingStrip ? 'Stop strip' : 'Play strip'),
          ),
        if (_selectedMotionGifs.isNotEmpty)
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

/// Screen for managing and revoking uploaded web QR gallery links.
class PrintLinksPage extends StatefulWidget {
  /// Creates the [PrintLinksPage].
  const PrintLinksPage({super.key});

  @override
  State<PrintLinksPage> createState() => _PrintLinksPageState();
}

typedef _PrintLinksPage = PrintLinksPage;

class _PrintLinksPageState extends State<PrintLinksPage> {
  late Future<dynamic> _links = OnlineBooth.request('share_list');
  bool _revoking = false;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: _BoothHeader(
      step: 'GALLERY LINKS',
      onBack: () => Navigator.of(context).pop(),
    ),
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

/// Standard brand header bar for LumiBooth with logo mark, step tag, and actions.
class BoothHeader extends StatelessWidget implements PreferredSizeWidget {
  /// Creates the [BoothHeader].
  const BoothHeader({
    super.key,
    required this.step,
    this.onBack,
    this.onAction,
    this.actionLabel,
    this.trailing,
    this.onHome,
  });

  final String step;
  final VoidCallback? onBack;
  final VoidCallback? onAction;
  final String? actionLabel;
  final Widget? trailing;
  final VoidCallback? onHome;

  @override
  Size get preferredSize => const Size.fromHeight(66);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 66,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: paper,
        border: Border(bottom: BorderSide(color: line)),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            if (onBack != null)
              IconButton(
                icon: const Icon(Icons.arrow_back, size: 20, color: ink),
                onPressed: onBack,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              ),
            Expanded(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: InkWell(
                  onTap: () {
                    if (onHome != null) {
                      onHome!();
                      return;
                    }
                    if (Navigator.of(context).canPop()) {
                      Navigator.of(context).popUntil((route) => route.isFirst);
                    }
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Image.asset(
                        'assets/images/logo_mark.png',
                        width: 22,
                        height: 22,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(width: 8),
                      const Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: 'LumiBooth',
                              style: TextStyle(
                                fontFamily: 'Outfit',
                                fontWeight: FontWeight.w700,
                                fontSize: 18,
                                color: ink,
                              ),
                            ),
                            TextSpan(
                              text: '.',
                              style: TextStyle(
                                fontFamily: 'Outfit',
                                fontWeight: FontWeight.w700,
                                fontSize: 18,
                                color: purple,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            if (onAction == null || MediaQuery.sizeOf(context).width > 420)
              Expanded(
                child: Text(
                  step,
                  textAlign: TextAlign.end,
                  maxLines: 2,
                  style: const TextStyle(
                    fontFamily: 'Outfit',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.8,
                    color: purple,
                  ),
                ),
              ),
            if (onAction != null && actionLabel != null) ...[
              const SizedBox(width: 8),
              SizedBox(
                width: 105,
                child: TextButton(
                  onPressed: onAction,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(actionLabel!, textAlign: TextAlign.center),
                ),
              ),
            ],
            if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          ],
        ),
      ),
    );
  }
}

typedef _BoothHeader = BoothHeader;

class _BoothFooter extends StatelessWidget {
  const _BoothFooter();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: line)),
      ),
      child: const Center(
        child: Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: 'LUMIBOOTH STUDIO  ',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              TextSpan(text: '·  CAPTURE · FRAME · KEEP'),
            ],
          ),
          style: TextStyle(
            fontFamily: 'Outfit',
            fontSize: 10,
            letterSpacing: 1.8,
            color: muted,
          ),
        ),
      ),
    );
  }
}

class _StepBack extends StatelessWidget {
  const _StepBack({required this.number, required this.onBack});
  final int number;
  final VoidCallback onBack;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      IconButton(
        tooltip: 'Back to previous step',
        onPressed: onBack,
        icon: const Icon(Icons.arrow_back),
      ),
      const SizedBox(width: 8),
      Text(
        'STEP 0$number OF 04',
        style: const TextStyle(
          color: purple,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.5,
          fontSize: 11,
        ),
      ),
    ],
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
        if (step.isNotEmpty)
          Text(
            step,
            style: const TextStyle(
              fontFamily: 'Outfit',
              color: purple,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.8,
              fontSize: 11,
            ),
          ),
        const SizedBox(height: 8),
        Text(
          title,
          style: const TextStyle(
            fontFamily: 'Playfair Display',
            fontSize: 34,
            fontWeight: FontWeight.w400,
            height: 1.08,
            letterSpacing: -0.8,
            color: ink,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: const TextStyle(
            fontFamily: 'Outfit',
            color: muted,
            fontSize: 15,
            height: 1.4,
          ),
        ),
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
      color: wash,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Padding(padding: const EdgeInsets.all(16), child: child),
  );
}
