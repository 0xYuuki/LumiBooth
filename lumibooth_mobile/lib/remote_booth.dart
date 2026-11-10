import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import 'camera_framing.dart';
import 'capture.dart';
import 'motion_photo.dart';
import 'online_booth.dart';
import 'print_strip.dart';
import 'room_timing.dart';
import 'strip.dart';

class RemoteBoothPage extends StatefulWidget {
  const RemoteBoothPage({super.key, required this.onDesign});

  final Future<void> Function(BuildContext, String, List<ui.Image>) onDesign;

  @override
  State<RemoteBoothPage> createState() => _RemoteBoothPageState();
}

class _RemoteBoothPageState extends State<RemoteBoothPage>
    with WidgetsBindingObserver {
  final _inviteInput = TextEditingController();
  final _camera = GlobalKey<CapturePageState>();
  final _clock = Stopwatch()..start();
  String? _id;
  String? _invite;
  Map<String, dynamic>? _room;
  Timer? _poll;
  Timer? _shutter;
  Timer? _ticker;
  VoidCallback? _unsubscribe;
  String? _capturedAttempt;
  ({String attempt, Uint8List photo})? _shot;
  Uint8List? _finished;
  bool _ready = false;
  bool _foreground = true;
  bool _refreshing = false;
  bool _busy = false;
  bool _uploading = false;
  int _countdown = 0;
  int _bestRtt = 1 << 30;
  int _lastSync = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  Map<String, Object?> get _roomId => {'id': _id};

  Future<void> _run(Future<void> Function() work) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await work();
    } catch (error) {
      if (mounted) setState(() => _error = _errorText(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _errorText(Object error) => error is StateError
      ? error.message.toString()
      : 'The online booth could not respond. Try again.';

  Future<void> _join({required bool host}) => _run(() async {
    final link = Uri.tryParse(_inviteInput.text.trim());
    final token = link?.fragment;
    if (!host &&
        (token == null || !RegExp(r'^[0-9a-f]{48}$').hasMatch(token))) {
      throw StateError('Paste the full invite link your friend sent.');
    }
    final result = await OnlineBooth.request(
      host ? 'room_begin' : 'room_join',
      host ? {} : {'token': token},
    );
    if (!mounted) return;
    final id = result['id'] as String;
    setState(() {
      _id = id;
      _invite = result['invite'] as String?;
    });
    _unsubscribe = OnlineBooth.subscribe(id, () => unawaited(_refresh()));
    _poll = Timer.periodic(
      const Duration(milliseconds: 1500),
      (_) => unawaited(_refresh()),
    );
    await _refresh();
  });

  void _cancelShutter() {
    _shutter?.cancel();
    _shutter = null;
    _ticker?.cancel();
    _ticker = null;
    _countdown = 0;
    _bestRtt = 1 << 30;
  }

  Future<void> _refresh() async {
    if (_id == null || _refreshing || !_foreground) return;
    _refreshing = true;
    final start = _clock.elapsedMilliseconds;
    try {
      final next = await OnlineBooth.request('room_sync', {
        ..._roomId,
        'ready':
            _ready &&
            (_camera.currentState?.canCapture == true ||
                (_capturedAttempt != null &&
                    _capturedAttempt == _room?['attempt'])),
        'round': _room?['round'],
      }) as Map<String, dynamic>;
      if (!mounted || !_foreground) return;
      final now = _clock.elapsedMilliseconds;
      final previous = _room;
      if (previous != null &&
          (next['revision'] as int) < (previous['revision'] as int)) {
        return;
      }
      _lastSync = now;
      final attempt = next['attempt'] as String?;
      setState(() {
        if (next['round'] != previous?['round'] ||
            (previous?['attempt'] != null && attempt == null)) {
          _ready = false;
        }
        if (attempt != previous?['attempt']) {
          _cancelShutter();
          _shot = null;
        }
        _room = next;
      });
      final rtt = now - start;
      if (attempt == null ||
          next['submitted'] == true ||
          _capturedAttempt == attempt ||
          !_ready ||
          rtt >= _bestRtt) {
        return;
      }
      final deadline = estimateRoomShutter(
        sentAt: start,
        receivedAt: now,
        serverNow: next['serverNow'] as int,
        shutterAt: next['shutterAt'] as int,
      );
      if (deadline == null) return;
      _cancelShutter();
      _bestRtt = rtt;
      void tick() {
        if (mounted) {
          final seconds = math.max(
            0,
            ((deadline - _clock.elapsedMilliseconds) / 1000).ceil(),
          );
          if (_countdown != seconds) setState(() => _countdown = seconds);
        }
      }

      tick();
      _ticker = Timer.periodic(
        const Duration(milliseconds: 100),
        (_) => tick(),
      );
      _shutter = Timer(
        Duration(
          milliseconds: math.max(0, deadline - _clock.elapsedMilliseconds),
        ),
        () {
          if (!mounted) return;
          setState(_cancelShutter);
          final now = _clock.elapsedMilliseconds;
          if (!_foreground ||
              !_ready ||
              _room?['attempt'] != attempt ||
              now - _lastSync > 4000 ||
              now - deadline > 250) {
            return;
          }
          final camera = _camera.currentState;
          if (camera == null || !camera.canCapture) {
            setState(() => _error = 'Camera unavailable. Retry the round.');
            return;
          }
          _capturedAttempt = attempt;
          unawaited(camera.captureForRoom());
        },
      );
    } catch (error) {
      if (mounted && _foreground) {
        setState(() {
          _cancelShutter();
          _error = _errorText(error);
        });
      }
    } finally {
      _refreshing = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _foreground = true;
      unawaited(_refresh());
    } else if (state == AppLifecycleState.hidden ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _foreground = false;
      setState(() {
        _ready = false;
        _shot = null;
        _cancelShutter();
      });
      if (_id != null) {
        unawaited(
          OnlineBooth.request('room_sync', {
            ..._roomId,
            'ready': false,
            'round': _room?['round'],
          }).then<void>((_) {}, onError: (_) {}),
        );
      }
    }
  }

  Future<void> _capture(ui.Image photo) async {
    final attempt = _capturedAttempt;
    final Uint8List bytes;
    try {
      if (attempt == null || !_foreground) return;
      bytes = await encodeCameraJpeg(photo);
    } catch (error) {
      if (mounted) setState(() => _error = _errorText(error));
      return;
    } finally {
      photo.dispose();
    }
    if (!mounted || !_foreground || _room?['attempt'] != attempt) return;
    await _uploadShot((attempt: attempt, photo: bytes));
  }

  Future<void> _uploadShot(({String attempt, Uint8List photo}) shot) async {
    if (_uploading) return;
    _shot = shot;
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final payload = {..._roomId, 'attempt': shot.attempt};
      final ticket = await OnlineBooth.request(
        'room_upload',
        payload,
      ) as Map<String, dynamic>;
      if (!_foreground || !mounted || _shot != shot) return;
      await OnlineBooth.upload(ticket, shot.photo, 'image/jpeg');
      await OnlineBooth.request('room_shot', payload);
      _shot = null;
      await _refresh();
    } catch (error) {
      if (mounted && _shot == shot) setState(() => _error = _errorText(error));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _command(String name, [Map<String, Object?> args = const {}]) =>
      _run(() async {
        await OnlineBooth.request(name, {..._roomId, ...args});
        if (name == 'room_retry' && mounted) setState(() => _ready = false);
        await _refresh();
      });

  Future<void> _design() => _run(() async {
    final result = await OnlineBooth.request('room_sync', {
      ..._roomId,
      'assets': true,
    });
    final urls = result['photos'];
    if (urls is! List || urls.length != StripLayout.remoteDuo.requiredPhotos) {
      throw StateError('Could not load all three pairs. Try again.');
    }
    final photos = <ui.Image>[];
    try {
      for (final url in urls) {
        photos.add(
          await decodeCameraPhoto(await OnlineBooth.download(url as String)),
        );
      }
      if (mounted) {
        final pending = widget.onDesign(context, _id!, List.of(photos));
        photos.clear(); // The editor owns these images after navigation.
        await pending;
        await _refresh();
      }
    } finally {
      for (final photo in photos) {
        photo.dispose();
      }
    }
  });

  Future<void> _openFinal() => _run(() async {
    final result = await OnlineBooth.request('room_sync', {
      ..._roomId,
      'assets': true,
    });
    final photo = await OnlineBooth.download(result['poster'] as String);
    if (mounted) setState(() => _finished = photo);
  });

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    _cancelShutter();
    _unsubscribe?.call();
    _inviteInput.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final room = _room;
    final state = room?['state'];
    final invite = _invite;
    final finished = _finished;
    return Scaffold(
      appBar: AppBar(title: const Text('Booth with a friend')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (_error != null)
              Semantics(liveRegion: true, child: Text(_error!)),
            if (_id == null) ...[
              const Text(
                'Share three stills with the other guest. Both guests can save the finished strip. The room expires in one hour.',
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: _busy ? null : () => _join(host: true),
                child: const Text('Agree and create room'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _inviteInput,
                decoration: const InputDecoration(labelText: 'Invite link'),
              ),
              OutlinedButton(
                onPressed: _busy ? null : () => _join(host: false),
                child: const Text('Agree and join'),
              ),
            ],
            if (state == 'waiting' && invite != null) ...[
              const Text('Send this one-use link to your friend.'),
              SelectableText(OnlineBooth.publicLink('room', invite).toString()),
              OutlinedButton(
                onPressed: () => Clipboard.setData(
                  ClipboardData(
                    text: OnlineBooth.publicLink('room', invite).toString(),
                  ),
                ),
                child: const Text('Copy invite link'),
              ),
              const Text('Waiting for your friend…'),
            ],
            if (state == 'capture') ...[
              Semantics(
                liveRegion: true,
                child: Text('Round ${room!['round']} of 3'),
              ),
              SizedBox(
                height: math.min(MediaQuery.sizeOf(context).height * .52, 430),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CapturePage(
                      key: _camera,
                      captured: (room['round'] as int) - 1,
                      total: 3,
                      remote: true,
                      onPhoto: (photo, {MotionClip? motion}) =>
                          unawaited(_capture(photo)),
                    ),
                    if (_countdown > 0)
                      Center(
                        child: Material(
                          color: const Color(0xff241c31),
                          borderRadius: BorderRadius.circular(16),
                          child: Padding(
                            padding: const EdgeInsets.all(20),
                            child: Semantics(
                              liveRegion: true,
                              child: Text(
                                '$_countdown',
                                style: const TextStyle(
                                  fontSize: 56,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (room['submitted'] == true)
                const Text('Photo received. Waiting for your friend.'),
              if (room['attempt'] == null)
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () {
                          if (_camera.currentState?.canCapture != true) {
                            setState(
                              () => _error = 'Wait for the camera to open before marking ready.',
                            );
                            return;
                          }
                          setState(() {
                            _ready = !_ready;
                            _error = null;
                          });
                          unawaited(_refresh());
                        },
                  child: Text(_ready ? 'Not ready' : 'I’m ready'),
                ),
              if (room['role'] == 'host')
                OutlinedButton(
                  onPressed:
                      !_busy &&
                          _ready &&
                          room['attempt'] == null &&
                          room['hostReady'] == true &&
                          room['guestReady'] == true
                      ? () => _command('room_start')
                      : null,
                  child: const Text('Start countdown'),
                ),
              if (_shot != null && !_uploading)
                OutlinedButton(
                  onPressed: () => _uploadShot(_shot!),
                  child: const Text('Retry upload'),
                ),
              if (room['attempt'] != null && _countdown == 0 && !_uploading)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => _command('room_retry', {
                          'attempt': room['attempt'],
                        }),
                  child: const Text('Retry round'),
                ),
            ],
            if (state == 'design')
              if (room!['role'] == 'host')
                FilledButton(
                  onPressed: _busy ? null : _design,
                  child: const Text('Design your shared strip'),
                )
              else
                const Text('Your friend is designing the strip.'),
            if (state == 'complete')
              if (finished == null)
                FilledButton(
                  onPressed: _busy ? null : _openFinal,
                  child: const Text('Open your shared strip'),
                )
              else ...[
                Image.memory(
                  finished,
                  height: 400,
                  fit: BoxFit.contain,
                  semanticLabel: 'Your finished shared strip',
                ),
                Builder(
                  builder: (button) => FilledButton(
                    onPressed: _busy
                        ? null
                        : () => _run(() async {
                            final box = button.findRenderObject()! as RenderBox;
                            await SharePlus.instance.share(
                              ShareParams(
                                files: [
                                  XFile.fromData(
                                    finished,
                                    mimeType: 'image/png',
                                  ),
                                ],
                                fileNameOverrides: ['lumibooth-friends.png'],
                                sharePositionOrigin:
                                    box.localToGlobal(Offset.zero) & box.size,
                              ),
                            );
                          }),
                    child: const Text('Save or share strip'),
                  ),
                ),
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _run(() => printStrip(finished)),
                  child: const Text('Print shared strip'),
                ),
              ],
            if (_id != null && state != 'complete')
              TextButton(
                onPressed: _busy
                    ? null
                    : () => _run(() async {
                        await OnlineBooth.request('room_cancel', _roomId);
                        if (context.mounted) Navigator.of(context).pop();
                      }),
                child: const Text('Cancel for both'),
              ),
          ],
        ),
      ),
    );
  }
}
