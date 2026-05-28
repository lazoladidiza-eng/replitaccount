import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/trusted_contact.dart';
import '../data/contacts_repository.dart';

final acceptedContactsProvider = StreamProvider<List<TrustedContact>>((ref) {
  return ref.watch(contactsRepositoryProvider).watchAccepted();
});

final incomingInvitesProvider = StreamProvider<List<Invite>>((ref) {
  return ref.watch(contactsRepositoryProvider).watchIncomingInvites();
});
