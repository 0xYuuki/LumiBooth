import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

class CapturePage extends StatefulWidget {
  const CapturePage({
    super.key,
    required this.captured,
    required this.total,
    required this.onPhoto,
  });

  final int captured;
  final int total;
  final ValueChanged<ui.Image> onPhoto;

  @override
  State<CapturePage> createState() => _CapturePageState();
}

class _CapturePageState extends State<CapturePage> with WidgetsBindingObserver {
  CameraController? _camera;
  Future<void> _closing = Future.value();
  int _generation = 0;
  bool _opening = false;
  bool _busy = false;
  bool _front = true;
  int _delay = 0;
  int _remaining = 0;
  Timer? _timer;
  String? _error;
  List<CameraDescription> _cameras = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_open());
  }

  Future<void> _open() async {
    if (_opening || !mounted) return;
    final generation = ++_generation;
    setState(() {
      _opening = true;
      _error = null;
    });

    try {
      await _closing;
      final cameras = await availableCameras();
      if (!mounted || generation != _generation) return;
      if (cameras.isEmpty) {
        setState(() => _error = 'No camera was found on this device.');
        return;
      }
      _cameras = cameras;
      final facing = _front
          ? CameraLensDirection.front
          : CameraLensDirection.back;
      final selected = cameras.firstWhere(
        (camera) => camera.lensDirection == facing,
        orElse: () => cameras.first,
      );
      final controller = CameraController(
        selected,
        ResolutionPreset.high,
        enableAudio: false,
      );
      _camera = controller;
      await controller.initialize();
    } on CameraException catch (error) {
      if (mounted && generation == _generation) {
        setState(() {
          _error = error.code.startsWith('CameraAccess')
              ? 'Allow camera access in your device settings, then try again.'
              : 'Could not open the camera. Try again.';
        });
      }
    } catch (_) {
      if (mounted && generation == _generation) {
        setState(() => _error = 'Could not open the camera. Try again.');
      }
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _opening = false);
      }
    }
  }

  Future<void> _disposeCamera(CameraController camera) async {
    try {
      await camera.dispose();
    } catch (error, stack) {
      FlutterError.reportError(
        FlutterErrorDetails(exception: error, stack: stack),
      );
    }
  }

  void _release() {
    _generation++;
    _timer?.cancel();
    _timer = null;
    _remaining = 0;
    _opening = false;
    _busy = false;
    final camera = _camera;
    _camera = null;
    if (camera != null) _closing = _disposeCamera(camera);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (_camera == null && !_opening) unawaited(_open());
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        (state == AppLifecycleState.inactive &&
            (_camera?.value.isInitialized ?? false))) {
      setState(_release);
    }
  }

  void _retry({bool switchCamera = false}) {
    setState(() {
      if (switchCamera) _front = !_front;
      _release();
    });
    unawaited(_open());
  }

  void _takePhoto() {
    if (_busy || _remaining > 0) return;
    if (_delay == 0) {
      unawaited(_capture());
      return;
    }

    setState(() => _remaining = _delay);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() => _remaining--);
      if (_remaining == 0) {
        timer.cancel();
        _timer = null;
        unawaited(_capture());
      }
    });
  }

  Future<void> _capture() async {
    final camera = _camera;
    if (_busy || camera == null || !camera.value.isInitialized) return;
    final generation = _generation;
    setState(() {
      _busy = true;
      _error = null;
    });
    XFile? file;
    try {
      file = await camera.takePicture();
      final bytes = await file.readAsBytes();
      final codec = await ui.instantiateImageCodec(
        bytes,
        targetWidth: 960,
        allowUpscaling: false,
      );
      try {
        final frame = await codec.getNextFrame();
        if (mounted && generation == _generation) {
          widget.onPhoto(frame.image);
        } else {
          frame.image.dispose();
        }
      } finally {
        codec.dispose();
      }
    } catch (_) {
      if (mounted && generation == _generation) {
        setState(() => _error = 'Could not take that photo. Try again.');
      }
    } finally {
      if (file != null) {
        try {
          await File(file.path).delete();
        } on FileSystemException {
          // The platform may already have removed its temporary capture.
        }
      }
      if (mounted && generation == _generation) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _release();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final camera = _camera;
    final ready = !_opening && (camera?.value.isInitialized ?? false);
    final locked = _busy || _remaining > 0;
    final canSwitch =
        _cameras.any(
          (camera) => camera.lensDirection == CameraLensDirection.front,
        ) &&
        _cameras.any(
          (camera) => camera.lensDirection == CameraLensDirection.back,
        );

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          'Ready for your close-up?',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        Semantics(
          liveRegion: true,
          child: Text('${widget.captured} of ${widget.total} photos captured'),
        ),
        const SizedBox(height: 20),
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: AspectRatio(
            aspectRatio: 3 / 4,
            child: ColoredBox(
              color: const Color(0xff23202a),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (ready) Center(child: CameraPreview(camera!)),
                  if (_opening)
                    const Center(
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                  if (_remaining > 0)
                    ColoredBox(
                      color: const Color(0x66000000),
                      child: Center(
                        child: Text(
                          '$_remaining',
                          style: const TextStyle(
                            fontSize: 72,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        if (_error case final message?) ...[
          const SizedBox(height: 12),
          Semantics(liveRegion: true, child: Text(message)),
          if (!ready && !_opening)
            TextButton(onPressed: _retry, child: const Text('Retry camera')),
        ],
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.center,
          children: [
            OutlinedButton.icon(
              onPressed: locked
                  ? null
                  : () => setState(
                      () => _delay = switch (_delay) {
                        0 => 3,
                        3 => 5,
                        5 => 10,
                        _ => 0,
                      },
                    ),
              icon: const Icon(Icons.timer_outlined),
              label: Text(_delay == 0 ? 'Timer off' : '${_delay}s timer'),
            ),
            FilledButton.icon(
              onPressed: ready && !locked ? _takePhoto : null,
              icon: const Icon(Icons.camera_alt_outlined),
              label: const Text('Take photo'),
            ),
            if (canSwitch)
              IconButton(
                tooltip: 'Switch camera',
                onPressed: ready && !locked
                    ? () => _retry(switchCamera: true)
                    : null,
                icon: const Icon(Icons.cameraswitch_outlined),
              ),
          ],
        ),
      ],
    );
  }
}
