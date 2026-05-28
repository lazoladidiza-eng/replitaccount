import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/location_service.dart';

final sosRepositoryProvider =
    Provider<SosRepository>((ref) => SosRepository(ref.read(locationServiceProvider)));

class SosRepository {
  final LocationService _location;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  SosRepository(this._location);

  /// Captures current position and writes an SOS alert visible to all
  /// accepted contacts. Returns the alert id.
  Future<String> trigger() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw StateError('Not signed in');

    final pos = await _location.currentPosition();
    final contactsSnap = await _db
        .collection('users/${user.uid}/contacts')
        .get();
    final contactUids =
        contactsSnap.docs.map((d) => d.id).toList(growable: false);

    final ref = await _db.collection('sosAlerts').add({
      'fromUid': user.uid,
      'lat': pos.latitude,
      'lng': pos.longitude,
      'accuracy': pos.accuracy,
      'notifiedContactUids': contactUids,
      'createdAt': FieldValue.serverTimestamp(),
    });
    return ref.id;
  }
}
