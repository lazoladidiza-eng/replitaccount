import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/application/auth_controller.dart';
import '../features/auth/presentation/consent_screen.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/signup_screen.dart';
import '../features/auth/presentation/splash_screen.dart';
import '../features/contacts/presentation/add_contact_screen.dart';
import '../features/contacts/presentation/contact_map_screen.dart';
import '../features/contacts/presentation/contacts_screen.dart';
import '../features/history/presentation/history_screen.dart';
import '../features/map/presentation/map_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../services/consent_service.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authStream = ref.watch(authStateChangesProvider);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: GoRouterRefreshStream(authStream.stream),
    redirect: (context, state) async {
      final user = FirebaseAuth.instance.currentUser;
      final loc = state.matchedLocation;
      final atSplash = loc == '/splash';
      final atAuth = loc == '/login' || loc == '/signup';

      if (atSplash) return null;
      if (user == null) return atAuth ? null : '/login';

      final accepted = await ref.read(consentServiceProvider).hasAccepted();
      if (!accepted && loc != '/consent') return '/consent';
      if (accepted && (atAuth || loc == '/consent')) return '/map';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (_, __) => const SignupScreen()),
      GoRoute(path: '/consent', builder: (_, __) => const ConsentScreen()),
      GoRoute(path: '/map', builder: (_, __) => const MapScreen()),
      GoRoute(path: '/contacts', builder: (_, __) => const ContactsScreen()),
      GoRoute(
        path: '/contacts/add',
        builder: (_, __) => const AddContactScreen(),
      ),
      GoRoute(
        path: '/contacts/:uid/map',
        builder: (_, s) =>
            ContactMapScreen(contactUid: s.pathParameters['uid']!),
      ),
      GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
    ],
  );
});

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _sub = stream.asBroadcastStream().listen((_) => notifyListeners());
  }
  late final dynamic _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
