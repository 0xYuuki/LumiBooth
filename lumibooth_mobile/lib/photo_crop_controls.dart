import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'strip.dart';

/// Tap surface over the actual opening; stickers remain above it.
class PhotoCropControls extends StatelessWidget {
  const PhotoCropControls({
    super.key,
    required this.design,
    required this.index,
    required this.scale,
    required this.origin,
    required this.onSelect,
  });
  final StripDesign design;
  final int index;
  final double scale;
  final Offset origin;
  final VoidCallback onSelect;
  @override
  Widget build(BuildContext context) {
    final opening = StripPainter.photoOpening(design, index);
    final rect = Rect.fromLTWH(
      opening.bounds.left * scale,
      opening.bounds.top * scale,
      opening.bounds.width * scale,
      opening.bounds.height * scale,
    ).shift(origin);
    return Positioned.fromRect(
      rect: rect,
      child: Transform.rotate(
        angle: opening.angle,
        origin: (opening.pivot - opening.bounds.center) * scale,
        child: Semantics(
          label: 'Adjust photo ${index + 1}',
          button: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onSelect,
          ),
        ),
      ),
    );
  }
}

Rect photoTransformRect(ui.Image image, Size window, PhotoCrop crop) {
  final value = crop.normalized();
  final ratio =
      math.max(window.width / image.width, window.height / image.height) *
      value.zoom;
  final size = Size(image.width * ratio, image.height * ratio);
  return Rect.fromLTWH(
    (window.width - size.width) * value.x,
    (window.height - size.height) * value.y,
    size.width,
    size.height,
  );
}

PhotoCrop movePhotoCrop(
  ui.Image image,
  Size window,
  PhotoCrop start,
  Offset delta,
) {
  final rect = photoTransformRect(image, window, start);
  final x = rect.width - window.width, y = rect.height - window.height;
  return PhotoCrop(
    x: x > .001 ? start.x - delta.dx / x : start.x,
    y: y > .001 ? start.y - delta.dy / y : start.y,
    zoom: start.zoom,
  ).normalized();
}

PhotoCrop resizePhotoCrop(
  ui.Image image,
  Size window,
  PhotoCrop start,
  Alignment corner,
  Offset delta,
) {
  final rect = photoTransformRect(image, window, start);
  final factor =
      1 +
      (delta.dx * corner.x * rect.width + delta.dy * corner.y * rect.height) /
          (rect.width * rect.width + rect.height * rect.height);
  final zoom = (start.zoom * factor).clamp(1.0, 3.0);
  final next = photoTransformRect(image, window, PhotoCrop(zoom: zoom));
  final left = corner.x < 0 ? rect.right - next.width : rect.left;
  final top = corner.y < 0 ? rect.bottom - next.height : rect.top;
  return PhotoCrop(
    x: next.width - window.width > .001
        ? -left / (next.width - window.width)
        : .5,
    y: next.height - window.height > .001
        ? -top / (next.height - window.height)
        : .5,
    zoom: zoom,
  ).normalized();
}

/// Enlarged non-destructive transform canvas with a fixed frame opening.
class PhotoTransformEditor extends StatefulWidget {
  const PhotoTransformEditor({
    super.key,
    required this.image,
    required this.aspect,
    required this.crop,
    required this.onChanged,
  });
  final ui.Image image;
  final double aspect;
  final PhotoCrop crop;
  final ValueChanged<PhotoCrop> onChanged;
  @override
  State<PhotoTransformEditor> createState() => _PhotoTransformEditorState();
}

class _PhotoTransformEditorState extends State<PhotoTransformEditor> {
  late PhotoCrop _crop = widget.crop.normalized();
  late PhotoCrop _fitCrop = widget.crop.normalized();
  final Map<int, Offset> _pointers = {};
  PhotoCrop _start = const PhotoCrop();
  Offset _focal = Offset.zero;
  double _gestureScale = 1, _distance = 0;
  Alignment? _corner;
  Size get _window => Size(240, 240 / widget.aspect);
  void _change(PhotoCrop crop) {
    setState(() => _crop = crop.normalized());
    widget.onChanged(_crop);
  }

  Offset get _center =>
      _pointers.values.reduce((a, b) => a + b) / _pointers.length.toDouble();
  void _begin(double scale) {
    _start = _crop;
    _focal = _center;
    _gestureScale = scale;
    final points = _pointers.values.toList();
    _distance = points.length > 1 ? (points[0] - points[1]).distance : 0;
  }

  void _down(PointerDownEvent event, double scale, [Alignment? corner]) {
    _pointers[event.pointer] = event.position;
    _corner = corner;
    _begin(scale);
  }

  void _move(PointerMoveEvent event) {
    if (!_pointers.containsKey(event.pointer)) return;
    _pointers[event.pointer] = event.position;
    final delta = (_center - _focal) / _gestureScale;
    if (_pointers.length > 1 && _distance > 0) {
      final points = _pointers.values.toList();
      final zoom = (_start.zoom * (points[0] - points[1]).distance / _distance)
          .clamp(1.0, 3.0);
      _change(
        movePhotoCrop(
          widget.image,
          _window,
          PhotoCrop(x: _start.x, y: _start.y, zoom: zoom),
          delta,
        ),
      );
    } else if (_corner != null) {
      _change(resizePhotoCrop(widget.image, _window, _start, _corner!, delta));
    } else {
      _change(movePhotoCrop(widget.image, _window, _start, delta));
    }
  }

