/*
 * Jawk visual rule: keep the existing rounded map stage and use real geographic data inside it.
 * This component owns map behavior only; page layout and styling remain in the route.
 */
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const IRAQ_CENTER = [33.3152, 44.3661];

export default function LiveMap({ venues = [], onVenueClick, onLocate }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    import("leaflet").then(({ default: L }) => {
      if (disposed || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(
        IRAQ_CENTER,
        6,
      );
      L.control.zoom({ position: "topright" }).addTo(map);

      // اعتماد خرائط OpenStreetMap المباشرة بدون الحاجة لأي مفتاح API
      const osmTiles = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      L.tileLayer(osmTiles, {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 0);
    });
    return () => {
      disposed = true;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapReady) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const validVenues = venues.filter(
      (venue) => Number.isFinite(Number(venue.latitude)) && Number.isFinite(Number(venue.longitude)),
    );
    validVenues.forEach((venue) => {
      const marker = L.circleMarker([Number(venue.latitude), Number(venue.longitude)], {
        radius: venue.active ? 9 : 7,
        color: venue.active ? "#e0564a" : "#1f5a4a",
        weight: 2,
        fillColor: venue.active ? "#e0564a" : "#f4c95d",
        fillOpacity: 0.95,
      })
        .addTo(map)
        .bindTooltip(venue.name_ar || venue.name || "ملعب", { direction: "top" });
      marker.on("click", () => onVenueClick?.(venue));
      markersRef.current.push(marker);
    });
    if (validVenues.length > 1) {
      map.fitBounds(L.latLngBounds(validVenues.map((venue) => [venue.latitude, venue.longitude])), {
        padding: [24, 24],
        maxZoom: 13,
      });
    } else if (validVenues.length === 1) {
      map.setView([validVenues[0].latitude, validVenues[0].longitude], 13);
    }
  }, [venues, onVenueClick, mapReady]);

  const locate = () => {
    if (!navigator.geolocation) return onLocate?.(new Error("المتصفح لا يدعم تحديد الموقع."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = [coords.latitude, coords.longitude];
        const L = leafletRef.current;
        const map = mapRef.current;

        if (map && L) {
          map.setView(point, 15);
          if (userMarkerRef.current) userMarkerRef.current.remove();
          userMarkerRef.current = L.circle(point, {
            radius: 80,
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.4,
          }).addTo(map);
        }

        onLocate?.(null, { latitude: coords.latitude, longitude: coords.longitude });
      },
      (error) => onLocate?.(error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    );
  };

  return (
    <div ref={containerRef} className="relative h-full w-full" role="application" aria-label="خريطة الملاعب الحقيقية">
      <button
        type="button"
        aria-label="موقعي"
        onClick={locate}
        className="absolute top-3 left-3 z-[500] flex h-9 w-9 items-center justify-center rounded-full bg-surface text-foreground shadow-card hover:bg-surface/80"
      >
        ⊙
      </button>
    </div>
  );
}