import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/strip_viewer.dart';

void main() {
  testWidgets('a long strip can fill the screen width and pan vertically', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    const strip = ValueKey('strip');

    await tester.pumpWidget(
      const MaterialApp(
        home: StripViewer(
          aspectRatio: 0.25,
          child: ColoredBox(key: strip, color: Colors.green),
        ),
      ),
    );
    expect(tester.getSize(find.byKey(strip)).width, lessThan(360));

    await tester.tap(find.text('Fit width'));
    await tester.pumpAndSettle();
    expect(tester.getSize(find.byKey(strip)).width, 360);
    final before = tester.getTopLeft(find.byKey(strip)).dy;
    await tester.drag(find.byType(InteractiveViewer), const Offset(0, -250));
    await tester.pumpAndSettle();
    expect(tester.getTopLeft(find.byKey(strip)).dy, lessThan(before));

    await tester.tap(find.text('Fit strip'));
    await tester.pumpAndSettle();
    expect(tester.getSize(find.byKey(strip)).width, lessThan(360));
  });
}
