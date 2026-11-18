import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'cloud_backup.dart';
import 'cloud_backup_page.dart';
import 'online_booth.dart';

enum _AccountMode { login, signup, forgot }

class AccountPanel extends StatefulWidget {
  const AccountPanel({super.key, required this.auth});

  final GoTrueClient auth;

  @override
  State<AccountPanel> createState() => _AccountPanelState();
}

class _AccountPanelState extends State<AccountPanel> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  late final StreamSubscription<AuthState> _subscription;
  _AccountMode _mode = _AccountMode.login;
  bool _busy = false;
  String? _notice;
  String? _error;

  @override
  void initState() {
    super.initState();
    _subscription = widget.auth.onAuthStateChange.listen((_) {
      if (mounted) setState(() {});
    }, onError: (Object _) {});
    OnlineBooth.accountRecovery.addListener(_recoveryChanged);
    OnlineBooth.accountLinkError.addListener(_refresh);
  }

  void _refresh() => setState(() {});

  void _recoveryChanged() {
    _password.clear();
    _error = null;
    _refresh();
  }

  @override
  void dispose() {
    OnlineBooth.accountRecovery.removeListener(_recoveryChanged);
    OnlineBooth.accountLinkError.removeListener(_refresh);
    unawaited(_subscription.cancel());
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _choose(_AccountMode mode) {
    _password.clear();
    OnlineBooth.accountLinkError.value = null;
    setState(() {
      _mode = mode;
      _notice = null;
      _error = null;
    });
  }

  Future<void> _submit({required bool signedIn, required bool recovery}) async {
    if (_busy || (!signedIn && !_form.currentState!.validate())) return;
    OnlineBooth.accountLinkError.value = null;
    setState(() {
      _busy = true;
      _notice = null;
      _error = null;
    });
    final auth = widget.auth;
    final email = _email.text.trim();
    final password = _password.text;
    String? notice;
    try {
      if (recovery) {
        await auth.updateUser(UserAttributes(password: password));
        OnlineBooth.accountRecovery.value = false;
        notice = 'Your password has been updated.';
      } else if (signedIn) {
        await auth.signOut(scope: SignOutScope.local);
      } else {
        switch (_mode) {
          case _AccountMode.login:
            await auth.signInWithPassword(email: email, password: password);
          case _AccountMode.signup:
            final result = await auth.signUp(
              email: email,
              password: password,
              emailRedirectTo: OnlineBooth.accountRedirect,
            );
            if (result.session == null) {
              notice = 'Check your email for a confirmation link.';
            }
          case _AccountMode.forgot:
            await auth.resetPasswordForEmail(
              email,
              redirectTo: OnlineBooth.accountRedirect,
            );
            notice = 'If an account exists for that email, a reset link is on its way.';
        }
      }
      if (!mounted) return;
      _choose(_AccountMode.login);
      _notice = notice;
    } on AuthRetryableFetchException {
      if (mounted) _error = 'Could not reach the account service. Try again when you’re online.';
    } on AuthException catch (error) {
      if (mounted) _error = error.message;
    } catch (_) {
      if (mounted) _error = 'Could not reach the account service. Try again when you’re online.';
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.auth.currentUser;
    final recovery = OnlineBooth.accountRecovery.value && user != null;
    final signedIn = !recovery && user != null && !user.isAnonymous;
    final title = recovery
        ? 'Update password'
        : signedIn
        ? 'Sign out'
        : switch (_mode) {
            _AccountMode.login => 'Log in',
            _AccountMode.signup => 'Create an account',
            _AccountMode.forgot => 'Send reset link',
          };
    final error = _error ?? OnlineBooth.accountLinkError.value;

    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            signedIn
                ? user.email ?? 'Signed in'
                : recovery
                ? 'Choose a new password'
                : 'Guest',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          if (error != null) ...[
            const SizedBox(height: 8),
            Semantics(
              liveRegion: true,
              child: Text(
                error,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          ],
          if (_notice != null) ...[
            const SizedBox(height: 8),
            Semantics(liveRegion: true, child: Text(_notice!)),
          ],
          const SizedBox(height: 12),
          if (!signedIn && !recovery) ...[
            TextFormField(
              controller: _email,
              enabled: !_busy,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              validator: (value) =>
                  RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                      .hasMatch(value?.trim() ?? '')
                  ? null
                  : 'Enter a valid email address.',
            ),
            const SizedBox(height: 12),
          ],
          if (!signedIn && (recovery || _mode != _AccountMode.forgot)) ...[
            TextFormField(
              controller: _password,
              enabled: !_busy,
              decoration: InputDecoration(
                labelText: recovery ? 'New password' : 'Password',
              ),
              obscureText: true,
              autofillHints: [
                if (recovery || _mode == _AccountMode.signup)
                  AutofillHints.newPassword
                else
                  AutofillHints.password,
              ],
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Enter your password.';
                }
                if ((recovery || _mode == _AccountMode.signup) &&
                    value.length < 6) {
                  return 'Use at least 6 characters.';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
          ],
          FilledButton(
            onPressed: _busy
                ? null
                : () => _submit(signedIn: signedIn, recovery: recovery),
            child: Text(_busy ? 'Please wait…' : title),
          ),
          if (signedIn && CloudBackup.enabled)
            _BackupInvitation(
              key: ValueKey(user.id),
              owner: user.id,
              enabled: !_busy,
            ),
          if (!signedIn && !recovery)
            if (_mode == _AccountMode.login) ...[
              TextButton(
                onPressed: _busy ? null : () => _choose(_AccountMode.signup),
                child: const Text('Sign up'),
              ),
              TextButton(
                onPressed: _busy ? null : () => _choose(_AccountMode.forgot),
                child: const Text('Forgot password?'),
              ),
            ] else
              TextButton(
                onPressed: _busy ? null : () => _choose(_AccountMode.login),
                child: const Text('Back to log in'),
              ),
        ],
      ),
    );
  }
}

class _BackupInvitation extends StatefulWidget {
  const _BackupInvitation({
    super.key,
    required this.owner,
    required this.enabled,
  });

  final String owner;
  final bool enabled;

  @override
  State<_BackupInvitation> createState() => _BackupInvitationState();
}

class _BackupInvitationState extends State<_BackupInvitation> {
  final _preferences = SharedPreferencesAsync();
  late final _key = 'lumi-backup-invitation:${widget.owner}';
  late final _seen = _preferences.getBool(_key).catchError((Object _) => false);
  bool _dismissed = false;

  void _dismiss() {
    setState(() => _dismissed = true);
    unawaited(_preferences.setBool(_key, true).catchError((Object _) {}));
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool?>(
      future: _seen,
      builder: (context, snapshot) {
        if (_dismissed || snapshot.data == true) {
          return TextButton(
            onPressed: widget.enabled ? () => openCloudBackup(context) : null,
            child: const Text('Cloud backup'),
          );
        }
        if (snapshot.connectionState != ConnectionState.done) {
          return const SizedBox.shrink();
        }
        return Column(
          children: [
            const Text(
              'Would you like to back up strips from this device? You can choose what to upload.',
            ),
            TextButton(
              onPressed: widget.enabled
                  ? () {
                      _dismiss();
                      openCloudBackup(context);
                    }
                  : null,
              child: const Text('Back up my existing strips'),
            ),
            TextButton(
              onPressed: widget.enabled ? _dismiss : null,
              child: const Text('Not now'),
            ),
          ],
        );
      },
    );
  }
}
