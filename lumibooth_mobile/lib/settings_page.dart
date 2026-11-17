import 'package:flutter/material.dart';

import 'booth.dart';
import 'feedback_page.dart';

/// Clears only transient Flutter image decoding/rendering caches.
Future<void> confirmClearImageCache(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Clear image cache?'),
      content: const Text(
        'This removes temporary image previews from memory. '
        'Your saved photos and strips will not be deleted.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: const Text('Clear'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;
  PaintingBinding.instance.imageCache.clear();
  PaintingBinding.instance.imageCache.clearLiveImages();
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Temporary image cache cleared')),
  );
}

/// Legal information currently available inside the app.
///
/// Formal Privacy Policy and Terms documents are not shipped by this build;
/// do not present an explanatory notice as a published legal agreement.
class LegalDocumentsPage extends StatelessWidget {
  const LegalDocumentsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: paper,
      appBar: AppBar(title: const Text('Legal documents')),
      body: SafeArea(
        child: ListView(
          children: [
            ListTile(
              leading: const Icon(Icons.privacy_tip_outlined, color: purple),
              title: const Text('Privacy information'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => showDialog<void>(
                context: context,
                builder: (dialogContext) => AlertDialog(
                  title: const Text('Privacy information'),
                  content: const Text(
                    'Standard photo booth images are processed on your device '
                    'unless you choose to upload or share them. '
                    'Remote Booth uploads photos for the shared session. '
                    'This notice is not a formal Privacy Policy.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(dialogContext).pop(),
                      child: const Text('Close'),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: 1, color: line),
            ListTile(
              leading: const Icon(Icons.article_outlined, color: purple),
              title: const Text('Open-source licenses'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => showLicensePage(
                context: context,
                applicationName: 'LumiBooth',
                applicationVersion: '0.1.0',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Minimal app information with a usable feedback destination.
class AboutLumiBoothPage extends StatelessWidget {
  const AboutLumiBoothPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: paper,
      appBar: AppBar(title: const Text('About LumiBooth')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 20),
          children: [
            const Center(
              child: Column(
                children: [
                  Icon(Icons.photo_camera_outlined, color: purple, size: 44),
                  SizedBox(height: 12),
                  Text(
                    'LumiBooth',
                    style: TextStyle(
                      fontFamily: 'Playfair Display',
                      color: ink,
                      fontSize: 26,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Version 0.1.0 (Build 1)',
                    style: TextStyle(color: muted, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Divider(height: 1, color: line),
            ListTile(
              leading: const Icon(Icons.feedback_outlined, color: purple),
              title: const Text('Send feedback'),
              trailing: const Icon(Icons.chevron_right, color: muted),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const FeedbackPage()),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BoothSettingsPage extends StatelessWidget {
  const BoothSettingsPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Settings')),
    body: SafeArea(
      child: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.feedback_outlined, color: purple),
            title: const Text('Feedback'),
            subtitle: const Text('Share an idea or report a problem'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const FeedbackPage()),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.description_outlined, color: purple),
            title: const Text('Legal documents'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const LegalDocumentsPage(),
              ),
            ),
          ),
          ListTile(
            leading: const Icon(
              Icons.cleaning_services_outlined,
              color: purple,
            ),
            title: const Text('Clear cache'),
            onTap: () => confirmClearImageCache(context),
          ),
          ListTile(
            leading: const Icon(Icons.info_outline, color: purple),
            title: const Text('About LumiBooth'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const AboutLumiBoothPage(),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
