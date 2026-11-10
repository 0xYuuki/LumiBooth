import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import 'strip.dart';

class StickerControls extends StatelessWidget {
  const StickerControls({
    super.key,
    required this.sticker,
    required this.stripSize,
    required this.bounds,
    required this.scale,
    required this.selected,
    required this.enabled,
    required this.onSelect,
    required this.onChanged,
  });

  final StripSticker sticker;
  final Size stripSize;
  final Rect bounds;
  final double scale;
  final bool selected;
  final bool enabled;
  final VoidCallback onSelect;
  final ValueChanged<StripSticker> onChanged;

  double get _handleDistance => math.max(bounds.width / 2, 22);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => Stack(
        children: [
          Positioned.fromRect(
            rect: bounds,
            child: Semantics(
              label: 'Select ${sticker.symbol} sticker',
              button: true,
              selected: selected,
              onTap: enabled ? onSelect : null,
              child: _StickerPointerTarget(
                key: const ValueKey('move sticker'),
                enabled: enabled,
                onStart: onSelect,
                onDrag: (origin, current) => onChanged(
                  sticker.moveBy((current - origin) / scale, stripSize),
                ),
              ),
            ),
          ),
          if (selected) ...[
            _handle(
              context,
              constraints.biggest,
              bounds.center - Offset(_handleDistance, _handleDistance),
              label: 'Rotate sticker',
              icon: Icons.rotate_right,
              onTap: () => onChanged(sticker.rotateBy(15)),
              onDrag: (origin, current, localCenter) {
                final initial = origin - localCenter;
                final next = current - localCenter;
                final angle =
                    (math.atan2(next.dy, next.dx) -
                        math.atan2(initial.dy, initial.dx)) *
                    180 /
                    math.pi;
                onChanged(sticker.rotateBy(angle));
              },
            ),
            _handle(
              context,
              constraints.biggest,
              bounds.center + Offset(_handleDistance, _handleDistance),
              label: 'Resize sticker',
              icon: Icons.open_in_full,
              onTap: () =>
                  onChanged(sticker.resizeTo(sticker.size + 10, stripSize)),
              onDrag: (origin, current, _) {
                final delta = (current - origin) / scale;
                onChanged(
                  sticker.resizeTo(
                    sticker.size + (delta.dx + delta.dy) / 2,
                    stripSize,
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _handle(
    BuildContext context,
    Size stage,
    Offset corner, {
    required String label,
    required IconData icon,
    required VoidCallback onTap,
    required void Function(Offset, Offset, Offset) onDrag,
  }) {
    final left = (corner.dx - 14)
        .clamp(0.0, math.max(0.0, stage.width - 28))
        .toDouble();
    final top = (corner.dy - 14)
        .clamp(0.0, math.max(0.0, stage.height - 28))
        .toDouble();
    final center = bounds.center - Offset(left, top);
    return Positioned(
      left: left,
      top: top,
      width: 28,
      height: 28,
      child: Semantics(
        label: label,
        button: true,
        onTap: enabled ? onTap : null,
        child: _StickerPointerTarget(
          key: ValueKey(label),
          enabled: enabled,
          onStart: onSelect,
          onDrag: (origin, current) => onDrag(origin, current, center),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: Theme.of(context).colorScheme.primary),
            ),
            child: Icon(
              icon,
              size: 16,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
      ),
    );
  }
}

class _StickerPointerTarget extends StatefulWidget {
  const _StickerPointerTarget({
    super.key,
    required this.enabled,
    required this.onStart,
    required this.onDrag,
    this.child,
  });

  final bool enabled;
  final VoidCallback onStart;
  final void Function(Offset, Offset) onDrag;
  final Widget? child;

  @override
  State<_StickerPointerTarget> createState() => _StickerPointerTargetState();
}

class _StickerPointerTargetState extends State<_StickerPointerTarget> {
  int? _pointer;
  late Offset _origin;
  late Offset _globalOrigin;
  late void Function(Offset, Offset) _drag;

  void _start(PointerDownEvent event) {
    if (_pointer != null) return;
    _pointer = event.pointer;
    _globalOrigin = event.position;
    _origin = event.localPosition;
    _drag = widget.onDrag;
    widget.onStart();
  }

  void _move(PointerMoveEvent event) {
    if (event.pointer != _pointer || !widget.enabled) return;
    _drag(_origin, _origin + event.position - _globalOrigin);
  }

  void _finish(PointerEvent event) {
    if (event.pointer == _pointer) _pointer = null;
  }

  @override
  Widget build(BuildContext context) {
    return RawGestureDetector(
      behavior: HitTestBehavior.opaque,
      // A drag that starts on a sticker belongs to the editor, even inside its ListView.
      gestures: {
        if (widget.enabled)
          EagerGestureRecognizer:
              GestureRecognizerFactoryWithHandlers<EagerGestureRecognizer>(
                EagerGestureRecognizer.new,
                (_) {},
              ),
      },
      child: Listener(
        behavior: HitTestBehavior.opaque,
        onPointerDown: widget.enabled ? _start : null,
        onPointerMove: _move,
        onPointerUp: _finish,
        onPointerCancel: _finish,
        child: widget.child ?? const SizedBox.expand(),
      ),
    );
  }
}
