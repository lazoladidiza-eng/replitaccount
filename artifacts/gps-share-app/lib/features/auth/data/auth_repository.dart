import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/app_user.dart';

final authRepositoryProvider =
    Provider<AuthRepository>((_) => AuthRepository());

class AuthRepository {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  User? get currentUser => _auth.currentUser;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  Future<User> signIn(String email, String password) async {
    final cred = await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    return cred.user!;
  }

  Future<User> signUp(String email, String password, String displayName) async {
    final cred = await _auth.createUserWithEmailAndPassword(
      email: email,
      password: password,
    );
    final user = cred.user!;
    await user.updateDisplayName(displayName);

    final appUser = AppUser(
      uid: user.uid,
      email: email,
      displayName: displayName,
      consentAccepted: false,
      consentAcceptedAt: null,
      consentVersion: '1.0',
      isSharing: false,
      createdAt: null,
    );
    final batch = _db.batch();
    batch.set(_db.doc('users/${user.uid}'), appUser.toCreateMap());
    batch.set(_db.doc('userEmailIndex/${_emailKey(email)}'), {
      'uid': user.uid,
      'email': email.trim(),
      'createdAt': FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return user;
  }

  static String _emailKey(String email) => email.trim().toLowerCase();

  Future<void> signOut() => _auth.signOut();
}
