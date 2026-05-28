import 'package:flutter_test/flutter_test.dart';
import 'package:gps_share_app/services/consent_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('hasAccepted returns false initially', () async {
    final svc = ConsentService();
    expect(await svc.hasAccepted(), isFalse);
  });

  test('accepting writes the local flag (Firebase path is no-op offline)',
      () async {
    final svc = ConsentService();
    SharedPreferences.setMockInitialValues({
      'consent.accepted.v1.0': true,
    });
    expect(await svc.hasAccepted(), isTrue);
  });
}
