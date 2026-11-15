import 'package:flutter/material.dart';

import 'booth.dart';
import 'settings_page.dart';

/// Minimal guest profile and account view for LumiBooth.
///
/// Features a guest profile card, quick access to photo booth actions,
/// local privacy information, and a Settings action in the top right.
class MePage extends StatelessWidget {
  /// Creates the [MePage].
  ///
  /// [onStartPhotoBooth] is invoked when the guest taps the primary
  /// photo booth shortcut, switching to the Photo tab.
  const MePage({super.key, this.onStartPhotoBooth});

  /// Callback to switch to the Photo navigation tab.
  final VoidCallback? onStartPhotoBooth;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: paper,
      appBar: BoothHeader(
        step: 'ME',
        trailing: IconButton(
          icon: const Icon(Icons.settings_outlined, color: ink),
          tooltip: 'Settings',
          onPressed: () => Navigator.of(
            context,
          ).push(MaterialPageRoute<void>(builder: (_) => const SettingsPage())),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          children: [
            const _GuestProfileHeader(),
            const SizedBox(height: 24),
            _QuickActionsSection(onStartPhotoBooth: onStartPhotoBooth),
            const SizedBox(height: 24),
            const _PrivacyInfoCard(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

/// Header displaying the guest avatar, title, and local session badge.
class _GuestProfileHeader extends StatelessWidget {
  const _GuestProfileHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: line),
      ),
      child: Column(
        children: [
          Container(
            width: 76,
            height: 76,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: purple.withValues(alpha: 0.2),
                width: 2,
              ),
            ),
            child: Container(
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: wash,
              ),
              child: const Icon(Icons.person_outline, size: 40, color: purple),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Guest User',
            style: TextStyle(
              fontFamily: 'Playfair Display',
              fontSize: 24,
              fontWeight: FontWeight.w600,
              color: ink,
            ),
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: wash,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: purple.withValues(alpha: 0.2)),
            ),
            child: const Text(
              'Local Session • No Account Needed',
              style: TextStyle(
                fontFamily: 'Outfit',
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: purple,
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'LumiBooth is 100% private and local-first by default. '
            'Your photos and strips remain on your device, and selected '
            'strips only leave your device when you choose to upload or share them.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Outfit',
              fontSize: 13,
              height: 1.4,
              color: muted,
            ),
          ),
        ],
      ),
    );
  }
}

/// Action list offering one-tap access to primary photo booth flows.
class _QuickActionsSection extends StatelessWidget {
  const _QuickActionsSection({this.onStartPhotoBooth});

  final VoidCallback? onStartPhotoBooth;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'PHOTO BOOTH ACTIONS',
            style: TextStyle(
              fontFamily: 'Outfit',
              fontWeight: FontWeight.w700,
              fontSize: 11,
              letterSpacing: 1.5,
              color: purple,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: line),
          ),
          child: Column(
            children: [
              _ActionTile(
                icon: Icons.photo_camera_outlined,
                title: 'Start Photo Booth',
                subtitle: 'Pick a layout and capture photos',
                onTap: onStartPhotoBooth,
              ),
              const Divider(height: 1, thickness: 1, color: line),
              _ActionTile(
                icon: Icons.qr_code_outlined,
                title: 'Manage Gallery Links',
                subtitle: 'View or revoke active web QR links',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const PrintLinksPage(),
                  ),
                ),
              ),
              const Divider(height: 1, thickness: 1, color: line),
              _ActionTile(
                icon: Icons.settings_outlined,
                title: 'Settings & Preferences',
                subtitle: 'Camera framing, timers, and app details',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const SettingsPage()),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Reusable action row within the actions section.
class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 22, color: purple),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontFamily: 'Outfit',
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 13,
                        color: muted,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, size: 20, color: muted),
            ],
          ),
        ),
      ),
    );
  }
}

/// Information card detailing guest data handling and in-memory lifecycle.
class _PrivacyInfoCard extends StatelessWidget {
  const _PrivacyInfoCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: wash,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: purple.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Row(
            children: [
              Icon(Icons.shield_outlined, size: 20, color: purple),
              SizedBox(width: 8),
              Text(
                'Privacy by Design',
                style: TextStyle(
                  fontFamily: 'Outfit',
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: purple,
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Text(
            '• Unsaved camera captures stay in memory and are discarded after 5 minutes of inactivity.\n'
            '• Strip renders export directly to your device by default (leaving your device only when you choose to upload or share a web gallery link).\n'
            '• No credentials, ads, or tracking cookies.',
            style: TextStyle(
              fontFamily: 'Outfit',
              fontSize: 12,
              height: 1.5,
              color: ink,
            ),
          ),
        ],
      ),
    );
  }
}
