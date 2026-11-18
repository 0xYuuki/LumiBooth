import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'account_session_storage.dart';

abstract final class OnlineBooth {
  static const _url = String.fromEnvironment('LUMI_SUPABASE_URL');
  static const _key = String.fromEnvironment('LUMI_SUPABASE_KEY');
  static const _publicUrl = String.fromEnvironment('LUMI_PUBLIC_URL');
  static const _print = bool.fromEnvironment('LUMI_PRINT_QR');
  static const _remote = bool.fromEnvironment('LUMI_REMOTE_BOOTH');
  static SupabaseClient? _guestClient;
  static GoTrueClient? _accountAuth;
  static GoTrueClient? get accountAuth => _accountAuth;
  static Future<void>? _guestReady;
  static Future<AuthResponse>? _signIn;

  /// Whether any online service capability (web sharing or remote booth) is configured and initialized.
  ///
  /// This indicates capability enablement based on environment configuration,
  /// not verified live network reachability.
  static bool get isConfigured => printEnabled || remoteEnabled;

  /// Whether online services are enabled based on build-time configuration.
  ///
  /// Alias for [isConfigured] to provide explicit status without implying live backend connectivity.
  static bool get enabled => isConfigured;

  /// Whether web QR gallery upload and sharing capabilities are enabled.
  static bool get printEnabled => _guestClient != null && _print;

  /// Whether remote booth live sync capabilities are enabled.
  static bool get remoteEnabled => _guestClient != null && _remote;
  static SupabaseClient get _client => _guestClient!;
  static const accountRedirect = 'com.lumibooth.app://auth/callback';
  static final accountRecovery = ValueNotifier(false);
  static final accountLinkError = ValueNotifier<String?>(null);

  static Future<void> initialize() async {
    if (_accountAuth != null || _url.isEmpty || _key.isEmpty) return;
    final projectRef = Uri.parse(_url).host.split('.').first;
    if (_guestClient == null && _publicUrl.isNotEmpty && (_print || _remote)) {
      final guest = SupabaseClient(_url, _key);
      _guestClient = guest;
      AppLifecycleListener(
        onResume: guest.auth.startAutoRefresh,
        onPause: guest.auth.stopAutoRefresh,
        onDetach: guest.auth.stopAutoRefresh,
      );
    }
    var awaitingCallback = false;
    final result = await Supabase.initialize(
      url: _url,
      publishableKey: _key,
      authOptions: FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
        localStorage: AccountSessionStorage('sb-$projectRef-lumibooth-account'),
        detectSessionInUriPredicate: (uri) {
          awaitingCallback =
              uri.scheme == 'com.lumibooth.app' &&
              uri.host == 'auth' &&
              uri.path == '/callback' &&
              (uri.queryParameters.containsKey('code') ||
                  uri.queryParameters.containsKey('error') ||
                  uri.queryParameters.containsKey('error_code') ||
                  uri.fragment.startsWith('error'));
          return awaitingCallback;
        },
      ),
    );
    _accountAuth = result.client.auth;
    result.client.auth.onAuthStateChange.listen(
      (state) {
        if (state.event == AuthChangeEvent.passwordRecovery) {
          awaitingCallback = false;
          accountLinkError.value = null;
          accountRecovery.value = true;
        } else if (state.event == AuthChangeEvent.signedIn) {
          awaitingCallback = false;
          accountLinkError.value = null;
        } else if (state.event == AuthChangeEvent.signedOut) {
          accountRecovery.value = false;
        }
      },
      onError: (Object error) {
        if (!awaitingCallback) return;
        awaitingCallback = false;
        accountLinkError.value =
            'This email link could not be opened. Request a new link.';
      },
    );
  }

  static Future<void> _restoreGuestSession() async {
    final projectRef = Uri.parse(_url).host.split('.').first;
    // Keep ownership of existing QR links and shared rooms across upgrades.
    final storage = SharedPreferencesLocalStorage(
      persistSessionKey: 'sb-$projectRef-auth-token',
    );
    await storage.initialize();
    final auth = _client.auth;
    final session = await storage.accessToken();
    if (session != null) {
      try {
        await auth.recoverSession(session);
      } on AuthRetryableFetchException {
        rethrow;
      } on AuthException {
        await storage.removePersistedSession();
      } on FormatException {
        await storage.removePersistedSession();
      }
    }
    auth.onAuthStateChange.listen((state) async {
      try {
        if (state.session != null) {
          await storage.persistSession(jsonEncode(state.session!.toJson()));
        } else if (state.event == AuthChangeEvent.signedOut) {
          await storage.removePersistedSession();
        }
      } catch (_) {
        debugPrint('LumiBooth could not save the online guest session.');
      }
    }, onError: (Object _) {});
  }

  static Uri publicLink(String page, String token) =>
      Uri.parse(_publicUrl.endsWith('/') ? _publicUrl : '$_publicUrl/')
          .resolve(page)
          .replace(fragment: token);

  static Future<dynamic> request(
    String action, [
    Map<String, Object?> payload = const {},
  ]) async {
    _guestReady ??= _restoreGuestSession();
    try {
      await _guestReady;
    } catch (_) {
      _guestReady = null;
      rethrow;
    }
    final auth = _client.auth;
    if (auth.currentSession == null) {
      _signIn ??= auth.signInAnonymously();
      try {
        await _signIn;
      } finally {
        _signIn = null;
      }
    }
    final session = auth.currentSession;
    if (session == null) {
      throw StateError('Could not start an online guest session.');
    }
    final response = await http
        .post(
          Uri.parse(
            '${_url.replaceFirst(RegExp(r'/$'), '')}/functions/v1/lumi',
          ),
          headers: {
            'apikey': _key,
            'Authorization': 'Bearer ${session.accessToken}',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'action': action, ...payload}),
        )
        .timeout(const Duration(seconds: 12));
    final data = jsonDecode(utf8.decode(response.bodyBytes));
    if (response.statusCode >= 400) {
      throw StateError(
        data is Map
            ? data['error']?.toString() ?? 'Online booth unavailable.'
            : 'Online booth unavailable.',
      );
    }
    return data;
  }

  static Future<void> upload(
    Map<String, dynamic> ticket,
    Uint8List bytes,
    String mime,
  ) async {
    final token = ticket['token'] as String?;
    if (token == null) return;
    try {
      await _client.storage
          .from('lumi-media')
          .uploadBinaryToSignedUrl(
            ticket['path'] as String,
            token,
            bytes,
            FileOptions(contentType: mime, cacheControl: '0'),
            1,
          )
          .timeout(const Duration(seconds: 30));
    } on StorageException catch (error) {
      if (error.statusCode != '409' && error.error != 'Duplicate') rethrow;
    }
  }

  static Future<Uint8List> download(String url) async {
    final response = await http
        .get(Uri.parse(url))
        .timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) {
      throw StateError('Could not load the photos. Try again.');
    }
    return response.bodyBytes;
  }

  static VoidCallback subscribe(String id, VoidCallback changed) {
    final channel = _client
        .channel(
          'lumi-room:$id',
          opts: const RealtimeChannelConfig(private: true),
        )
        .onBroadcast(event: 'room', callback: (_) => changed())
        .subscribe();
    return () => unawaited(_client.removeChannel(channel));
  }
}

typedef VoidCallback = void Function();
