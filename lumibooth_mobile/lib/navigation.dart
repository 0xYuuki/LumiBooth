import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemNavigator;

import 'booth.dart';
import 'me_page.dart';

/// Root navigation scaffold for LumiBooth mobile.
///
/// Implements a bottom navigation bar with two primary destinations:
/// - **Photo**: Instant access to camera capture, layout selection, and strip editing.
/// - **Me**: Minimal guest profile, session info, and Settings action.
///
/// Uses [IndexedStack] with nested [Navigator]s to preserve active camera
/// and editing state across tab switches.
class MainNavigationScaffold extends StatefulWidget {
  /// Creates the [MainNavigationScaffold].
  const MainNavigationScaffold({super.key});

  /// Allows descendant widgets to switch tabs programmatically.
  static MainNavigationScaffoldState? of(BuildContext context) =>
      context.findAncestorStateOfType<MainNavigationScaffoldState>();

  @override
  State<MainNavigationScaffold> createState() => MainNavigationScaffoldState();
}

/// State managing the active tab index and nested navigators.
class MainNavigationScaffoldState extends State<MainNavigationScaffold> {
  int _currentIndex = 0;
  final GlobalKey<NavigatorState> _photoNavKey = GlobalKey<NavigatorState>();
  final GlobalKey<NavigatorState> _meNavKey = GlobalKey<NavigatorState>();

  /// Selects the navigation tab at [index].
  void selectTab(int index) {
    if (_currentIndex == index) return;
    setState(() => _currentIndex = index);
  }

  Future<void> _handlePop(bool didPop) async {
    if (didPop) return;

    if (_currentIndex == 1) {
      final meState = _meNavKey.currentState;
      if (meState != null && meState.canPop()) {
        meState.pop();
        return;
      }
      selectTab(0);
      return;
    }

    final photoState = _photoNavKey.currentState;
    if (photoState != null && photoState.canPop()) {
      await photoState.maybePop();
      return;
    }

    if (mounted) {
      await SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) => _handlePop(didPop),
      child: Scaffold(
        backgroundColor: paper,
        body: IndexedStack(
          index: _currentIndex,
          children: [
            Navigator(
              key: _photoNavKey,
              onGenerateRoute: (settings) => MaterialPageRoute<void>(
                settings: settings,
                builder: (_) => const WelcomePage(),
              ),
            ),
            Navigator(
              key: _meNavKey,
              onGenerateRoute: (settings) => MaterialPageRoute<void>(
                settings: settings,
                builder: (_) => MePage(
                  onStartPhotoBooth: () => selectTab(0),
                ),
              ),
            ),
          ],
        ),
        bottomNavigationBar: LumiBoothBottomBar(
          currentIndex: _currentIndex,
          onTap: selectTab,
        ),
      ),
    );
  }
}

/// Accessible, safe-area aware bottom navigation bar.
class LumiBoothBottomBar extends StatelessWidget {
  /// Creates the bottom navigation bar.
  const LumiBoothBottomBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  /// The active tab index (0 for Photo, 1 for Me).
  final int currentIndex;

  /// Callback when a tab is tapped.
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: paper,
        border: Border(top: BorderSide(color: line, width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              Expanded(
                child: _BottomBarItem(
                  icon: Icons.photo_camera_outlined,
                  activeIcon: Icons.photo_camera,
                  label: 'Photo',
                  tooltip: 'Photo booth capture and editing',
                  selected: currentIndex == 0,
                  onTap: () => onTap(0),
                ),
              ),
              Expanded(
                child: _BottomBarItem(
                  icon: Icons.person_outline,
                  activeIcon: Icons.person,
                  label: 'Me',
                  tooltip: 'Guest profile and settings',
                  selected: currentIndex == 1,
                  onTap: () => onTap(1),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Single tab item within the bottom navigation bar.
class _BottomBarItem extends StatelessWidget {
  const _BottomBarItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.tooltip,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String tooltip;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? purple : muted;
    return Semantics(
      button: true,
      selected: selected,
      label: '$label tab',
      tooltip: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkResponse(
          onTap: onTap,
          containedInkWell: true,
          highlightShape: BoxShape.rectangle,
          splashColor: purple.withValues(alpha: 0.12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
                decoration: BoxDecoration(
                  color: selected ? wash : Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  selected ? activeIcon : icon,
                  size: 24,
                  color: color,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontFamily: 'Outfit',
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: color,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
