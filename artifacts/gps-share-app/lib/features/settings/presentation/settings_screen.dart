import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../services/consent_service.dart';
import '../../auth/application/auth_controller.dart';
import '../../map/application/sharing_controller.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = FirebaseAuth.instance.currentUser;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.person),
            title: Text(user?.email ?? 'Not signed in'),
            subtitle: Text(user?.displayName ?? ''),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.privacy_tip, color: Colors.orange),
            title: const Text('Revoke consent'),
            subtitle: const Text(
              'Stops sharing immediately and clears your live position.',
            ),
            onTap: () async {
              await ref.read(sharingControllerProvider.notifier).stop();
              await ref.read(consentServiceProvider).revoke();
              if (!context.mounted) return;
              context.go('/consent');
            },
          ),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Sign out'),
            onTap: () async {
              await ref.read(sharingControllerProvider.notifier).stop();
              await ref.read(authControllerProvider.notifier).signOut();
              if (!context.mounted) return;
              context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}
