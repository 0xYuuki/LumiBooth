import 'dart:typed_data';

import 'package:pdf/pdf.dart' show PdfPageFormat;
import 'package:pdf/widgets.dart' as pdf;
import 'package:printing/printing.dart';

Future<void> printStrip(
  Uint8List bytes, {
  String? replayUrl,
  String? expiry,
}) async {
  await Printing.layoutPdf(
    name: 'LumiBooth photo strip',
    onLayout: (format) =>
        buildStripPdf(bytes, format, replayUrl: replayUrl, expiry: expiry),
  );
}

Future<Uint8List> buildStripPdf(
  Uint8List bytes,
  PdfPageFormat format, {
  String? replayUrl,
  String? expiry,
}) {
  final document = pdf.Document();
  document.addPage(
    pdf.Page(
      pageFormat: format,
      margin: const pdf.EdgeInsets.all(18),
      build: (_) {
        final strip = pdf.Image(
          pdf.MemoryImage(bytes),
          fit: pdf.BoxFit.contain,
        );
        return pdf.Center(
          child: replayUrl == null
              ? strip
              : pdf.Column(
                  mainAxisAlignment: pdf.MainAxisAlignment.center,
                  children: [
                    pdf.Flexible(child: strip),
                    pdf.SizedBox(height: 8),
                    pdf.BarcodeWidget(
                      barcode: pdf.Barcode.qrCode(),
                      data: replayUrl,
                      width: 72,
                      height: 72,
                      padding: const pdf.EdgeInsets.all(6),
                      drawText: false,
                    ),
                    pdf.Text(
                      'Scan for photos',
                      style: const pdf.TextStyle(fontSize: 11),
                    ),
                    if (expiry != null)
                      pdf.Text(
                        'Until $expiry',
                        style: const pdf.TextStyle(fontSize: 9),
                      ),
                  ],
                ),
        );
      },
    ),
  );
  return document.save();
}
