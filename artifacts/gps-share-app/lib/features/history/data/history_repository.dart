import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/location_history_entry.dart';
import '../../map/data/location_repository.dart';

final myHistoryProvider = StreamProvider<List<LocationHistoryEntry>>((ref) {
  final uid = FirebaseAuth.instance.currentUser?.uid;
  if (uid == null) return const Stream.empty();
  return ref.watch(locationRepositoryProvider).watchHistory(uid);
});
