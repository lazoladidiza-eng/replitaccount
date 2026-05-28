import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../services/consent_service.dart';

class ConsentScreen extends ConsumerStatefulWidget {
  const ConsentScreen({super.key});

  @override
  ConsumerState<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends ConsumerState<ConsentScreen> {
  bool _checked = false;
  bool _saving = false;

  Future<void> _accept() async {
    setState(() => _saving = true);
    await ref.read(consentServiceProvider).accept();
    if (!mounted) return;
    context.go('/map');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Your consent')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'GPS Share is a consent-based location sharing app.',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(height: 16),
            const Text('When you turn sharing on, the app:'),
            const SizedBox(height: 8),
            const _Bullet('Reads your GPS location only while sharing is on.'),
            const _Bullet(
              'Sends your latest position to your trusted contacts only.',
            ),
            const _Bullet('Stores a basic location history for you to review.'),
            const SizedBox(height: 16),
            const Text('We never:'),
            const SizedBox(height: 8),
            const _Bullet('Track you in stealth or without your action.'),
            const _Bullet(
              'Use IMEI, phone numbers, or carrier data to locate anyone.',
            ),
            const _Bullet(
              'Share your location with anyone other than contacts you accept.',
            ),
            const SizedBox(height: 16),
            const Text(
              'You can stop sharing at any time, revoke consent, or delete '
              'your data from Settings.',
            ),
            const Spacer(),
            CheckboxListTile(
              value: _checked,
              onChanged: (v) => setState(() => _checked = v ?? false),
              title: const Text(
                'I understand and agree to share my location on these terms.',
              ),
            ),
            FilledButton(
              onPressed: (_checked && !_saving) ? _accept : null,
              child: _saving
                  ? const CircularProgressIndicator()
                  : const Text('Continue'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  final String text;
  const _Bullet(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('  •  '),
            Expanded(child: Text(text)),
          ],
        ),
      );
}
