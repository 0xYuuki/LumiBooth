import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'sticker_pack.dart';

class StripLayout {
  const StripLayout(
    this.name,
    this.count,
    this.columns, {
    this.photosPerCell = 1,
  });

  final String name;
  final int count;
  final int columns;
  final int photosPerCell;

  int get requiredPhotos => count * photosPerCell;

  static const remoteDuo = StripLayout('Duo Strip', 3, 1, photosPerCell: 2);

  static const choices = [
    StripLayout('Single Photo', 1, 1),
    StripLayout('Dual Strip', 2, 1),
    StripLayout('Triple Strip', 3, 1),
    StripLayout('4-Grid Classic', 4, 2),
    StripLayout('6-Grid Wide', 6, 2),
  ];
}

enum StripFrame {
  tubeTV(
    'Tube TV',
    'NOW ON AIR',
    Color(0xffe5d1ad),
    Color(0xff4a3023),
    32,
    art: FrameArt('tube-tv', Rect.fromLTWH(30, 34, 262, 211)),
  ),
  cameraFilm(
    'Camera Film',
    'THE 35 MM ROLL',
    Color(0xff241f20),
    Color(0xfff7e6c2),
    0,
    art: FrameArt(
      'camera-film',
      Rect.fromLTWH(52, 13, 296, 274),
      header: 'camera-header',
    ),
  ),
  vinyl(
    'Vinyl Instant',
    'ON REPEAT',
    Color(0xffe5d9c8),
    Color(0xff4d3940),
    0,
    art: FrameArt('vinyl-instant', Rect.fromLTWH(104, 34, 223, 211), tilt: 4),
  ),
  scrapbook(
    'Love Scrapbook',
    'SEALED WITH LOVE',
    Color(0xff8a2035),
    Color(0xfffff0d3),
    0,
    art: FrameArt('love-scrapbook', Rect.fromLTWH(29, 25, 342, 244)),
  ),
  zine(
    'Retro Zine',
    'THE GOOD OLD DAYS',
    Color(0xff9d2e20),
    Color(0xffffebbf),
    0,
    art: FrameArt('retro-zine', Rect.fromLTWH(47, 20, 306, 256)),
  ),
  studio('Studio', 'THE PHOTO BOOTH', Color(0xfffffdf8), Color(0xff292630), 0),
  film(
    'Analog Film',
    'ANALOG · 35 MM',
    Color(0xff24212b),
    Color(0xfff7f1e8),
    0,
  ),
  postcard(
    'Soft Postcard',
    'A LITTLE KEEPSAKE',
    Color(0xfff5e4d8),
    Color(0xff672f3f),
    14,
    rule: true,
  ),
  lavender(
    'Lavender Grid',
    'GOOD TIMES CLUB',
    Color(0xffeee8fb),
    Color(0xff49347c),
    6,
    rule: true,
  ),
  classic(
    'Classic White',
    'PHOTO STRIP',
    Color(0xffffffff),
    Color(0xff242424),
    0,
    border: Color(0xff242424),
    rule: true,
  ),
  instant(
    'Instant Print',
    'IN THE MOMENT',
    Color(0xfffffefa),
    Color(0xff37332d),
    0,
    border: Color(0xffded7ca),
    footer: 28,
  ),
  retro(
    'Retro Flash',
    'GOOD TIMES · PHOTO BOOTH',
    Color(0xfff4d38d),
    Color(0xff56251f),
    3,
    rule: true,
    signaturePaper: true,
  ),
  vintage(
    'Vintage Sepia',
    'FROM THE ARCHIVE',
    Color(0xffead6ae),
    Color(0xff5c3b25),
    2,
    border: Color(0xff9e7248),
    rule: true,
  ),
  diner(
    'Cherry Diner',
    'SWEET MEMORIES',
    Color(0xfffff3e9),
    Color(0xff78182b),
    8,
    rule: true,
    signaturePaper: true,
  ),
  arcade(
    '90s Arcade',
    'HIGH SCORE · GOOD TIMES',
    Color(0xff22183d),
    Color(0xffbdfcf1),
    6,
    border: Color(0xff8cebdc),
    signaturePaper: true,
  ),
  disco(
    'Disco Night',
    'AFTER DARK',
    Color(0xff1a142e),
    Color(0xffffdcf7),
    4,
    signaturePaper: true,
  ),
  wedding(
    'Wedding Ivory',
    'A DAY TO REMEMBER',
    Color(0xfffff7e8),
    Color(0xff65462d),
    8,
    border: Color(0xffad824e),
    rule: true,
  ),
  birthday(
    'Birthday Confetti',
    'LET’S CELEBRATE',
    Color(0xfffff3d7),
    Color(0xff673856),
    12,
    rule: true,
    signaturePaper: true,
  ),
  holiday(
    'Holiday Evergreen',
    'HAPPY HOLIDAYS',
    Color(0xff234a3f),
    Color(0xffffefd0),
    6,
    border: Color(0xffc6a168),
    signaturePaper: true,
  );

