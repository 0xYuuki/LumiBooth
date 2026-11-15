import 'package:flutter/material.dart';

import 'booth.dart';
import 'online_booth.dart';

/// Settings screen for LumiBooth mobile.
///
/// Provides lightweight navigation to implemented features (gallery links,
/// cache controls) and honest deferrals for future cloud/account features
/// without deceptive paywalls or fake premium tiers.
class SettingsPage extends StatelessWidget {
  /// Creates the [SettingsPage].
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: paper,
      appBar: BoothHeader(
        step: 'SETTINGS',
        onBack: () => Navigator.of(context).pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          children: const [
            _CameraSettingsSection(),
            SizedBox(height: 20),
            _StorageSettingsSection(),
            SizedBox(height: 20),
            _OnlineSettingsSection(),
            SizedBox(height: 20),
            _DeferredSettingsSection(),
            SizedBox(height: 20),
            _AboutSettingsSection(),
            SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

/// Camera framing, delay timer, and motion photo preferences.
class _CameraSettingsSection extends StatelessWidget {
  const _CameraSettingsSection();

  @override
  Widget build(BuildContext context) {
    return _SettingsSection(
      title: 'CAMERA & CAPTURE',
      children: [
        _SettingsTile(
          icon: Icons.aspect_ratio_outlined,
          title: 'Camera Framing',
          subtitle: 'Fixed 4:3 ratio auto-cropped to frame openings',
          onTap: (ctx) => _SettingsDialogs.showInfo(
            ctx,
            title: 'Fixed 4:3 Camera Framing',
            message:
                'LumiBooth uses a fixed 4:3 aspect ratio stream across all devices. '
                'When you pick a frame, your photos are automatically cropped to fill '
                'each slot without distortion, matching classic physical booths.',
          ),
        ),
        _SettingsTile(
          icon: Icons.timer_outlined,
          title: 'Shutter Timer',
          subtitle: 'Off, 3s, 5s, or 10s countdown delay',
          onTap: (ctx) => _SettingsDialogs.showInfo(
            ctx,
            title: 'Shutter Countdown Timer',
            message:
                'Tap the timer icon on the capture screen to cycle through Off, 3s, 5s, '
                'and 10s delays. The countdown gives you time to pose before each shutter.',
          ),
        ),
        _SettingsTile(
          icon: Icons.motion_photos_on_outlined,
          title: 'Motion Photos',
          subtitle: 'Up to 5s pre-shutter motion for animated GIFs',
          onTap: (ctx) => _SettingsDialogs.showInfo(
            ctx,
            title: 'Motion Photos & Animated GIFs',
            message:
                'LumiBooth maintains a silent rolling 5-second video buffer before each shutter. '
                'After shooting, you can preview motion in the frame and export animated GIFs.',
          ),
        ),
      ],
    );
  }
}

/// Cache clearing and in-memory session lifetime controls.
class _StorageSettingsSection extends StatelessWidget {
  const _StorageSettingsSection();

  void _clearImageCache(BuildContext context) {
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Image memory cache cleared.'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _SettingsSection(
      title: 'STORAGE & MEMORY',
      children: [
        const _SettingsTile(
          icon: Icons.hourglass_empty_outlined,
          title: 'Session Lifetime',
          subtitle: 'Photos clear after 5m idle or ending session',
        ),
        _SettingsTile(
          icon: Icons.cleaning_services_outlined,
          title: 'Clear Image Cache',
          subtitle: 'Evict in-memory preview textures',
          onTap: _clearImageCache,
        ),
      ],
    );
  }
}

/// Supabase online backend configuration and gallery links.
class _OnlineSettingsSection extends StatelessWidget {
  const _OnlineSettingsSection();

  @override
  Widget build(BuildContext context) {
    return _SettingsSection(
      title: 'ONLINE & SHARING',
      children: [
        _SettingsTile(
          icon: Icons.cloud_outlined,
          title: 'Online Services',
          subtitle: OnlineBooth.isConfigured
              ? 'Supabase backend configured'
              : 'Local standalone mode (backend optional)',
          trailing: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: OnlineBooth.isConfigured
                  ? const Color(0xff2e7d32)
                  : muted.withValues(alpha: 0.5),
            ),
          ),
        ),
        _SettingsTile(
          icon: Icons.qr_code_outlined,
          title: 'Manage Gallery Links',
          subtitle: 'View and revoke uploaded web strips',
          onTap: (ctx) => Navigator.of(ctx).push(
            MaterialPageRoute<void>(
              builder: (_) => const PrintLinksPage(),
            ),
          ),
        ),
      ],
    );
  }
}

