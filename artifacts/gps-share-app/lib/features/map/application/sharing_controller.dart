import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../services/consent_service.dart';
import '../../../services/location_service.dart';
import '../data/location_repository.dart';

final sharingControllerProvider =
    AsyncNotifierProvider<SharingController, bool>(SharingController.new);

/// Owns the live-sharing lifecycle.
///
/// Invariants:
/// - Cannot start unless user is signed in AND consent is accepted.
/// - On start: writes users/{uid}.isSharing=true and pushes positions.
/// - On stop: clears live/current and flips isSharing back to false.
class SharingController extends AsyncNotifier<bool> {
  StreamSubscription<Position>? _sub;
  String? _sessionId;

  @override
  Future<bool> build() async {
    ref.onDispose(() => _sub?.cancel());
    return false;
  }

  Future<void> start() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) throw StateError('Not signed in');
    final accepted = await ref.read(consentServiceProvider).hasAccepted();
    if (!accepted) throw StateError('Consent not accepted');

    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      _sessionId = DateTime.now().millisecondsSinceEpoch.toString();
      await FirebaseFirestore.instance.doc('users/${user.uid}').set(
        {'isSharing': true},
        SetOptions(merge: true),
      );

      final repo = ref.read(locationRepositoryProvider);
      final loc = ref.read(locationServiceProvider);

      _sub?.cancel();
      _sub = loc.positionStream().listen((pos) {
        repo.upsertLive(user.uid, pos, _sessionId!);
        repo.appendHistory(user.uid, pos);
      });
      return true;
    });
  }

  Future<void> stop() async {
    final user = FirebaseAuth.instance.currentUser;
    await _sub?.cancel();
    _sub = null;
    _sessionId = null;
    if (user != null) {
      await ref.read(locationRepositoryProvider).deleteLive(user.uid);
      await FirebaseFirestore.instance.doc('users/${user.uid}').set(
        {'isSharing': false},
        SetOptions(merge: true),
      );
    }
    state = const AsyncData(false);
  }
}