  const StripFrame(
    this.label,
    this.caption,
    this.paper,
    this.ink,
    this.radius, {
    this.border,
    this.footer = 0,
    this.rule = false,
    this.signaturePaper = false,
    this.art,
  });

  final String label;
  final String caption;
  final Color paper;
  final Color ink;
  final double radius;
  final Color? border;
  final double footer;
  final bool rule;
  final bool signaturePaper;
  final FrameArt? art;
}

class FrameArt {
  const FrameArt(this.name, this.window, {this.header, this.tilt = 0});

  final String name;
  final Rect window;
  final String? header;
  final double tilt;

  static String asset(String name) => 'assets/frames/$name.png';
}

class FrameImages {
  const FrameImages(this.overlay, this.header);

  final ui.Image overlay;
  final ui.Image? header;

  static Future<FrameImages> load(FrameArt art) async {
    final overlay = await _loadImage(art.name);
    try {
      final header = art.header;
      return FrameImages(
        overlay,
        header == null ? null : await _loadImage(header),
      );
    } catch (_) {
      overlay.dispose();
      rethrow;
    }
  }

  static Future<ui.Image> _loadImage(String name) async {
    final asset = await rootBundle.load(FrameArt.asset(name));
    final bytes = asset.buffer.asUint8List(
      asset.offsetInBytes,
      asset.lengthInBytes,
    );
    final codec = await ui.instantiateImageCodec(bytes);
    try {
      return (await codec.getNextFrame()).image;
    } finally {
      codec.dispose();
    }
  }

  void dispose() {
    overlay.dispose();
    header?.dispose();
  }
}

class StripSticker {
  const StripSticker(
    this.symbol,
    this.position,
    this.size, {
    this.image,
    this.source,
    this.angle = 0,
  });

  final ui.Image? image;
  final Rect? source;

  StripSticker copyWith({Offset? position, double? size, double? angle}) =>
      StripSticker(
        symbol,
        position ?? this.position,
        size ?? this.size,
        image: image,
        source: source,
        angle: angle ?? this.angle,
      );

  static const minSize = 32.0;
  static const maxSize = 150.0;

  final String symbol;
  final Offset position;
  final double size;
  final double angle;

  Offset _topLeft(Size strip) => Offset(
    position.dx * (strip.width - size),
    position.dy * (strip.height - size),
  );

  Offset _normalize(Offset topLeft, double size, Size strip) => Offset(
    (topLeft.dx / math.max(1, strip.width - size)).clamp(0.0, 1.0),
    (topLeft.dy / math.max(1, strip.height - size)).clamp(0.0, 1.0),
  );

  StripSticker moveBy(Offset delta, Size strip) =>
      copyWith(position: _normalize(_topLeft(strip) + delta, size, strip));

  StripSticker resizeTo(double value, Size strip) {
    final limit = math.min(maxSize, strip.shortestSide);
    final next = value.clamp(math.min(minSize, limit), limit).toDouble();
    return copyWith(
      size: next,
      position: _normalize(_topLeft(strip), next, strip),
    );
  }

  StripSticker rotateBy(double degrees) =>
      copyWith(angle: ((angle + degrees + 180) % 360) - 180);
}

enum StripFont {
  outfit('Outfit'),
  playfair('Playfair Display'),
  spaceMono('Space Mono'),
  caveat('Caveat');

  const StripFont(this.family);

  final String family;
}

