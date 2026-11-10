import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

abstract final class OnlineBooth {
  static const _url = String.fromEnvironment('LUMI_SUPABASE_URL');
  static const _key = String.fromEnvironment('LUMI_SUPABASE_KEY');
  static const _publicUrl = String.fromEnvironment('LUMI_PUBLIC_URL');
  static const _print = bool.fromEnvironment('LUMI_PRINT_QR');
  static const _remote = bool.fromEnvironment('LUMI_REMOTE_BOOTH');
  static bool _initialized = false;
  static Future<AuthResponse>? _signIn;

  static bool get printEnabled => _initialized && _print;
  static bool get remoteEnabled => _initialized && _remote;
  static SupabaseClient get _client => Supabase.instance.client;

  static Future<void> initialize() async {
    if (_url.isEmpty ||
        _key.isEmpty ||
        _publicUrl.isEmpty ||
        (!_print && !_remote)) {
      return;
    }
    await Supabase.initialize(
      url: _url,
      publishableKey: _key,
      authOptions: const FlutterAuthClientOptions(detectSessionInUri: false),
    );
    _initialized = true;
  }

  static Uri publicLink(String page, String token) =>
      Uri.parse(_publicUrl.endsWith('/') ? _publicUrl : '$_publicUrl/')
          .resolve(page)
          .replace(fragment: token);

  static Future<dynamic> request(
    String action, [
    Map<String, Object?> payload = const {},
  ]) async {
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
