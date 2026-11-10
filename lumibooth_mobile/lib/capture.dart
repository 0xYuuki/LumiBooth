import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show DeviceOrientation;

import 'camera_framing.dart';
import 'motion_photo.dart';

class CapturePage extends StatefulWidget {
  const CapturePage({
    super.key,
    required this.captured,
    required this.total,
    required this.onPhoto,
  });

  final int captured;
  final int total;
  final void Function(ui.Image, {MotionClip? motion}) onPhoto;

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
  final _motionBuffer = MotionBuffer();
  List<MotionFrame>? _captureMotionFrames;
  final _motionClock = Stopwatch()..start();
  DeviceOrientation? _motionOrientation;
  bool _motionOn = false;
  bool _changingMotion = false;
  bool _motionUnavailable = false;

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
        imageFormatGroup: Platform.isIOS
            ? ImageFormatGroup.bgra8888
            : ImageFormatGroup.yuv420,
      );
      _camera = controller;
      await controller.initialize();
      if (mounted && generation == _generation && _motionOn) {
        await _startMotion(controller, generation);
      }
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

  Future<void> _startMotion(CameraController camera, int generation) async {
    if (camera.value.isStreamingImages) return;
    try {
      if (!camera.supportsImageStreaming()) {
        throw UnsupportedError('Camera image streaming is unavailable.');
      }
      await camera.startImageStream((frame) {
        if (!mounted || generation != _generation || !_motionOn || _busy) {
          return;
        }
        final orientation = camera.value.deviceOrientation;
        if (orientation != _motionOrientation) {
          _motionBuffer.clear();
          _motionOrientation = orientation;
        }
        final time = _motionClock.elapsedMicroseconds;
        if (!_motionBuffer.wantsFrame(time)) return;
        final sample = sampleMotionFrame(
          frame,
          time,
          rotation: Platform.isAndroid
              ? androidMotionRotation(camera.description, orientation)
              : 0,
        );
        if (sample != null) _motionBuffer.add(sample);
      });
      if (mounted && generation == _generation && _motionUnavailable) {
        setState(() => _motionUnavailable = false);
      }
    } catch (_) {
      if (mounted && generation == _generation) {
        setState(() => _motionUnavailable = true);
      }
    }
  }

  Future<void> _stopMotion(CameraController camera, int generation) async {
    if (!camera.value.isStreamingImages) return;
    try {
      await camera.stopImageStream();
    } catch (_) {
      if (mounted && generation == _generation && _motionOn) {
        setState(() => _motionUnavailable = true);
      }
    }
  }

  Future<void> _toggleMotion(bool enabled) async {
    final camera = _camera;
    if (camera == null ||
        !camera.value.isInitialized ||
        _changingMotion ||
        _busy) {
      return;
    }
    final generation = _generation;
    setState(() {
      _motionOn = enabled;
      _changingMotion = true;
      _motionUnavailable = false;
    });
    _motionBuffer.clear();
    if (enabled) {
      await _startMotion(camera, generation);
    } else {
      await _stopMotion(camera, generation);
    }
    if (mounted && generation == _generation) {
      setState(() => _changingMotion = false);
    }
  }

  void _release() {
    _generation++;
    _motionBuffer.clear();
    _captureMotionFrames?.clear();
    _captureMotionFrames = null;
    _motionOrientation = null;
    _changingMotion = false;
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
    if (_busy || _changingMotion || _remaining > 0) return;
    final now = _motionClock.elapsedMicroseconds;
    final timerDelay = Duration(seconds: _delay);
    final motionDelay = _motionOn && !_motionUnavailable
        ? _motionBuffer.remaining(now)
        : Duration.zero;
    final delay = timerDelay > motionDelay ? timerDelay : motionDelay;
    final deadline = now + delay.inMicroseconds;
    const second = Duration.microsecondsPerSecond;

    void tick() {
      final remaining = deadline - _motionClock.elapsedMicroseconds;
      if (remaining <= 0) {
        _timer = null;
        if (_remaining != 0) setState(() => _remaining = 0);
        unawaited(_capture());
        return;
      }
      final seconds = (remaining + second - 1) ~/ second;
      setState(() => _remaining = seconds);
      _timer = Timer(
        Duration(microseconds: remaining - (seconds - 1) * second),
        tick,
      );
    }

    tick();
  }

  Future<void> _capture() async {
    final camera = _camera;
    if (_busy || camera == null || !camera.value.isInitialized) return;
    final generation = _generation;
    final capturedBefore = widget.captured;
    final motion = _motionOn
        ? _motionBuffer.take(_motionClock.elapsedMicroseconds)
        : null;
    final motionFrames = motion?.frames;
    _captureMotionFrames = motionFrames;
    var capturedPhoto = false;
    setState(() {
      _busy = true;
      _error = null;
    });
    XFile? file;
    try {
      if (_motionOn) await _stopMotion(camera, generation);
      if (!mounted || generation != _generation) return;
      file = await camera.takePicture();
      final photo = await decodeCameraPhoto(await file.readAsBytes());
      if (mounted && generation == _generation) {
        capturedPhoto = true;
        widget.onPhoto(photo, motion: motion);
      } else {
        photo.dispose();
      }
    } catch (_) {
      if (mounted && generation == _generation) {
        setState(() => _error = 'Could not take that photo. Try again.');
      }
    } finally {
      if (identical(_captureMotionFrames, motionFrames)) {
        motionFrames?.clear();
        _captureMotionFrames = null;
      }
      if (file != null) {
        try {
          await File(file.path).delete();
        } on FileSystemException {
          // The platform may already have removed its temporary capture.
        }
      }
      if (mounted && generation == _generation) {
        if (_motionOn &&
            capturedBefore + (capturedPhoto ? 1 : 0) < widget.total) {
          await _startMotion(camera, generation);
        }
        if (mounted && generation == _generation) setState(() => _busy = false);
      }
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
    final locked = _busy || _changingMotion || _remaining > 0;
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
            aspectRatio: cameraAspectRatio,
            child: ColoredBox(
              color: const Color(0xff23202a),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (ready)
                    FittedBox(
                      fit: BoxFit.cover,
                      child: SizedBox(
                        width: camera!.value.previewSize!.width,
                        child: CameraPreview(camera),
                      ),
                    ),
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
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Motion Photo'),
          subtitle: Text(
            _motionOn && _motionUnavailable
                ? 'Motion is unavailable on this camera. You can still take photos.'
                : 'Waits as needed for $motionSeconds seconds of motion before each shot',
          ),
          value: _motionOn,
          onChanged: ready && !locked
              ? (enabled) => unawaited(_toggleMotion(enabled))
              : null,
        ),
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
