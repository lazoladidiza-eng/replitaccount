import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'location_service.dart';

final permissionServiceProvider = Provider<PermissionService>(
  (ref) => PermissionService(ref.read(locationServiceProvider)),
);

class PermissionService {
  final LocationService _location;
  PermissionService(this._location);

  /// Returns true iff the user ends up with location permission granted.
  /// Shows a rationale or settings dialog as needed.
  Future<bool> ensureLocationPermission(BuildContext context) async {
    final result = await _location.ensurePermission();
    switch (result) {
      case LocationPermissionResult.granted:
        return true;
      case LocationPermissionResult.denied:
        if (context.mounted) {
          await _show(
            context,
            title: 'Location access needed',
            body:
                'GPS Share only uses your location while you have sharing on. '
                'Your trusted contacts see it; nobody else does.',
          );
        }
        final retry = await _location.ensurePermission();
        return retry == LocationPermissionResult.granted;
      case LocationPermissionResult.deniedForever:
        if (context.mounted) {
          await _showOpenSettings(context);
        }
        return false;
      case LocationPermissionResult.serviceOff:
        if (context.mounted) {
          await _show(
            context,
            title: 'Turn on location services',
            body: 'Enable Location in your device settings, then try again.',
          );
        }
        return false;
    }
  }

  Future<void> _show(BuildContext context,
      {required String title, required String body}) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Future<void> _showOpenSettings(BuildContext context) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Permission blocked'),
        content: const Text(
          'Location permission was denied. Open settings to grant it.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              await _location.openAppSettings();
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Open settings'),
          ),
        ],
      ),
    );
  }
}
