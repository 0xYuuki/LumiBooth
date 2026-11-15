import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';

class UnavailableDraftDirectory extends PathProviderPlatform {
  @override
  Future<String?> getApplicationSupportPath() async =>
      throw UnsupportedError('No device storage in this widget test');
}

void useUnavailableDraftStorage() {
  PathProviderPlatform.instance = UnavailableDraftDirectory();
}

Future<void> disposeBooth(WidgetTester tester) =>
    tester.pumpWidget(const SizedBox.shrink());
