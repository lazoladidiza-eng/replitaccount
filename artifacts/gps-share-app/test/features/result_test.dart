import 'package:flutter_test/flutter_test.dart';
import 'package:gps_share_app/core/result.dart';

void main() {
  test('Ok carries a value', () {
    final r = const Ok<int>(42);
    expect(r, isA<Ok<int>>());
    expect((r as Ok<int>).value, 42);
  });

  test('Err carries a message', () {
    final r = const Err<int>('boom');
    expect(r, isA<Err<int>>());
    expect((r as Err<int>).message, 'boom');
  });
}
