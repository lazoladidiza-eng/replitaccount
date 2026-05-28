import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../map/data/location_repository.dart';

class ContactMapScreen extends ConsumerWidget {
  final String contactUid;
  const ContactMapScreen({super.key, required this.contactUid});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final liveStream = ref
        .watch(locationRepositoryProvider)
        .watchLive(contactUid);

    return Scaffold(
      appBar: AppBar(title: const Text('Contact location')),
      body: StreamBuilder(
        stream: liveStream,
        builder: (context, snap) {
          if (!snap.hasData && snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final pos = snap.data;
          if (pos == null) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'This contact is not sharing right now.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          final target = LatLng(pos.lat, pos.lng);
          return GoogleMap(
            initialCameraPosition: CameraPosition(target: target, zoom: 15),
            markers: {
              Marker(
                markerId: const MarkerId('contact'),
                position: target,
                infoWindow: InfoWindow(
                  title: 'Updated ${pos.updatedAt.toLocal()}',
                ),
              ),
            },
          );
        },
      ),
    );
  }
}
