import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

final locationServiceProvider =
    Provider<LocationService>((_) => LocationService());

enum LocationPermissionResult { granted, denied, deniedForever, serviceOff }

class LocationService {
  Future<LocationPermissionResult> ensurePermission() async {
    final serviceOn = await Geolocator.isLocationServiceEnabled();
    if (!serviceOn) return LocationPermissionResult.serviceOff;

    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) {
      p = await Geolocator.requestPermission();
    }
    if (p == LocationPermission.deniedForever) {
      return LocationPermissionResult.deniedForever;
    }
    if (p == LocationPermission.denied) {
      return LocationPermissionResult.denied;
    }
    return LocationPermissionResult.granted;
  }

  Stream<Position> positionStream({int distanceFilterMeters = 10}) {
    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilterMeters,
      ),
    );
  }

  Future<Position> currentPosition() {
    return Geolocator.getCurrentPosition(
      locationSettings:
          const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  Future<void> openAppSettings() => Geolocator.openAppSettings();
}
