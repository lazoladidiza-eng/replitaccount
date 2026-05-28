import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/history_repository.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(myHistoryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My location history')),
      body: history.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('No history yet.'));
          }
          return ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final h = items[i];
              return ListTile(
                leading: const Icon(Icons.place),
                title: Text(
                  '${h.lat.toStringAsFixed(5)}, ${h.lng.toStringAsFixed(5)}',
                ),
                subtitle: Text(
                  '${h.recordedAt.toLocal()} (±${h.accuracy.toStringAsFixed(0)} m)',
                ),
              );
            },
          );
        },
      ),
    );
  }
}
