import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/settings_page.dart';

void main() {
  testWidgets('guests can read privacy information from Settings', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: BoothSettingsPage()));
    await tester.tap(find.text('Legal documents'));
    await tester.pumpAndSettle();

    expect(find.text('Privacy information'), findsOneWidget);
    expect(find.textContaining('Clearing app data'), findsOneWidget);
    expect(find.text('Open-source licenses'), findsOneWidget);
    expect(find.text('Privacy Policy'), findsNothing);
    expect(find.text('Terms of Use'), findsNothing);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Settings'), findsOneWidget);
  });
}
