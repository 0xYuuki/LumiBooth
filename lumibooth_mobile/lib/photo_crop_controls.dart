import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'strip.dart';

/// Gesture surface positioned over the real photo opening, below its artwork.
class PhotoCropControls extends StatefulWidget {
  const PhotoCropControls({
    super.key,
    required this.design,
    required this.index,
    required this.scale,
    required this.origin,
    required this.selected,
    required this.onSelect,
    required this.onChanged,
  });
  final StripDesign design;
  final int index;
  final double scale;
  final Offset origin;
  final bool selected;
  final VoidCallback onSelect;
  final ValueChanged<PhotoCrop> onChanged;
  @override
  State<PhotoCropControls> createState() => _PhotoCropControlsState();
}

class _PhotoCropControlsState extends State<PhotoCropControls> {
  PhotoCrop _start = const PhotoCrop();
  Offset _focal = Offset.zero;
  @override
  Widget build(BuildContext context) {
    final opening = StripPainter.photoOpening(widget.design, widget.index);
    final rect = Rect.fromLTWH(
      opening.bounds.left * widget.scale,
      opening.bounds.top * widget.scale,
      opening.bounds.width * widget.scale,
      opening.bounds.height * widget.scale,
    ).shift(widget.origin);
    return Positioned.fromRect(
      rect: rect,
      child: Transform.rotate(
        angle: opening.angle,
        origin: (opening.pivot - opening.bounds.center) * widget.scale,
        child: Semantics(
          label: 'Adjust photo ${widget.index + 1}',
          button: true,
          selected: widget.selected,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.onSelect,
            onScaleStart: (details) {
              widget.onSelect();
              _start = widget.design.cropAt(widget.index);
              _focal = details.focalPoint;
            },
            onScaleUpdate: (details) {
              final image = widget.design.photos[widget.index];
              final zoom = (_start.zoom * details.scale).clamp(1.0, 3.0);
              final ratio =
                  math.max(
                    rect.width / image.width,
                    rect.height / image.height,
                  ) *
                  zoom;
              final delta = details.focalPoint - _focal;
              final dx =
                  delta.dx * math.cos(opening.angle) +
                  delta.dy * math.sin(opening.angle);
              final dy =
                  delta.dy * math.cos(opening.angle) -
                  delta.dx * math.sin(opening.angle);
              final overflowX = image.width * ratio - rect.width,
                  overflowY = image.height * ratio - rect.height;
              widget.onChanged(
                PhotoCrop(
                  x: overflowX > .01 ? _start.x - dx / overflowX : _start.x,
                  y: overflowY > .01 ? _start.y - dy / overflowY : _start.y,
                  zoom: zoom,
                ).normalized(),
              );
            },
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: widget.selected
                    ? Border.all(color: Colors.white, width: 2)
                    : null,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
