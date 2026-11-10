import 'package:flutter/material.dart';
import 'package:qr/qr.dart';

class GalleryQr extends StatelessWidget {
  const GalleryQr({super.key, required this.url});

  final String url;

  @override
  Widget build(BuildContext context) => Semantics(
    image: true,
    label: 'Scan to download photos',
    child: CustomPaint(
      size: const Size.square(216),
      painter: _GalleryQrPainter(url),
    ),
  );
}

class _GalleryQrPainter extends CustomPainter {
  _GalleryQrPainter(this.url)
    : code = QrImage(
        QrCode.fromData(data: url, errorCorrectLevel: QrErrorCorrectLevel.M),
      );

  final String url;
  final QrImage code;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = Colors.white);
    const border = 4;
    final step = size.shortestSide / (code.moduleCount + border * 2);
    final ink = Paint()
      ..color = Colors.black
      ..isAntiAlias = false;
    for (var row = 0; row < code.moduleCount; row++) {
      for (var column = 0; column < code.moduleCount; column++) {
        if (code.isDark(row, column)) {
          canvas.drawRect(
            Rect.fromLTRB(
              ((column + border) * step).roundToDouble(),
              ((row + border) * step).roundToDouble(),
              ((column + border + 1) * step).roundToDouble(),
              ((row + border + 1) * step).roundToDouble(),
            ),
            ink,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(_GalleryQrPainter oldDelegate) => url != oldDelegate.url;
}
