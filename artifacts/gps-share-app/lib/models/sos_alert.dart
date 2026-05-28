import 'package:cloud_firestore/cloud_firestore.dart';

class SosAlert {
  final String id;
  final String fromUid;
  final double lat;
  final double lng;
  final double accuracy;
  final List<String> notifiedContactUids;
  final DateTime? createdAt;

  const SosAlert({
    required this.id,
    required this.fromUid,
    required this.lat,
    required this.lng,
    required this.accuracy,
    required this.notifiedContactUids,
    required this.createdAt,
  });

  factory SosAlert.fromMap(String id, Map<String, dynamic> data) {
    return SosAlert(
      id: id,
      fromUid: data['fromUid'] as String,
      lat: (data['lat'] as num).toDouble(),
      lng: (data['lng'] as num).toDouble(),
      accuracy: (data['accuracy'] as num?)?.toDouble() ?? 0,
      notifiedContactUids:
          List<String>.from(data['notifiedContactUids'] as List? ?? []),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }
}
