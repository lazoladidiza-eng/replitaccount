import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/permission_service.dart';
import '../data/sos_repository.dart';

class SosButton extends ConsumerStatefulWidget {
  const SosButton({super.key});

  @override
  ConsumerState<SosButton> createState() => _SosButtonState();
}

class _SosButtonState extends ConsumerState<SosButton> {
  bool _busy = false;

  Future<void> _confirmAndSend() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send SOS?'),
        content: const Text(
          'This sends your current coordinates to every accepted contact.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Send SOS'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;

    final granted = await ref
        .read(permissionServiceProvider)
        .ensureLocationPermission(context);
    if (!granted) return;

    setState(() => _busy = true);
    try {
      await ref.read(sosRepositoryProvider).trigger();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SOS sent.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('SOS failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.large(
      heroTag: 'sos',
      backgroundColor: Colors.red,
      foregroundColor: Colors.white,
      onPressed: _busy ? null : _confirmAndSend,
      child: _busy
          ? const CircularProgressIndicator(color: Colors.white)
          : const Text('SOS', style: TextStyle(fontWeight: FontWeight.bold)),
    );
  }
}