class StripDesign {
  const StripDesign({
    required this.layout,
    this.frame = StripFrame.studio,
    this.photos = const [],
    this.stickers = const [],
    this.frameImages,
    this.caption,
    this.font = StripFont.outfit,
  });

  final StripLayout layout;
  final StripFrame frame;
  final List<ui.Image> photos;
  final List<StripSticker> stickers;
  final FrameImages? frameImages;
  final String? caption;
  final StripFont font;

  String get footerCaption => (caption ?? frame.caption).trim();

  double get width {
    if (layout.photosPerCell == 2) return 320;
    return layout.columns == 1 && layout.count > 1 ? 220 : 360;
  }

  double get cellWidth =>
      (width - 48 - 10 * (layout.columns - 1)) / layout.columns;
  double get cellHeight =>
      cellWidth *
      (frame.art != null || layout.photosPerCell == 2 ? 3 / 4 : 4 / 3);
  double get headerWidth => math.min(255, width - 48);
  double get headerHeight =>
      frame.art?.header == null ? 0 : headerWidth * 149 / 400 + 10;
  int get rows => (layout.count / layout.columns).ceil();
  Size get size => Size(
    width,
    88 + frame.footer + headerHeight + cellHeight * rows + 10 * (rows - 1),
  );

  Future<Uint8List> exportPng() async {
    if (frame.art != null && frameImages == null) {
      throw StateError('Frame artwork must be loaded before export.');
    }
    const scale = 3.0;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder)..scale(scale);
    StripPainter(this).paint(canvas, size);
    final picture = recorder.endRecording();
    try {
      final image = await picture.toImage(
        (size.width * scale).ceil(),
        (size.height * scale).ceil(),
      );
      try {
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        if (data == null) throw StateError('The strip could not be encoded.');
        return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      } finally {
        image.dispose();
      }
    } finally {
      picture.dispose();
    }
  }
}

class StripPainter extends CustomPainter {
  const StripPainter(
    this.design, {
    this.selected,
    this.motionFrames = const {},
  });

  final StripDesign design;
  final int? selected;
  final Map<int, ui.Image> motionFrames;

  static Rect stickerBounds(StripDesign design, StripSticker sticker) {
    return Rect.fromLTWH(
      sticker.position.dx * (design.size.width - sticker.size),
      sticker.position.dy * (design.size.height - sticker.size),
      sticker.size,
      sticker.size,
    );
  }