/// Honest deferrals explaining future cloud sync without fake paywalls.
class _DeferredSettingsSection extends StatelessWidget {
  const _DeferredSettingsSection();

  @override
  Widget build(BuildContext context) {
    return _SettingsSection(
      title: 'ACCOUNT & CLOUD (DEFERRED)',
      children: [
        _SettingsTile(
          icon: Icons.cloud_sync_outlined,
          title: 'Cloud Sync & Accounts',
          subtitle: 'Deferred • 100% private guest mode today',
          badge: 'Planned',
          onTap: (ctx) => _SettingsDialogs.showInfo(
            ctx,
            title: 'No Login Required',
            message:
                'LumiBooth is built local-first for guests. All photo booth features, '
                'frames, stickers, and exports work without an account. Cloud account sync '
                'is deferred to a future release—no fake paywalls or subscriptions.',
          ),
        ),
        _SettingsTile(
          icon: Icons.branding_watermark_outlined,
          title: 'Custom Studio Watermarks',
          subtitle: 'Deferred • Built-in frames fully unlocked',
          badge: 'Planned',
          onTap: (ctx) => _SettingsDialogs.showInfo(
            ctx,
            title: 'All Frames Unlocked',
            message:
                'Custom brand watermarks are deferred for a future update. '
                'All 19 illustrated frames and sticker packs are 100% free and unlocked '
                'for every guest.',
          ),
        ),
      ],
    );
  }
}

/// Version info, repository link, and open source licenses.
class _AboutSettingsSection extends StatelessWidget {
  const _AboutSettingsSection();

  @override
  Widget build(BuildContext context) {
    return _SettingsSection(
      title: 'ABOUT LUMIBOOTH',
      children: [
        const _SettingsTile(
          icon: Icons.info_outline,
          title: 'LumiBooth Mobile',
          subtitle: 'Version 0.1.0 (Build 1)',
        ),
        const _SettingsTile(
          icon: Icons.code_outlined,
          title: 'Open Source',
          subtitle: 'github.com/0xYuuki/LumiBooth',
        ),
        _SettingsTile(
          icon: Icons.description_outlined,
          title: 'Third-party Licenses',
          subtitle: 'View legal notices and open-source licenses',
          onTap: (ctx) => showLicensePage(
            context: ctx,
            applicationName: 'LumiBooth',
            applicationVersion: '0.1.0',
          ),
        ),
      ],
    );
  }
}

/// Reusable section card grouping settings tiles.
class _SettingsSection extends StatelessWidget {
  const _SettingsSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title,
            style: const TextStyle(
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
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) const Divider(height: 1, thickness: 1, color: line),
                children[i],
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Standardized settings tile row.
class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.badge,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? badge;
  final Widget? trailing;
  final void Function(BuildContext context)? onTap;

  @override
  Widget build(BuildContext context) {
    final interactive = onTap != null;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: interactive ? () => onTap!(context) : null,
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
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            style: const TextStyle(
                              fontFamily: 'Outfit',
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                              color: ink,
                            ),
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: wash,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: purple.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Text(
                              badge!,
                              style: const TextStyle(
                                fontFamily: 'Outfit',
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: purple,
                              ),
                            ),
                          ),
                        ],
                      ],
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
              if (trailing != null) ...[
                const SizedBox(width: 8),
                trailing!,
              ] else if (interactive) ...[
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right, size: 20, color: muted),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Dialog helpers for settings descriptions.
class _SettingsDialogs {
  static void showInfo(
    BuildContext context, {
    required String title,
    required String message,
  }) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: line),
        ),
        title: Text(
          title,
          style: const TextStyle(
            fontFamily: 'Outfit',
            fontWeight: FontWeight.w700,
            fontSize: 18,
            color: ink,
          ),
        ),
        content: Text(
          message,
          style: const TextStyle(
            fontFamily: 'Outfit',
            fontSize: 14,
            height: 1.45,
            color: muted,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }
}
