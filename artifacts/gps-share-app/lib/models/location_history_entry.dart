import 'package:cloud_firestore/cloud_firestore.dart';

class LocationHistoryEntry {
  final String id;
  final double lat;
  final double lng;
  final double accuracy;
  final DateTime recordedAt;

  const LocationHistoryEntry({
    required this.id,
    required this.lat,
    required this.lng,
    required this.accuracy,
    required this.recordedAt,
  });

  factory LocationHistoryEntry.fromMap(String id, Map<String, dynamic> data) {
    return LocationHistoryEntry(
      id: id,
      lat: (data['lat'] as num).toDouble(),
      lng: (data['lng'] as num).toDouble(),
      accuracy: (data['accuracy'] as num?)?.toDouble() ?? 0,
      recordedAt:
          (data['recordedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }
}
