import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/sticker_controls.dart';
import 'package:lumibooth_mobile/strip.dart';

void main() {
  testWidgets(
    'sticker handles move, resize and rotate inside a scrollable editor',
    (tester) async {
      const size = Size(300, 400);
      final sticker = ValueNotifier(
        const StripSticker('✨', Offset(.3, .35), 64),
      );
      final scroll = ScrollController();
      addTearDown(sticker.dispose);
      addTearDown(scroll.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView(
              controller: scroll,
              children: [
                SizedBox(
                  width: size.width,
                  height: size.height,
                  child: ValueListenableBuilder(
                    valueListenable: sticker,
                    builder: (context, value, _) {
                      final position = Offset(
                        value.position.dx * (size.width - value.size),
                        value.position.dy * (size.height - value.size),
                      );
                      return StickerControls(
                        sticker: value,
                        stripSize: size,
                        bounds: position & Size.square(value.size),
                        scale: 1,
                        selected: true,
                        enabled: true,
                        onSelect: () {},
                        onChanged: (next) => sticker.value = next,
                      );
                    },
                  ),
                ),
                const SizedBox(height: 850),
              ],
            ),
          ),
        ),
      );
      final move = find.byKey(const ValueKey('move sticker'));
      final start = sticker.value.position;
      await tester.drag(move, const Offset(12, 60));
      await tester.pump();
      expect(sticker.value.position.dx, greaterThan(start.dx));
      expect(sticker.value.position.dy, greaterThan(start.dy));
      expect(scroll.offset, 0);

      final resize = find.byKey(const ValueKey('Resize sticker'));
      await tester.drag(resize, const Offset(40, 40));
      await tester.pump();
      expect(sticker.value.size, closeTo(104, 1));

      final rotate = find.byKey(const ValueKey('Rotate sticker'));
      final center = tester.getCenter(move);
      final origin = tester.getCenter(rotate);
      final offset = origin - center;
      await tester.drag(
        rotate,
        center + Offset(-offset.dy, offset.dx) - origin,
      );
      await tester.pump();
      expect(sticker.value.angle, closeTo(90, 1));
    },
  );
}
