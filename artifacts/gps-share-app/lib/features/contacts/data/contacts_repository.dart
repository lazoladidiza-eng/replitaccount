import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/trusted_contact.dart';

final contactsRepositoryProvider =
    Provider<ContactsRepository>((_) => ContactsRepository());

class ContactsRepository {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  String get _uid => FirebaseAuth.instance.currentUser!.uid;
  String get _email => FirebaseAuth.instance.currentUser!.email ?? '';

  Stream<List<TrustedContact>> watchAccepted() {
    return _db
        .collection('users/$_uid/contacts')
        .snapshots()
        .map((s) => s.docs.map((d) => TrustedContact.fromMap(d.data())).toList());
  }

  Stream<List<Invite>> watchIncomingInvites() {
    return _db
        .collection('users/$_uid/invitesIncoming')
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .map((s) => s.docs.map((d) => Invite.fromMap(d.id, d.data())).toList());
  }

  /// Sends an invite to `email`. The recipient must accept before we add them
  /// as a contact; we never write anything under another user without an
  /// accept step.
  Future<void> sendInvite(String email) async {
    final key = email.trim().toLowerCase();
    final idx = await _db.doc('userEmailIndex/$key').get();
    if (!idx.exists) {
      throw StateError('No user with that email');
    }
    final toUid = idx.data()!['uid'] as String;
    if (toUid == _uid) {
      throw StateError("You can't invite yourself");
    }

    final batch = _db.batch();
    final inviteId = _db.collection('users/$toUid/invitesIncoming').doc().id;

    batch.set(_db.doc('users/$toUid/invitesIncoming/$inviteId'), {
      'fromUid': _uid,
      'fromEmail': _email,
      'status': 'pending',
      'createdAt': FieldValue.serverTimestamp(),
    });
    batch.set(_db.doc('users/$_uid/invitesOutgoing/$inviteId'), {
      'toUid': toUid,
      'toEmail': email.trim(),
      'status': 'pending',
      'createdAt': FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }

  /// Accepting adds *both* sides as contacts of each other, so each can see
  /// the other's live position (symmetrical trust).
  Future<void> acceptInvite(Invite invite) async {
    final batch = _db.batch();
    batch.update(_db.doc('users/$_uid/invitesIncoming/${invite.id}'), {
      'status': 'accepted',
    });
    batch.set(_db.doc('users/$_uid/contacts/${invite.fromUid}'), {
      'contactUid': invite.fromUid,
      'contactEmail': invite.fromEmail,
      'addedAt': FieldValue.serverTimestamp(),
    });
    batch.set(_db.doc('users/${invite.fromUid}/contacts/$_uid'), {
      'contactUid': _uid,
      'contactEmail': _email,
      'addedAt': FieldValue.serverTimestamp(),
    });
    await batch.commit();
  }

  Future<void> declineInvite(Invite invite) {
    return _db.doc('users/$_uid/invitesIncoming/${invite.id}').update({
      'status': 'declined',
    });
  }

  Future<void> remove(String contactUid) async {
    final batch = _db.batch();
    batch.delete(_db.doc('users/$_uid/contacts/$contactUid'));
    batch.delete(_db.doc('users/$contactUid/contacts/$_uid'));
    await batch.commit();
  }
}
