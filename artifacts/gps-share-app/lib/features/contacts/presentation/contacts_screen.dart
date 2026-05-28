import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../application/contacts_controller.dart';
import '../data/contacts_repository.dart';

class ContactsScreen extends ConsumerWidget {
  const ContactsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accepted = ref.watch(acceptedContactsProvider);
    final invites = ref.watch(incomingInvitesProvider);
    final repo = ref.read(contactsRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Trusted contacts')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/contacts/add'),
        icon: const Icon(Icons.person_add),
        label: const Text('Add contact'),
      ),
      body: ListView(
        children: [
          if (invites.valueOrNull?.isNotEmpty ?? false) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Pending invites',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            ...invites.value!.map((inv) => ListTile(
                  leading: const Icon(Icons.mark_email_unread),
                  title: Text(inv.fromEmail),
                  trailing: Wrap(
                    spacing: 6,
                    children: [
                      OutlinedButton(
                        onPressed: () => repo.declineInvite(inv),
                        child: const Text('Decline'),
                      ),
                      FilledButton(
                        onPressed: () => repo.acceptInvite(inv),
                        child: const Text('Accept'),
                      ),
                    ],
                  ),
                )),
            const Divider(),
          ],
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text('Accepted contacts',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
          ...switch (accepted) {
            AsyncData(value: final list) when list.isEmpty => [
                const ListTile(
                  title: Text('No contacts yet.'),
                  subtitle: Text('Add someone by email to start sharing.'),
                ),
              ],
            AsyncData(value: final list) => list
                .map((c) => ListTile(
                      leading: const Icon(Icons.person_pin_circle),
                      title: Text(c.contactEmail),
                      onTap: () => context.push('/contacts/${c.contactUid}/map'),
                      trailing: IconButton(
                        icon: const Icon(Icons.remove_circle_outline),
                        onPressed: () => repo.remove(c.contactUid),
                      ),
                    ))
                .toList(),
            AsyncError(:final error) => [
                ListTile(title: Text('Error: $error')),
              ],
            _ => [
                const ListTile(title: LinearProgressIndicator()),
              ],
          },
        ],
      ),
    );
  }
}
