import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { type LatLng, type MapStyleElement, Marker, type Region } from 'react-native-maps';

import { cityLook } from '@/lib/cityVisuals';
import { type ChinaMapProps, groupPins, type PinGroup, pinBox } from '@/lib/mapPins';
import { playSound } from '@/lib/sounds';
import type { City } from '@/types/api';

import { CityPin } from './CityPin';

// The real map (issue #66): Apple Maps on iPhone, Google Maps on Android, both free and built into Expo Go.
// ChinaMap.web.tsx stands in on the web, where react-native-maps doesn't run.

const CHINA: Region = { latitude: 33.5, longitude: 108.5, latitudeDelta: 26, longitudeDelta: 26 };
// Room around the pins when the map fits them: badges stand above each city and Chengdu's name sits to its left.
const PIN_ROOM = { top: 64, right: 64, bottom: 24, left: 104 };
const FOCUS_DELTA = 7;

// Google's map without shops and stations: the pins are what to tap. (Apple's map is muted with mapType.)
const MAP_STYLE: MapStyleElement[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const toLatLng = (city: City): LatLng => ({ latitude: city.lat, longitude: city.lng });

export function ChinaMap({ cities, selected, onPick, overlay = { top: 0, bottom: 0 }, ref }: ChinaMapProps) {
  const map = useRef<MapView>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);
  const [longitudeDelta, setLongitudeDelta] = useState(CHINA.longitudeDelta);

  // What the screen's legend and buttons cover. The map keeps its logo and legal link out from under
  // them (both providers require those to show), and fits pins clear of them.
  const covered = { top: Math.round(overlay.top), right: 0, bottom: Math.round(overlay.bottom), left: 0 };
  // Google adds fit padding to its map padding; Apple's fit doesn't know about the overlay.
  const edgePadding =
    Platform.OS === 'android'
      ? PIN_ROOM
      : { ...PIN_ROOM, top: PIN_ROOM.top + covered.top, bottom: PIN_ROOM.bottom + covered.bottom };

  const fit = (shown: City[], animated = true) => {
    if (shown.length > 0) map.current?.fitToCoordinates(shown.map(toLatLng), { edgePadding, animated });
  };

  useImperativeHandle(ref, () => ({
    showAll: () => fit(cities),
    focus: (city) =>
      map.current?.animateToRegion(
        { ...toLatLng(city), latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA },
        450,
      ),
  }));

  // Start on the open cities, once the map and the cities are both there.
  useEffect(() => {
    if (!ready || fitted.current || cities.length === 0) return;
    fitted.current = true;
    const open = cities.filter((city) => city.available);
    fit(open.length > 0 ? open : cities, false);
  });

  const onRegionChangeComplete = (region: Region) => {
    // Panning alone doesn't change which pins overlap; only zooming does.
    setLongitudeDelta((previous) =>
      Math.abs(region.longitudeDelta - previous) / previous < 0.02 ? previous : region.longitudeDelta,
    );
  };

  const groups = width > 0 ? groupPins(cities, longitudeDelta, width) : [];

  return (
    <View style={styles.fill} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <MapView
        ref={map}
        style={styles.fill}
        initialRegion={CHINA}
        onMapReady={() => setReady(true)}
        onRegionChangeComplete={onRegionChangeComplete}
        mapPadding={Platform.OS === 'android' ? covered : undefined}
        legalLabelInsets={covered}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={MAP_STYLE}
        showsPointsOfInterests={false}
        showsCompass={false}
        showsScale={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        minZoomLevel={3}>
        {groups.map((group) => (
          <CityMarker
            key={group.city.slug}
            group={group}
            selected={group.city.slug === selected}
            // An open city's pin opens its sheet; a coming-soon pin with others under it zooms in to them.
            onPress={() => {
              playSound('select');
              if (group.city.available || group.hidden.length === 0) onPick(group.city, group.hidden);
              else fit([group.city, ...group.hidden]);
            }}
          />
        ))}
      </MapView>
    </View>
  );
}

function CityMarker({ group, selected, onPress }: { group: PinGroup; selected: boolean; onPress: () => void }) {
  const { city, hidden } = group;
  const box = pinBox(city.available, cityLook(city.slug).label);

  // Android draws a custom marker as a picture. Keep redrawing it until the art has rendered, then
  // stop, which keeps panning smooth. A new look (selected, or more cities under it) redraws it again.
  const look = `${selected}-${hidden.length}`;
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(look), 700);
    return () => clearTimeout(timer);
  }, [look]);

  const where = city.available ? '' : ', coming soon';
  const others = hidden.map((other) => other.name).join(', ');
  const more =
    hidden.length === 0 ? '' : city.available ? `. Nearby, coming soon: ${others}` : `, and ${others}. Zooms in.`;
  return (
    <Marker
      coordinate={toLatLng(city)}
      // The pin's point goes on the city: `anchor` for Google's map, `centerOffset` for Apple's.
      anchor={{ x: box.tipX / box.width, y: box.tipY / box.height }}
      centerOffset={{ x: box.width / 2 - box.tipX, y: box.height / 2 - box.tipY }}
      tracksViewChanges={settled !== look}
      zIndex={selected ? 3 : city.available ? 2 : 1}
      onPress={onPress}
      accessibilityLabel={`${city.name}${where}${more}`}>
      <CityPin city={city} selected={selected} hidden={hidden.length} />
    </Marker>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
