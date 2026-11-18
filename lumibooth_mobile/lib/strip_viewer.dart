import 'dart:math' as math;

import 'package:flutter/material.dart';

class StripViewer extends StatefulWidget {
  const StripViewer({
    super.key,
    required this.aspectRatio,
    required this.child,
  });

  final double aspectRatio;
  final Widget child;

  @override
  State<StripViewer> createState() => _StripViewerState();
}

class _StripViewerState extends State<StripViewer> {
  bool _fitWidth = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const CloseButton(),
        title: const Text('Strip preview'),
        actions: [
          TextButton(
            onPressed: () => setState(() => _fitWidth = !_fitWidth),
            child: Text(_fitWidth ? 'Fit strip' : 'Fit width'),
          ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, bounds) {
            final width = _fitWidth
                ? bounds.maxWidth
                : math.min(
                    bounds.maxWidth,
                    bounds.maxHeight * widget.aspectRatio,
                  );
            final height = width / widget.aspectRatio;
            return InteractiveViewer(
              key: ValueKey(_fitWidth),
              constrained: false,
              maxScale: 5,
              child: SizedBox(
                width: bounds.maxWidth,
                height: math.max(bounds.maxHeight, height),
                child: Center(
                  child: SizedBox(
                    width: width,
                    height: height,
                    child: widget.child,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
