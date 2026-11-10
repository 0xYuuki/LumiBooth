import 'package:flutter/material.dart';

import 'booth.dart';
import 'online_booth.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await OnlineBooth.initialize();
  } catch (_) {
    debugPrint('LumiBooth online services could not initialize.');
  }
  runApp(const LumiBooth());
}