  void _end(PointerEvent event, double scale) {
    _pointers.remove(event.pointer);
    if (_pointers.isNotEmpty) _begin(scale);
  }

  Widget _workspace(BoxConstraints constraints) {
    final size = constraints.biggest;
    final rect = photoTransformRect(widget.image, _window, _crop);
    final fitted = photoTransformRect(widget.image, _window, _fitCrop);
    final fitWidth =
        2 *
        math.max(
          _window.width / 2 - fitted.left,
          fitted.right - _window.width / 2,
        );
    final fitHeight =
        2 *
        math.max(
          _window.height / 2 - fitted.top,
          fitted.bottom - _window.height / 2,
        );
    final scale = math.min(
      (size.width - 56) / fitWidth,
      (size.height - 56) / fitHeight,
    );
    final offset = Offset(
      (size.width - _window.width * scale) / 2,
      (size.height - _window.height * scale) / 2,
    );
    final displayed = Rect.fromLTWH(
      rect.left * scale,
      rect.top * scale,
      rect.width * scale,
      rect.height * scale,
    ).shift(offset);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: ColoredBox(
        color: const Color(0xff24202c),
        child: Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: CustomPaint(
                  painter: _TransformPainter(
                    widget.image,
                    displayed,
                    offset &
                        Size(_window.width * scale, _window.height * scale),
                  ),
                ),
              ),
            ),
            Positioned.fromRect(
              rect: displayed,
              child: Semantics(
                label: 'Reposition photo',
                child: Listener(
                  key: const ValueKey('reposition-photo'),
                  behavior: HitTestBehavior.opaque,
                  onPointerDown: (event) => _down(event, scale),
                  onPointerMove: _move,
                  onPointerUp: (event) => _end(event, scale),
                  onPointerCancel: (event) => _end(event, scale),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xffdbcbfa)),
                    ),
                  ),
                ),
              ),
            ),
            for (final (name, corner) in [
              ('top-left', Alignment.topLeft),
              ('top-right', Alignment.topRight),
              ('bottom-left', Alignment.bottomLeft),
              ('bottom-right', Alignment.bottomRight),
            ])
              Positioned(
                left:
                    displayed.left + (corner.x + 1) / 2 * displayed.width - 22,
                top: displayed.top + (corner.y + 1) / 2 * displayed.height - 22,
                child: Semantics(
                  label: 'Resize photo $name',
                  button: true,
                  child: Listener(
                    key: ValueKey('resize-photo-$name'),
                    behavior: HitTestBehavior.opaque,
                    onPointerDown: (event) => _down(event, scale, corner),
                    onPointerMove: _move,
                    onPointerUp: (event) => _end(event, scale),
                    onPointerCancel: (event) => _end(event, scale),
                    child: SizedBox(
                      width: 44,
                      height: 44,
                      child: Center(
                        child: Container(
                          width: 16,
                          height: 16,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            border: Border.all(
                              color: const Color(0xff523884),
                              width: 2,
                            ),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Dialog(
    insetPadding: const EdgeInsets.all(12),
    child: SizedBox(
      width: 760,
      height: math.min(MediaQuery.sizeOf(context).height * .9, 780),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Adjust your photo',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Done'),
                ),
              ],
            ),
            const Text(
              'Drag the image or pull a corner. The outlined window is your frame.',
            ),
            const SizedBox(height: 12),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) => _workspace(constraints),
              ),
            ),
            const SizedBox(height: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: () {
                        _change(const PhotoCrop());
                        setState(() => _fitCrop = const PhotoCrop());
                      },
                      child: const Text('Reset crop'),
                    ),
                    OutlinedButton(
                      onPressed: () => setState(() => _fitCrop = _crop),
                      child: const Text('Fit image'),
                    ),
                  ],
                ),
                Row(
                  children: [
                    const Text('Zoom'),
                    Expanded(
                      child: Slider(
                        label: 'Zoom',
                        min: 1,
                        max: 3,
                        value: _crop.zoom,
                        onChanged: (zoom) => _change(
                          PhotoCrop(x: _crop.x, y: _crop.y, zoom: zoom),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

class _TransformPainter extends CustomPainter {
  const _TransformPainter(this.image, this.bounds, this.window);
  final ui.Image image;
  final Rect bounds, window;
  @override
  void paint(Canvas canvas, Size size) {
    final source = Rect.fromLTWH(
      0,
      0,
      image.width.toDouble(),
      image.height.toDouble(),
    );
    canvas.drawImageRect(
      image,
      source,
      bounds,
      Paint()
        ..color = Colors.white.withValues(alpha: .3)
        ..filterQuality = FilterQuality.medium,
    );
    canvas.save();
    canvas.clipRect(window);
    canvas.drawImageRect(
      image,
      source,
      bounds,
      Paint()..filterQuality = FilterQuality.medium,
    );
    canvas.restore();
    canvas.drawRect(
      window,
      Paint()
        ..color = const Color(0xffb7a1dc)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4,
    );
    canvas.drawRect(
      window,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
  }

  @override
  bool shouldRepaint(_TransformPainter oldDelegate) =>
      oldDelegate.image != image ||
      oldDelegate.bounds != bounds ||
      oldDelegate.window != window;
}