  @override
  void paint(Canvas canvas, Size size) {
    final original = design.size;
    final frame = design.frame;
    canvas.save();
    canvas.scale(size.width / original.width, size.height / original.height);
    canvas.clipRect(Offset.zero & original);
    canvas.drawColor(frame.paper, BlendMode.src);

    _paintMotif(canvas, original, frame);
    if (frame.border case final color?) {
      canvas.drawRect(
        (Offset.zero & original).deflate(9),
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke,
      );
    }

    if (design.frameImages?.header case final header?) {
      _drawArtwork(
        canvas,
        header,
        Rect.fromLTWH(
          (original.width - design.headerWidth) / 2,
          24,
          design.headerWidth,
          design.headerHeight - 10,
        ),
      );
    }
    for (var i = 0; i < design.layout.count; i++) {
      final cell = Rect.fromLTWH(
        24 + (i % design.layout.columns) * (design.cellWidth + 10),
        24 +
            design.headerHeight +
            (i ~/ design.layout.columns) * (design.cellHeight + 10),
        design.cellWidth,
        design.cellHeight,
      );
      final art = frame.art;
      canvas.save();
      if (art != null && art.tilt != 0) {
        canvas.translate(cell.center.dx, cell.center.dy);
        canvas.rotate((i.isEven ? -art.tilt : art.tilt) * math.pi / 180);
        canvas.translate(-cell.center.dx, -cell.center.dy);
      }
      final photoBounds = art == null
          ? cell
          : Rect.fromLTWH(
              cell.left + art.window.left * cell.width / 400,
              cell.top + art.window.top * cell.height / 300,
              art.window.width * cell.width / 400,
              art.window.height * cell.height / 300,
            );
      final photoRadius = art == null
          ? frame.radius
          : frame.radius * cell.width / 400;
      _paintPhoto(
        canvas,
        i,
        RRect.fromRectAndRadius(photoBounds, Radius.circular(photoRadius)),
      );
      if (design.frameImages?.overlay case final overlay?) {
        _drawArtwork(canvas, overlay, cell);
      }
      canvas.restore();
    }

    final footer = original.height - 51 - frame.footer / 2;
    if (frame.signaturePaper) {
      canvas.drawRect(
        Rect.fromLTWH(24, footer - 5, original.width - 48, 43),
        Paint()..color = frame.paper,
      );
    }
    if (frame.rule) {
      canvas.drawLine(
        Offset(24, footer - 5),
        Offset(original.width - 24, footer - 5),
        Paint()..color = frame.ink,
      );
    }
    _text(
      canvas,
      'LumiBooth',
      Offset(original.width / 2, footer + 8),
      TextStyle(
        color: frame.ink,
        fontFamily: design.font.family,
        fontSize: 17,
        fontWeight: FontWeight.w700,
      ),
    );
    final caption = design.footerCaption;
    if (caption.isNotEmpty) {
      _text(
        canvas,
        caption,
        Offset(original.width / 2, footer + 28),
        TextStyle(
          color: frame.ink,
          fontFamily: design.font.family,
          fontSize: 9,
          letterSpacing: 1.5,
        ),
        maxWidth: original.width - 54,
      );
    }

    for (var i = 0; i < design.stickers.length; i++) {
      final sticker = design.stickers[i];
      final bounds = stickerBounds(design, sticker);
      canvas.save();
      canvas.translate(bounds.center.dx, bounds.center.dy);
      canvas.rotate(sticker.angle * math.pi / 180);
      canvas.translate(-bounds.center.dx, -bounds.center.dy);
      final image = sticker.image;
      if (image != null) {
        StickerImagePainter.draw(canvas, image, sticker.source!, bounds);
      } else {
        _text(
          canvas,
          sticker.symbol,
          bounds.center,
          TextStyle(fontSize: sticker.size * 0.8),
        );
      }
      canvas.restore();
      if (i == selected) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(bounds, const Radius.circular(4)),
          Paint()
            ..color = const Color(0xff523884)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
    }
    canvas.restore();
  }

  void _paintPhoto(Canvas canvas, int index, RRect bounds) {
    final photosPerCell = design.layout.photosPerCell;
    final first = index * photosPerCell;
    if (first + photosPerCell > design.photos.length) {
      canvas.drawRRect(bounds, Paint()..color = const Color(0xffd0bdc0));
      return;
    }
    final rect = bounds.outerRect;
    canvas.save();
    canvas.clipRRect(bounds);
    if (photosPerCell == 2) {
      final middle = rect.center.dx;
      _drawPhotoCover(
        canvas,
        design.photos[first],
        Rect.fromLTRB(rect.left, rect.top, middle, rect.bottom),
      );
      _drawPhotoCover(
        canvas,
        design.photos[first + 1],
        Rect.fromLTRB(middle, rect.top, rect.right, rect.bottom),
      );
    } else {
      _drawPhotoCover(
        canvas,
        motionFrames[index] ?? design.photos[first],
        rect,
      );
    }
    canvas.restore();
  }

  void _drawPhotoCover(Canvas canvas, ui.Image image, Rect destination) {
    final source = Size(image.width.toDouble(), image.height.toDouble());
    final crop = applyBoxFit(BoxFit.cover, source, destination.size).source;
    canvas.drawImageRect(
      image,
      Alignment.center.inscribe(crop, Offset.zero & source),
      destination,
      Paint()..filterQuality = FilterQuality.medium,
    );
  }

  void _drawArtwork(Canvas canvas, ui.Image image, Rect destination) {
    canvas.drawImageRect(
      image,
      Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
      destination,
      Paint()..filterQuality = FilterQuality.medium,
    );
  }

