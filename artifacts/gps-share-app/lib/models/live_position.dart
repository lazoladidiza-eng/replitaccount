import 'package:cloud_firestore/cloud_firestore.dart';

class LivePosition {
  final double lat;
  final double lng;
  final double accuracy;
  final double? heading;
  final double? speed;
  final DateTime updatedAt;
  final String sharingSessionId;

  const LivePosition({
    required this.lat,
    required this.lng,
    required this.accuracy,
    required this.updatedAt,
    required this.sharingSessionId,
    this.heading,
    this.speed,
  });

  factory LivePosition.fromMap(Map<String, dynamic> data) {
    return LivePosition(
      lat: (data['lat'] as num).toDouble(),
      lng: (data['lng'] as num).toDouble(),
      accuracy: (data['accuracy'] as num?)?.toDouble() ?? 0,
      heading: (data['heading'] as num?)?.toDouble(),
      speed: (data['speed'] as num?)?.toDouble(),
      updatedAt:
          (data['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      sharingSessionId: data['sharingSessionId'] as String? ?? '',
    );
  }

  Map<String, dynamic> toMap() => {
        'lat': lat,
        'lng': lng,
        'accuracy': accuracy,
        if (heading != null) 'heading': heading,
        if (speed != null) 'speed': speed,
        'updatedAt': FieldValue.serverTimestamp(),
        'sharingSessionId': sharingSessionId,
      };
}
