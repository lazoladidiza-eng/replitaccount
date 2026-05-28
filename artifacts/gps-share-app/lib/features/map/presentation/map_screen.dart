import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../services/location_service.dart';
import '../../../services/permission_service.dart';
import '../../sos/presentation/sos_button.dart';
import '../application/sharing_controller.dart';

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  final Completer<GoogleMapController> _mapCtl = Completer();
  CameraPosition _initial = const CameraPosition(
    target: LatLng(0, 0),
    zoom: 2,
  );
  Marker? _meMarker;
  StreamSubscription? _posSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _centerOnUser());
  }

  @override
  void dispose() {
    _posSub?.cancel();
    super.dispose();
  }

  Future<void> _centerOnUser() async {
    final granted = await ref
        .read(permissionServiceProvider)
        .ensureLocationPermission(context);
    if (!granted || !mounted) return;
    final pos = await ref.read(locationServiceProvider).currentPosition();
    final target = LatLng(pos.latitude, pos.longitude);
    setState(() {
      _initial = CameraPosition(target: target, zoom: 15);
      _meMarker = Marker(markerId: const MarkerId('me'), position: target);
    });
    if (_mapCtl.isCompleted) {
      final c = await _mapCtl.future;
      await c.animateCamera(CameraUpdate.newLatLng(target));
    }
    _posSub ??= ref.read(locationServiceProvider).positionStream().listen((p) {
      if (!mounted) return;
      setState(() {
        _meMarker = Marker(
          markerId: const MarkerId('me'),
          position: LatLng(p.latitude, p.longitude),
        );
      });
    });
  }

  Future<void> _toggleSharing() async {
    final sharing = ref.read(sharingControllerProvider).valueOrNull ?? false;
    if (sharing) {
      await ref.read(sharingControllerProvider.notifier).stop();
      return;
    }
    final granted = await ref
        .read(permissionServiceProvider)
        .ensureLocationPermission(context);
    if (!granted) return;
    await ref.read(sharingControllerProvider.notifier).start();
  }

  @override
  Widget build(BuildContext context) {
    final sharing = ref.watch(sharingControllerProvider).valueOrNull ?? false;
    return Scaffold(
      appBar: AppBar(
        title: const Text('GPS Share'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      drawer: _Drawer(),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: _initial,
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            markers: {if (_meMarker != null) _meMarker!},
            onMapCreated: (c) {
              if (!_mapCtl.isCompleted) _mapCtl.complete(c);
            },
          ),
          Positioned(
            top: 12,
            left: 12,
            right: 12,
            child: Card(
              color: sharing ? Colors.green.shade100 : Colors.grey.shade200,
              child: ListTile(
                leading: Icon(sharing ? Icons.wifi_tethering : Icons.pause),
                title: Text(sharing ? 'Sharing live' : 'Not sharing'),
                trailing: FilledButton(
                  onPressed: _toggleSharing,
                  child: Text(sharing ? 'Stop' : 'Start'),
                ),
              ),
            ),
          ),
          const Positioned(
            right: 16,
            bottom: 24,
            child: SosButton(),
          ),
        ],
      ),
    );
  }
}

class _Drawer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: ListView(
          children: [
            ListTile(
              leading: const Icon(Icons.people),
              title: const Text('Trusted contacts'),
              onTap: () {
                Navigator.pop(context);
                context.push('/contacts');
              },
            ),
            ListTile(
              leading: const Icon(Icons.history),
              title: const Text('My location history'),
              onTap: () {
                Navigator.pop(context);
                context.push('/history');
              },
            ),
            ListTile(
              leading: const Icon(Icons.settings),
              title: const Text('Settings'),
              onTap: () {
                Navigator.pop(context);
                context.push('/settings');
              },
            ),
          ],
        ),
      ),
    );
  }
}
