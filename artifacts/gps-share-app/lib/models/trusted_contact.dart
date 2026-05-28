import 'package:cloud_firestore/cloud_firestore.dart';

class TrustedContact {
  final String contactUid;
  final String contactEmail;
  final DateTime? addedAt;

  const TrustedContact({
    required this.contactUid,
    required this.contactEmail,
    required this.addedAt,
  });

  factory TrustedContact.fromMap(Map<String, dynamic> data) {
    return TrustedContact(
      contactUid: data['contactUid'] as String,
      contactEmail: data['contactEmail'] as String? ?? '',
      addedAt: (data['addedAt'] as Timestamp?)?.toDate(),
    );
  }
}

class Invite {
  final String id;
  final String fromUid;
  final String fromEmail;
  final String status;
  final DateTime? createdAt;

  const Invite({
    required this.id,
    required this.fromUid,
    required this.fromEmail,
    required this.status,
    required this.createdAt,
  });

  factory Invite.fromMap(String id, Map<String, dynamic> data) {
    return Invite(
      id: id,
      fromUid: data['fromUid'] as String? ?? '',
      fromEmail: data['fromEmail'] as String? ?? '',
      status: data['status'] as String? ?? 'pending',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }
}
