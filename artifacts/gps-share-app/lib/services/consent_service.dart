import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const consentVersion = '1.0';
const _kConsentKey = 'consent.accepted.v$consentVersion';

final consentServiceProvider =
    Provider<ConsentService>((_) => ConsentService());

class ConsentService {
  Future<bool> hasAccepted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kConsentKey) ?? false;
  }

  Future<void> accept() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kConsentKey, true);
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      await FirebaseFirestore.instance.doc('users/${user.uid}').set({
        'consent': {
          'accepted': true,
          'acceptedAt': FieldValue.serverTimestamp(),
          'version': consentVersion,
        },
      }, SetOptions(merge: true));
    }
  }

  Future<void> revoke() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kConsentKey, false);
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      await FirebaseFirestore.instance.doc('users/${user.uid}').set({
        'consent': {
          'accepted': false,
          'version': consentVersion,
        },
        'isSharing': false,
      }, SetOptions(merge: true));
      await FirebaseFirestore.instance
          .doc('users/${user.uid}/live/current')
          .delete()
          .catchError((_) {});
    }
  }
}
