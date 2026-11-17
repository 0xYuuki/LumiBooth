import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'booth.dart';

const feedbackEmail = String.fromEnvironment(
  'LUMIBOOTH_FEEDBACK_EMAIL',
  defaultValue: 'alfortearjay0@gmail.com',
);
String? validateFeedbackMessage(String? value) {
  final message = value?.trim() ?? '';
  if (message.length < 10) {
    return 'Please add at least 10 characters so we can understand your feedback.';
  }
  if (message.length > 3000) {
    return 'Keep your message within 3,000 characters.';
  }
  return null;
}

String? validateFeedbackEmail(String? value) {
  final email = value?.trim() ?? '';
  if (email.isEmpty) return null;
  if (email.length > 254 ||
      !RegExp(r'^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$').hasMatch(email)) {
    return 'Enter a valid email address, or leave this blank.';
  }
  return null;
}

String feedbackText(String type, String message, String contact) =>
    'Feedback type: $type\n\n${message.trim()}${contact.trim().isEmpty ? '' : '\n\nReply contact: ${contact.trim()}'}';
Uri feedbackUri(String type, String message, String contact) => Uri(
  scheme: 'mailto',
  path: feedbackEmail,
  query:
      {
            'subject': 'LumiBooth — $type',
            'body': feedbackText(type, message, contact),
          }.entries
          .map(
            (entry) =>
                '${Uri.encodeComponent(entry.key)}=${Uri.encodeComponent(entry.value)}',
          )
          .join('&'),
);
Future<bool> openFeedbackEmail(Uri uri) =>
    launchUrl(uri, mode: LaunchMode.externalApplication);

class FeedbackPage extends StatefulWidget {
  const FeedbackPage({super.key, this.openEmail = openFeedbackEmail});
  final Future<bool> Function(Uri) openEmail;
  @override
  State<FeedbackPage> createState() => _FeedbackPageState();
}

class _FeedbackPageState extends State<FeedbackPage> {
  final _form = GlobalKey<FormState>();
  final _message = TextEditingController(), _contact = TextEditingController();
  String _type = 'Suggestion';
  bool _busy = false, _dirty = false, _leaving = false, _asking = false;
  String? _status;
  void _changed() => setState(() {
    _dirty = true;
    _status = null;
  });
  Future<void> _leave() async {
    if (_busy || _asking) return;
    if (_dirty) {
      _asking = true;
      final discard = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Leave feedback?'),
          content: const Text(
            'Your message will not be kept in LumiBooth. Any draft already opened in your email app is separate.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Keep writing'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Leave'),
            ),
          ],
        ),
      );
      _asking = false;
      if (discard != true || !mounted) return;
    }
    setState(() => _leaving = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.of(context).pop();
    });
  }

  Future<void> _compose() async {
    if (_busy || !_form.currentState!.validate()) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      if (feedbackEmail.isEmpty ||
          validateFeedbackEmail(feedbackEmail) != null) {
        throw const FormatException('Feedback destination is unavailable.');
      }
      final opened = await widget.openEmail(
        feedbackUri(_type, _message.text, _contact.text),
      );
      if (mounted) {
        setState(
          () => _status = opened
              ? 'Your email app opened. Review and send the draft there. LumiBooth cannot confirm whether it was sent.'
              : 'No email app could be opened. Copy your feedback below and email it to $feedbackEmail.',
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _status =
              'Could not open your email app. Your message is still here. Copy it below and email it to $feedbackEmail.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _copy() async {
    if (!_form.currentState!.validate()) return;
    try {
      await Clipboard.setData(
        ClipboardData(
          text:
              'To: $feedbackEmail\nSubject: LumiBooth — $_type\n\n${feedbackText(_type, _message.text, _contact.text)}',
        ),
      );
      if (mounted) {
        setState(
          () => _status =
              'Feedback copied. Paste it into an email to $feedbackEmail. Nothing has been sent.',
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _status = 'Could not copy feedback. Your message is still here; please try again.',
        );
      }
    }
  }

  @override
  void dispose() {
    _message.dispose();
    _contact.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: _leaving || (!_dirty && !_busy),
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) _leave();
    },
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Feedback'),
        leading: IconButton(
          tooltip: 'Back',
          onPressed: _busy ? null : _leave,
          icon: const Icon(Icons.arrow_back),
        ),
      ),
      body: SafeArea(
        child: Form(
          key: _form,
          child: ListView(
            key: const ValueKey('feedback-controls'),
            padding: const EdgeInsets.all(20),
            children: [
              const Text(
                'Help shape LumiBooth.',
                style: TextStyle(
                  fontFamily: 'Playfair Display',
                  fontSize: 30,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Have an idea or found a problem? Tell us what happened and what you expected.',
                style: TextStyle(color: muted, height: 1.5),
              ),
              const SizedBox(height: 24),
              DropdownButtonFormField<String>(
                initialValue: _type,
                decoration: const InputDecoration(labelText: 'Feedback type'),
                items: const [
                  DropdownMenuItem(
                    value: 'Suggestion',
                    child: Text('Suggestion'),
                  ),
                  DropdownMenuItem(
                    value: 'Bug report',
                    child: Text('Bug report'),
                  ),
                ],
                onChanged: _busy
                    ? null
                    : (type) {
                        if (type != null) {
                          _type = type;
                          _changed();
                        }
                      },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _message,
                enabled: !_busy,
                minLines: 5,
                maxLines: 10,
                maxLength: 3000,
                decoration: const InputDecoration(
                  labelText: 'Message',
                  alignLabelWithHint: true,
                  hintText: 'Describe your idea or the steps that caused the problem.',
                ),
                validator: validateFeedbackMessage,
                onChanged: (_) => _changed(),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _contact,
                enabled: !_busy,
                keyboardType: TextInputType.emailAddress,
                maxLength: 254,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Reply email (optional)',
                  helperText: 'Leave blank if you do not need a reply.',
                ),
                validator: validateFeedbackEmail,
                onChanged: (_) => _changed(),
              ),
              const SizedBox(height: 16),
              const Text(
                'This opens an email draft with your feedback type, message and optional reply address. Photos, device logs and account details are not attached. Your email provider handles the message when you send it.',
                style: TextStyle(color: muted, fontSize: 13, height: 1.5),
              ),
              const SizedBox(height: 8),
              const SelectableText(
                'To: $feedbackEmail',
                style: TextStyle(color: muted, fontSize: 13),
              ),
              const SizedBox(height: 20),
              if (_status != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Semantics(
                    liveRegion: true,
                    child: Text(_status!, style: const TextStyle(height: 1.5)),
                  ),
                ),
              FilledButton.icon(
                onPressed: _busy ? null : _compose,
                icon: const Icon(Icons.mail_outline),
                label: Text(_busy ? 'Opening email…' : 'Open email draft'),
              ),
              TextButton.icon(
                onPressed: _busy ? null : _copy,
                icon: const Icon(Icons.copy_outlined, size: 18),
                label: const Text('Copy feedback instead'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
