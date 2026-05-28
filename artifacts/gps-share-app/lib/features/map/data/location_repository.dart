import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../models/live_position.dart';
import '../../../models/location_history_entry.dart';

final locationRepositoryProvider =
    Provider<LocationRepository>((_) => LocationRepository());

class LocationRepository {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  Future<void> upsertLive(
    String uid,
    Position pos,
    String sessionId,
  ) {
    final live = LivePosition(
      lat: pos.latitude,
      lng: pos.longitude,
      accuracy: pos.accuracy,
      heading: pos.heading,
      speed: pos.speed,
      updatedAt: DateTime.now(),
      sharingSessionId: sessionId,
    );
    return _db
        .doc('users/$uid/live/current')
        .set(live.toMap(), SetOptions(merge: true));
  }

  Future<void> appendHistory(String uid, Position pos) {
    return _db.collection('users/$uid/history').add({
      'lat': pos.latitude,
      'lng': pos.longitude,
      'accuracy': pos.accuracy,
      'recordedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> deleteLive(String uid) {
    return _db.doc('users/$uid/live/current').delete().catchError((_) {});
  }

  Stream<LivePosition?> watchLive(String uid) {
    return _db.doc('users/$uid/live/current').snapshots().map((snap) {
      if (!snap.exists) return null;
      return LivePosition.fromMap(snap.data()!);
    });
  }

  Stream<List<LocationHistoryEntry>> watchHistory(String uid, {int limit = 200}) {
    return _db
        .collection('users/$uid/history')
        .orderBy('recordedAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((s) =>
            s.docs.map((d) => LocationHistoryEntry.fromMap(d.id, d.data())).toList());
  }
}
