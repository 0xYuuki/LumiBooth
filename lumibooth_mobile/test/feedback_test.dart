import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumibooth_mobile/booth.dart';
import 'package:lumibooth_mobile/feedback_page.dart';

import 'draft_test_support.dart';

void main() {
  setUp(useUnavailableDraftStorage);
  test('email draft contains only form data and safely encodes punctuation and line breaks', () {
    final uri = feedbackUri(
      'Bug report',
      'Crop shifted & lost #1 + detail\nSecond line 💜',
      'reply+test@example.com',
    );
    expect(uri.scheme, 'mailto');
    expect(uri.path, 'alfortearjay0@gmail.com');
    expect(uri.queryParameters.keys, unorderedEquals(['subject', 'body']));
    expect(uri.queryParameters['subject'], 'LumiBooth — Bug report');
    expect(
      uri.queryParameters['body'],
      'Feedback type: Bug report\n\nCrop shifted & lost #1 + detail\nSecond line 💜\n\nReply contact: reply+test@example.com',
    );
    expect(
      feedbackUri(
        'Suggestion',
        'Please add a frame.',
        '',
      ).queryParameters['body'],
      isNot(contains('Reply contact')),
    );
    expect(validateFeedbackMessage('   '), isNotNull);
    expect(validateFeedbackMessage('a' * 3001), isNotNull);
    expect(validateFeedbackEmail('bad-email'), isNotNull);
    expect(validateFeedbackEmail('a@b.com\r\nBcc: other@b.com'), isNotNull);
    expect(validateFeedbackEmail(''), isNull);
  });
  Future<void> scrollTo(WidgetTester tester, Finder target) async {
    if (target.evaluate().isNotEmpty) {
      await tester.ensureVisible(target);
      await tester.pumpAndSettle();
      return;
    }
    await tester.scrollUntilVisible(
      target,
      180,
      scrollable: find
          .descendant(
            of: find.byType(ListView).first,
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'validation blocks invalid reports and opening a draft never claims it was sent',
    (tester) async {
      Uri? draft;
      await tester.pumpWidget(
        MaterialApp(
          home: FeedbackPage(
            openEmail: (uri) async {
              draft = uri;
              return true;
            },
          ),
        ),
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Reply email (optional)'),
        'invalid',
      );
      await scrollTo(tester, find.text('Open email draft'));
      await tester.tap(find.text('Open email draft'));
      await tester.pumpAndSettle();
      expect(draft, isNull);
      expect(
        find.text('Enter a valid email address, or leave this blank.'),
        findsOneWidget,
      );
      await scrollTo(tester, find.widgetWithText(TextFormField, 'Message'));
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Message'),
        'Please add more frame choices.',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Reply email (optional)'),
        'reply@example.com',
      );
      await scrollTo(tester, find.text('Open email draft'));
      await tester.tap(find.text('Open email draft'));
      await tester.pumpAndSettle();
      expect(draft?.path, feedbackEmail);
      expect(find.textContaining('LumiBooth cannot confirm'), findsOneWidget);
      expect(
        tester
            .widget<TextFormField>(
              find.widgetWithText(TextFormField, 'Message'),
            )
            .controller!
            .text,
        'Please add more frame choices.',
      );
    },
  );
  testWidgets(
    'missing mail app and launch errors leave the message available for retry',
    (tester) async {
      var fail = false;
      await tester.pumpWidget(
        MaterialApp(
          home: FeedbackPage(
            openEmail: (_) async {
              if (fail) throw StateError('unavailable');
              return false;
            },
          ),
        ),
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Message'),
        'Camera preview is not showing.',
      );
      await scrollTo(tester, find.text('Open email draft'));
      await tester.tap(find.text('Open email draft'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('No email app could be opened.'),
        findsOneWidget,
      );
      fail = true;
      await scrollTo(tester, find.text('Open email draft'));
      await tester.tap(find.text('Open email draft'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Could not open your email app.'),
        findsOneWidget,
      );
      expect(find.text('Copy feedback instead'), findsOneWidget);
      expect(
        tester
            .widget<TextFormField>(
              find.widgetWithText(TextFormField, 'Message'),
            )
            .controller!
            .text,
        'Camera preview is not showing.',
      );
    },
  );
  testWidgets(
    'guests reach Settings feedback and Android Back preserves an unsent message',
    (tester) async {
      addTearDown(() => disposeBooth(tester));
      await tester.pumpWidget(const LumiBooth());
      await tester.pumpAndSettle();
      await tester.tap(find.text('Me'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Settings'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Feedback'));
      await tester.pumpAndSettle();
      expect(find.text('Help shape LumiBooth.'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Message'),
        'Please make new pastel frames.',
      );
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Leave feedback?'), findsOneWidget);
      await tester.tap(find.text('Keep writing'));
      await tester.pumpAndSettle();
      expect(find.text('Please make new pastel frames.'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Leave'));
      await tester.pumpAndSettle();
      expect(find.text('Settings'), findsOneWidget);
    },
  );
  testWidgets('pending compose blocks duplicate taps', (tester) async {
    final completion = Completer<bool>();
    var calls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: FeedbackPage(
          openEmail: (_) {
            calls++;
            return completion.future;
          },
        ),
      ),
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Message'),
      'Please add a timer shortcut.',
    );
    await scrollTo(tester, find.text('Open email draft'));
    await tester.tap(find.text('Open email draft'));
    await tester.pump();
    await tester.tap(find.text('Opening email…'));
    await tester.pump();
    expect(calls, 1);
    completion.complete(true);
    await tester.pumpAndSettle();
  });
  testWidgets(
    'copy fallback works on a narrow screen without launching or claiming delivery',
    (tester) async {
      tester.view.physicalSize = const Size(360, 740);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      String? copied;
      var launches = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: FeedbackPage(
            openEmail: (_) async {
              launches++;
              return true;
            },
          ),
        ),
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Message'),
        'Please include more pastel backgrounds.',
      );
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
            if (call.method == 'Clipboard.setData') {
              copied = (call.arguments as Map)['text'] as String;
            }
            return null;
          });
      addTearDown(
        () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(SystemChannels.platform, null),
      );
      await scrollTo(tester, find.text('Copy feedback instead'));
      await tester.tap(find.text('Copy feedback instead'));
      await tester.pumpAndSettle();
      expect(copied, contains('To: alfortearjay0@gmail.com'));
      expect(copied, contains('Please include more pastel backgrounds.'));
      expect(launches, 0);
      expect(find.textContaining('Nothing has been sent.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
