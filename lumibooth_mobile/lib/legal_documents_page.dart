import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'cloud_backup.dart';
import 'online_booth.dart';

Uri? _publishedDocument(String value) {
  final uri = Uri.tryParse(value);
  return uri != null &&
          uri.scheme == 'https' &&
          uri.host.isNotEmpty &&
          uri.userInfo.isEmpty
      ? uri
      : null;
}

final _privacyUrl = _publishedDocument(
  const String.fromEnvironment('LUMI_PRIVACY_URL'),
);
final _termsUrl = _publishedDocument(
  const String.fromEnvironment('LUMI_TERMS_URL'),
);

void openPrivacyInformation(BuildContext context) {
  Navigator.of(
    context,
  ).push<void>(MaterialPageRoute(builder: (_) => const LegalDocumentsPage()));
}

class PrivacyInformationLink extends StatelessWidget {
  const PrivacyInformationLink({super.key});

  @override
  Widget build(BuildContext context) => TextButton(
    onPressed: () => openPrivacyInformation(context),
    child: const Text('Privacy information'),
  );
}

class LegalDocumentsPage extends StatelessWidget {
  const LegalDocumentsPage({super.key});

  Future<void> _open(BuildContext context, Uri url) async {
    try {
      if (await launchUrl(url, mode: LaunchMode.externalApplication)) return;
    } catch (_) {
      // Treat launcher errors the same as an unavailable browser.
    }
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Could not open this document. Try again.')),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Legal documents')),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        children: [
          Text(
            'Privacy information',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 12),
          const Text(
            'Regular capture, editing and export work as a guest. Drafts, '
            'saved strips and My Uploads are stored on this device. Clearing '
            'app data or uninstalling can remove them. Copies you save or share '
            'through your device stay where you send them.',
          ),
          if (OnlineBooth.accountAuth != null) ...[
            const SizedBox(height: 12),
            const Text(
              'An optional account uses your email for sign-in, confirmation '
              'and password recovery. Signing in keeps existing files on this '
              'device unless you choose to share or back them up.',
            ),
          ],
          if (CloudBackup.enabled) ...[
            const SizedBox(height: 12),
            const Text(
              'Private cloud backups contain only the strips or uploads you '
              'select and confirm. A saved strip backup can include source '
              'photos and editing files. Deleting a cloud backup keeps local '
              'copies, and deleting a local copy keeps its cloud backup.',
            ),
          ],
          if (OnlineBooth.printEnabled) ...[
            const SizedBox(height: 12),
            const Text(
              'QR galleries upload the selected photos, finished strip and any '
              'included GIF. Anyone with the code or link can download them. '
              'Links expire after 90 days and can be revoked sooner.',
            ),
          ],
          if (OnlineBooth.remoteEnabled) ...[
            const SizedBox(height: 12),
            const Text(
              'Booth with a friend uploads paired photos and the finished '
              'strip for the two participants. Room links expire after one hour.',
            ),
          ],
          const SizedBox(height: 12),
          if (_privacyUrl case final url?)
            ListTile(
              title: const Text('Privacy Policy'),
              trailing: const Icon(Icons.open_in_new),
              onTap: () => _open(context, url),
            ),
          if (_termsUrl case final url?)
            ListTile(
              title: const Text('Terms of Use'),
              trailing: const Icon(Icons.open_in_new),
              onTap: () => _open(context, url),
            ),
          ListTile(
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
