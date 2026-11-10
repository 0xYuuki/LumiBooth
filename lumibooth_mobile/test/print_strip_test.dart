import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as image;
import 'package:lumibooth_mobile/print_strip.dart';
import 'package:pdf/pdf.dart';

void main() {
  test('QR and standard photo prints fit on 4 × 6 paper', () async {
    final strip = image.encodePng(image.Image(width: 100, height: 450));
    const format = PdfPageFormat(
      4 * PdfPageFormat.inch,
      6 * PdfPageFormat.inch,
    );
    final plain = await buildStripPdf(strip, format);
    final gallery = await buildStripPdf(
      strip,
      format,
      replayUrl: 'https://booth.example/p#${'a' * 48}',
      expiry: '02/08/2027',
    );
    expect(String.fromCharCodes(plain.take(5)), '%PDF-');
    expect(String.fromCharCodes(gallery.take(5)), '%PDF-');
    expect(gallery.length, greaterThan(plain.length));
  });
}
