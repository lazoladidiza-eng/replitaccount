# GPS Share — consent-based live location sharing (Flutter MVP)

Android-first Flutter app that lets a user **explicitly** share their live
GPS location with trusted contacts they have added (and who accepted).
Foreground-only sharing, no IMEI/phone-number/carrier tricks, no stealth
tracking. Designed to be Play-Store-policy-compliant.

## Stack

- Flutter 3.22+, Dart 3.3+
- Firebase Auth (email + password)
- Cloud Firestore (live position + history + contacts + SOS alerts)
- `google_maps_flutter`, `geolocator`, `permission_handler`
- `flutter_riverpod`, `go_router`, `shared_preferences`

## Project layout

```
lib/
├── main.dart
├── firebase_options.dart        # PLACEHOLDER — replace via flutterfire configure
├── core/                        # router, theme, Result
├── models/                      # AppUser, LivePosition, TrustedContact, SosAlert, history
├── services/                    # location, permission, consent
└── features/
    ├── auth/      (splash, login, signup, consent)
    ├── map/       (Google Map + start/stop sharing toggle + SOS button)
    ├── contacts/  (accepted list + invites + per-contact map)
    ├── sos/       (one-tap alert)
    ├── history/   (owner-only list of points)
    └── settings/  (revoke consent, sign out)
```

## Setup

1. Install Flutter SDK 3.22+ — https://docs.flutter.dev/get-started/install
   ```
   flutter --version
   ```

2. Install dependencies:
   ```
   cd artifacts/gps-share-app
   flutter pub get
   ```

3. Create a Firebase project (https://console.firebase.google.com), then:
   ```
   npm i -g firebase-tools
   firebase login

   dart pub global activate flutterfire_cli
   flutterfire configure
   # Pick your project, choose Android.
   # This overwrites lib/firebase_options.dart with real values and
   # drops android/app/google-services.json into place.
   ```

4. In the Firebase console:
   - **Authentication → Sign-in method**: enable Email/Password
   - **Firestore Database**: create in production mode
   - (Optional) **App Check** with Play Integrity

5. Deploy security rules:
   ```
   firebase deploy --only firestore:rules
   ```

6. Add a Google Maps SDK key:
   - Google Cloud Console → enable **Maps SDK for Android**
   - Create an API key, restrict by Android app SHA-1 + package
     `com.example.gps_share_app`
   - Replace `YOUR_MAPS_API_KEY` in
     `android/app/src/main/AndroidManifest.xml`

7. Run on a device or emulator with Google Play Services:
   ```
   flutter run
   ```

## Firestore schema

```
users/{uid}
  email, displayName
  consent: { accepted, acceptedAt, version }
  isSharing: bool
  createdAt: ts

users/{uid}/live/current       # owner writes; contacts read
  lat, lng, accuracy, heading?, speed?, updatedAt, sharingSessionId

users/{uid}/history/{autoId}   # owner-only
  lat, lng, accuracy, recordedAt

users/{uid}/contacts/{contactUid}
  contactUid, contactEmail, addedAt

users/{uid}/invitesIncoming/{id}
  fromUid, fromEmail, status, createdAt

users/{uid}/invitesOutgoing/{id}
  toUid, toEmail, status, createdAt

sosAlerts/{id}
  fromUid, lat, lng, accuracy, notifiedContactUids[], createdAt

userEmailIndex/{emailLower}    # readable by any signed-in user
  uid, email, createdAt        # only owner of uid may write
```

Security rules in `firestore.rules` are the **legal teeth** of the consent
model — contacts can only read your live position if you've added them
under `users/{yourUid}/contacts/`.

## Permission flow

1. User taps **Start sharing** on the map screen
2. If consent not yet accepted → routed to consent screen, blocks until "I agree"
3. App checks `Geolocator.checkPermission()`
4. If `denied` → in-app rationale, then `requestPermission()`
5. If `deniedForever` → "Open settings" dialog
6. If `whileInUse` granted → sharing begins; live doc updates every ~5s / 10m
7. **Stop sharing** deletes the live doc so contacts immediately see "not sharing"
8. **Revoke consent** in Settings is a stronger version of stop:
   stops sharing, deletes the live doc, clears the consent flag,
   bounces the user back to the consent screen

## Out of scope (intentional)

- iOS (Android-first per spec — the Dart code is portable but no Xcode setup)
- Background sharing / foreground service / always-on tracking
- Push notifications for SOS (writes a doc only; add FCM + a tiny cloud function later)
- E2E encryption of coordinates (consent + rules are the MVP security model)

## Testing

```
flutter analyze
flutter test
```

Manual verification path is in the project plan at
`/root/.claude/plans/build-a-legal-flutter-playful-raven.md`.
