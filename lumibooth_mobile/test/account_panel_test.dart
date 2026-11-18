import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lumibooth_mobile/account_panel.dart';
import 'package:lumibooth_mobile/online_booth.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  testWidgets('Me account controls sign in, sign out, and request recovery', (
    tester,
  ) async {
    const email = 'guest@example.com';
    final user = {
      'id': 'account-user',
      'email': email,
      'aud': 'authenticated',
      'role': 'authenticated',
      'created_at': '2026-01-01T00:00:00Z',
      'is_anonymous': false,
    };
    final claims = base64Url
        .encode(
          utf8.encode(
            jsonEncode({
              'sub': user['id'],
              'exp': DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600,
            }),
          ),
        )
        .replaceAll('=', '');
    final session = {
      'access_token': 'eyJhbGciOiJIUzI1NiJ9.$claims.fake',
      'refresh_token': 'refresh-account',
      'token_type': 'bearer',
      'expires_in': 3600,
      'user': user,
    };
    final requests = <http.Request>[];
    final client = GoTrueClient(
      url: 'https://lumi-test.invalid/auth/v1',
      autoRefreshToken: false,
      asyncStorage: _VerifierStorage(),
      httpClient: MockClient((request) async {
        requests.add(request);
        switch (request.url.path) {
          case '/auth/v1/token':
            if (jsonDecode(request.body)['password'] == 'wrong-password') {
              return http.Response(
                jsonEncode({
                  'code': 'invalid_credentials',
                  'msg': 'Invalid login credentials',
                }),
                400,
              );
            }
            return http.Response(jsonEncode(session), 200);
          case '/auth/v1/logout':
            return http.Response('', 204);
          case '/auth/v1/recover':
            return http.Response('{}', 200);
          case '/auth/v1/signup':
            return http.Response(jsonEncode(user), 200);
          case '/auth/v1/user':
            return http.Response(jsonEncode(user), 200);
          default:
            throw StateError('Unexpected account request');
        }
      }),
    );
    addTearDown(client.dispose);
    addTearDown(() => OnlineBooth.accountRecovery.value = false);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AccountPanel(auth: client)),
      ),
    );

    await tester.tap(find.text('Log in'));
    await tester.pump();
    expect(find.text('Enter a valid email address.'), findsOneWidget);
    expect(requests, isEmpty);

    await tester.enterText(find.byType(TextFormField).at(0), email);
    await tester.enterText(find.byType(TextFormField).at(1), 'wrong-password');
    await tester.tap(find.text('Log in'));
    await tester.pumpAndSettle();
    expect(find.text('Invalid login credentials'), findsOneWidget);

    await tester.enterText(
      find.byType(TextFormField).at(1),
      'original-password',
    );
    await tester.tap(find.text('Log in'));
    await tester.pumpAndSettle();
    expect(find.text(email), findsOneWidget);
    OnlineBooth.accountRecovery.value = true;
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), 'updated-password');
    await tester.tap(find.text('Update password'));
    await tester.pumpAndSettle();
    expect(find.text('Your password has been updated.'), findsOneWidget);

    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign up'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'original-password',
    );
    await tester.tap(find.text('Create an account'));
    await tester.pumpAndSettle();
    expect(
      find.text('Check your email for a confirmation link.'),
      findsOneWidget,
    );

    await tester.tap(find.text('Forgot password?'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Send reset link'));
    await tester.pumpAndSettle();
    expect(find.textContaining('a reset link is on its way'), findsOneWidget);
    expect(
      requests.last.url.queryParameters['redirect_to'],
      OnlineBooth.accountRedirect,
    );
  });
}

class _VerifierStorage extends GotrueAsyncStorage {
  final _items = <String, String>{};

  @override
  Future<String?> getItem({required String key}) async => _items[key];

  @override
  Future<void> setItem({required String key, required String value}) async {
    _items[key] = value;
  }

  @override
  Future<void> removeItem({required String key}) async {
    _items.remove(key);
  }
}
