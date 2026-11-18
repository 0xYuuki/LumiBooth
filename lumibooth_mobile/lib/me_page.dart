import 'package:flutter/material.dart';

import 'account_panel.dart';
import 'booth.dart';
import 'navigation.dart';
import 'my_uploads_page.dart';
import 'online_booth.dart';
import 'settings_page.dart';

/// Simple guest account entry and practical app information.
class MePage extends StatelessWidget {
  const MePage({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = OnlineBooth.accountAuth;
    return Scaffold(
      backgroundColor: paper,
      appBar: BoothHeader(
        step: 'ME',
        trailing: IconButton(
          tooltip: 'Settings',
          icon: const Icon(Icons.settings_outlined),
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const BoothSettingsPage()),
          ),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          children: [
            if (auth != null)
              AccountPanel(auth: auth)
            else
              const ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.person_outline, color: purple),
                title: Text('Guest'),
                subtitle: Text('Accounts are currently unavailable.'),
              ),
            const SizedBox(height: 30),
            _MeTile(
              icon: Icons.photo_library_outlined,
              title: 'Your works',
              onTap: () => MainNavigationScaffold.of(context)?.showWorks(),
            ),
            const Divider(height: 1, color: line),
            _MeTile(
              icon: Icons.collections_outlined,
              title: 'My Uploads',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const MyUploadsPage()),
              ),
            ),
            const Divider(height: 1, color: line),
            _MeTile(
              icon: Icons.description_outlined,
              title: 'Legal documents',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const LegalDocumentsPage(),
                ),
              ),
            ),
            const Divider(height: 1, color: line),
            _MeTile(
              icon: Icons.cleaning_services_outlined,
              title: 'Clear cache',
              onTap: () => confirmClearImageCache(context),
            ),
            const Divider(height: 1, color: line),
            _MeTile(
              icon: Icons.info_outline,
              title: 'About LumiBooth',
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
}

class _MeTile extends StatelessWidget {
  const _MeTile({required this.icon, required this.title, required this.onTap});

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 2),
      leading: Icon(icon, color: purple),
      title: Text(
        title,
        style: const TextStyle(
          fontFamily: 'Outfit',
          color: ink,
          fontWeight: FontWeight.w600,
        ),
      ),
      trailing: const Icon(Icons.chevron_right, color: muted),
      onTap: onTap,
    );
  }
}
