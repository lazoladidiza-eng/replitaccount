import 'package:cloud_firestore/cloud_firestore.dart';

class AppUser {
  final String uid;
  final String email;
  final String displayName;
  final bool consentAccepted;
  final DateTime? consentAcceptedAt;
  final String consentVersion;
  final bool isSharing;
  final DateTime? createdAt;

  const AppUser({
    required this.uid,
    required this.email,
    required this.displayName,
    required this.consentAccepted,
    required this.consentAcceptedAt,
    required this.consentVersion,
    required this.isSharing,
    required this.createdAt,
  });

  factory AppUser.fromMap(String uid, Map<String, dynamic> data) {
    final consent = (data['consent'] as Map<String, dynamic>?) ?? const {};
    return AppUser(
      uid: uid,
      email: data['email'] as String? ?? '',
      displayName: data['displayName'] as String? ?? '',
      consentAccepted: consent['accepted'] as bool? ?? false,
      consentAcceptedAt: (consent['acceptedAt'] as Timestamp?)?.toDate(),
      consentVersion: consent['version'] as String? ?? '1.0',
      isSharing: data['isSharing'] as bool? ?? false,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toCreateMap() => {
        'email': email,
        'displayName': displayName,
        'consent': {
          'accepted': false,
          'version': '1.0',
        },
        'isSharing': false,
        'createdAt': FieldValue.serverTimestamp(),
      };
}