  void _paintMotif(Canvas canvas, Size size, StripFrame frame) {
    final paint = Paint();
    switch (frame) {
      case StripFrame.film:
        paint.color = frame.ink;
        for (var y = 10.0; y < size.height; y += 17) {
          canvas.drawCircle(Offset(9, y), 2.3, paint);
          canvas.drawCircle(Offset(size.width - 9, y), 2.3, paint);
        }
      case StripFrame.lavender:
        paint.color = const Color(0xffdcd0f4);
        for (var x = 0.0; x < size.width; x += 16) {
          canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
        }
        for (var y = 0.0; y < size.height; y += 16) {
          canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
        }
      case StripFrame.retro:
        paint.color = const Color(0xffa94637);
        for (var row = 0; row * 12 < size.height; row++) {
          for (var x = (row % 2) * 12.0; x < size.width; x += 24) {
            canvas.drawRect(Rect.fromLTWH(x, row * 12.0, 12, 12), paint);
          }
        }
      case StripFrame.vintage:
        paint.shader = const LinearGradient(
          colors: [
            Color(0xffb68c61),
            Color(0x00b68c61),
            Color(0x00b68c61),
            Color(0xffb68c61),
          ],
          stops: [0, .07, .93, 1],
        ).createShader(Offset.zero & size);
        canvas.drawRect(Offset.zero & size, paint);
      case StripFrame.diner:
        paint.color = const Color(0x4ddf7584);
        for (var x = 0.0; x < size.width; x += 18) {
          canvas.drawRect(Rect.fromLTWH(x, 0, 9, size.height), paint);
        }
        for (var y = 0.0; y < size.height; y += 18) {
          canvas.drawRect(Rect.fromLTWH(0, y, size.width, 9), paint);
        }
      case StripFrame.arcade || StripFrame.holiday:
        final colors = frame == StripFrame.arcade
            ? [const Color(0xff61448c), const Color(0xffd65cbb)]
            : [const Color(0xff496e5c), const Color(0xffb77a4d)];
        paint.strokeWidth = 2;
        for (var x = -size.height; x < size.width; x += 26) {
          canvas.drawLine(
            Offset(x, 0),
            Offset(x + size.height, size.height),
            paint..color = colors[0],
          );
          canvas.drawLine(
            Offset(x + 12, 0),
            Offset(x + 12 + size.height, size.height),
            paint..color = colors[1],
          );
        }
      case StripFrame.disco:
        _paintDots(canvas, size, 20, 1.5, [
          (const Offset(5, 5), const Color(0xffffd18a)),
          (const Offset(15, 15), const Color(0xffdc8fe8)),
        ]);
      case StripFrame.birthday:
        _paintDots(canvas, size, 24, 2, [
          (const Offset(5, 5), const Color(0xffee7c92)),
          (const Offset(15, 14), const Color(0xff5aa990)),
          (const Offset(7, 20), const Color(0xffad83d7)),
        ]);
      case StripFrame.tubeTV ||
          StripFrame.cameraFilm ||
          StripFrame.vinyl ||
          StripFrame.scrapbook ||
          StripFrame.zine ||
          StripFrame.studio ||
          StripFrame.postcard ||
          StripFrame.classic ||
          StripFrame.instant ||
          StripFrame.wedding:
        break;
    }
  }

  void _paintDots(
    Canvas canvas,
    Size size,
    double step,
    double radius,
    List<(Offset, Color)> dots,
  ) {
    final paint = Paint();
    for (var x = 0.0; x < size.width; x += step) {
      for (var y = 0.0; y < size.height; y += step) {
        for (final (position, color) in dots) {
          canvas.drawCircle(
            Offset(x, y) + position,
            radius,
            paint..color = color,
          );
        }
      }
    }
  }

  void _text(
    Canvas canvas,
    String value,
    Offset center,
    TextStyle style, {
    double? maxWidth,
  }) {
    final painter = TextPainter(
      text: TextSpan(text: value, style: style),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout();
    final scale = maxWidth != null && painter.width > maxWidth
        ? maxWidth / painter.width
        : 1.0;
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(scale);
    painter.paint(canvas, Offset(-painter.width / 2, -painter.height / 2));
    canvas.restore();
    painter.dispose();
  }

  @override
  bool shouldRepaint(StripPainter oldDelegate) =>
      oldDelegate.design != design ||
      oldDelegate.selected != selected ||
      oldDelegate.motionFrames != motionFrames;
}

class StripPreview extends StatelessWidget {
  const StripPreview(this.design, {super.key, this.maxWidth = 340});

  final StripDesign design;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = math.min(constraints.maxWidth, maxWidth);
        return CustomPaint(
          size: Size(width, width / design.size.aspectRatio),
          painter: StripPainter(design),
        );
      },
    );
  }
}
