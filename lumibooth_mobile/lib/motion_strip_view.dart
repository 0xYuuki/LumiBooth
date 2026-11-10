import 'dart:typed_data';

import 'package:flutter/material.dart';

import 'strip.dart';

class MotionStripView extends StatefulWidget {
  const MotionStripView({super.key, required this.design, required this.gifs});

  final StripDesign design;
  final Map<int, Uint8List> gifs;

  @override
  State<MotionStripView> createState() => _MotionStripViewState();
}

class _MotionStripViewState extends State<MotionStripView> {
  final _subscriptions =
      <
        int,
        ({
          MemoryImage provider,
          ImageStream stream,
          ImageStreamListener listener,
        })
      >{};
  final _frames = <int, ImageInfo>{};

  @override
  void initState() {
    super.initState();
    _syncStreams();
  }

  @override
  void didUpdateWidget(MotionStripView oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncStreams();
  }

  void _syncStreams() {
    for (final shot in _subscriptions.keys.toList()) {
      if (!identical(_subscriptions[shot]?.provider.bytes, widget.gifs[shot])) {
        _removeStream(shot);
      }
    }
    for (final MapEntry(:key, :value) in widget.gifs.entries) {
      if (_subscriptions.containsKey(key)) continue;
      final provider = MemoryImage(value);
      final stream = provider.resolve(ImageConfiguration.empty);
      final listener = ImageStreamListener(
        (frame, _) {
          if (!mounted) {
            frame.dispose();
            return;
          }
          final previous = _frames[key];
          setState(() => _frames[key] = frame);
          previous?.dispose();
        },
        onError: (_, _) {
          final previous = _frames[key];
          if (mounted && previous != null) {
            setState(() => _frames.remove(key));
            previous.dispose();
          }
        },
      );
      _subscriptions[key] = (
        provider: provider,
        stream: stream,
        listener: listener,
      );
      stream.addListener(listener);
    }
  }

  void _removeStream(int shot) {
    final subscription = _subscriptions.remove(shot);
    if (subscription != null) {
      subscription.stream.removeListener(subscription.listener);
    }
    _frames.remove(shot)?.dispose();
  }

  @override
  void dispose() {
    for (final shot in _subscriptions.keys.toList()) {
      _removeStream(shot);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final design = widget.design;
    return Semantics(
      image: true,
      label: 'Animated LumiBooth photo strip',
      child: FittedBox(
        fit: BoxFit.contain,
        child: CustomPaint(
          size: design.size,
          painter: StripPainter(
            design,
            motionFrames: {
              for (final entry in _frames.entries)
                entry.key - 1: entry.value.image,
            },
          ),
        ),
      ),
    );
  }
}
