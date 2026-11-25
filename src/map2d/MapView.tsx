/**
 * KUŞBAKIŞI HARİTA (Leaflet, CRS.Simple)
 *
 * Katmanlar (alttan üste): piksel ada → Kadim Kemer → sis → bölge sınırları → etiketler → pinler/kümeler.
 * Bölge filtresi değişince harita o bölgelere uçar; aramadan seçilen karaktere yakınlaşır.
 * Yakınlaştırma düğmeleri haritanın dışında (HUD) durur ve haritayı ref üzerinden yönetir.
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MapContainer } from "react-leaflet";
import { ZoomControls } from "../components/hud/ZoomControls";
import { useGameData } from "../data/useGameData";
import { buildSpriteAtlas } from "../game/sprites/atlas";
import { rgbaToDataUrl } from "../game/sprites/portraitCache";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { regionsBounds } from "../lib/clustering";
import { useAppStore } from "../state/useAppStore";
import type { Character, RegionId } from "../types";
import { BaseMapLayer } from "./BaseMapLayer";
import { ClusterLayer } from "./ClusterLayer";
import { PAN_LAT_LNG_BOUNDS, WORLD_LAT_LNG_BOUNDS, toLatLngBounds } from "./mapCoords";
import { PIN_SCALE } from "./markerIcons";
import { RegionPolygons } from "./RegionPolygons";

/** Kenarlardaki arayüz parçaları için odak boşluğu (piksel). */
const FOCUS_PADDING_TOP_LEFT: L.PointTuple = [24, 96];
const FOCUS_PADDING_BOTTOM_RIGHT: L.PointTuple = [24, 32];
/** Toplam yatay ve dikey boşluk (genel görünüm zoom'u hesaplanırken). */
const OVERVIEW_PADDING: L.PointTuple = [
  FOCUS_PADDING_TOP_LEFT[0] + FOCUS_PADDING_BOTTOM_RIGHT[0],
  FOCUS_PADDING_TOP_LEFT[1] + FOCUS_PADDING_BOTTOM_RIGHT[1],
];

interface MapViewProps {
  /** Filtreden geçen karakterler. */
  characters: readonly Character[];
}

export default function MapView({ characters }: MapViewProps) {
  const data = useGameData();
  const [map, setMap] = useState<L.Map | null>(null);
  const [overviewZoom, setOverviewZoom] = useState<number | null>(null);
  const regions = useAppStore((s) => s.filters.regions);
  const selectedId = useAppStore((s) => s.selectedId);
  const focus = useAppStore((s) => s.focus);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Atlas bütün karakterlerden bir kez kurulur; filtre değişince yeniden kurulmaz.
  const atlas = useMemo(() => buildSpriteAtlas(data.characters), [data.characters]);
  const atlasStyle = useMemo(
    () =>
      ({
        "--kb-atlas": `url(${rgbaToDataUrl(atlas)})`,
        "--kb-atlas-w": `${atlas.width * PIN_SCALE}px`,
        "--kb-atlas-h": `${atlas.height * PIN_SCALE}px`,
      }) as CSSProperties,
    [atlas],
  );

  // Bütün dünyanın ekrana sığdığı zoom; en uzak zoom ve balon eşiği buna göre ayarlanır.
  useEffect(() => {
    if (!map) return;
    map.getContainer().setAttribute("aria-label", "OBA-Tales akın haritası. Ok tuşlarıyla kaydırın, artı ve eksiyle yakınlaşın.");
    // Geliştirme sırasında tarayıcı konsolundan incelemek için: window.__kbMap
    if (import.meta.env.DEV) (window as unknown as { __kbMap?: L.Map }).__kbMap = map;
    const update = () => {
      // Bütün adaların, arayüz boşlukları bırakılarak sığdığı zoom.
      const overview = map.getBoundsZoom(WORLD_LAT_LNG_BOUNDS, false, L.point(OVERVIEW_PADDING));
      // En uzak zoom tam sayı olmalı: markercluster kesirli minZoom'da tek kalan pinleri çizmiyor.
      map.setMinZoom(Math.floor(overview - 0.5));
      setOverviewZoom(overview);
    };
    update();
    map.on("resize", update);
    return () => {
      map.off("resize", update);
    };
  }, [map]);

  // Balon görünümü: kullanıcı bütün adalara bakarken (genel görünümden en fazla çeyrek adım yakın).
  const bubbleThreshold = overviewZoom === null ? null : overviewZoom + 0.25;
  const [bubbleMode, setBubbleMode] = useState(true);
  useEffect(() => {
    if (!map || bubbleThreshold === null) return;
    const update = () => {
      const bubbles = map.getZoom() <= bubbleThreshold;
      setBubbleMode(bubbles);
      // Balonlar bölge adını zaten yazdığı için uzak görünümde etiketleri gizle.
      map.getContainer().classList.toggle("kb-uzak", bubbles);
    };
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map, bubbleThreshold]);

  // Balona tıklayınca o bölgeye, balon görünümünden kesinlikle çıkacak kadar yakınlaş.
  const flyToRegion = useCallback(
    (id: RegionId) => {
      if (!map || bubbleThreshold === null) return;
      const bounds = L.latLngBounds(toLatLngBounds(regionsBounds([id], 16)));
      const zoom = Math.max(map.getBoundsZoom(bounds, false, L.point(OVERVIEW_PADDING)), bubbleThreshold + 0.75);
      if (reducedMotion) map.setView(bounds.getCenter(), zoom, { animate: false });
      else map.flyTo(bounds.getCenter(), zoom, { duration: 0.7 });
    },
    [map, bubbleThreshold, reducedMotion],
  );

  // Bölge filtresi değişince o bölgelere uç (ilk açılışta animasyonsuz).
  const regionKey = regions.join(",");
  const firstFocus = useRef(true);
  useEffect(() => {
    if (!map) return;
    const bounds = toLatLngBounds(regionsBounds(regionKey ? (regionKey.split(",") as RegionId[]) : []));
    const options = { paddingTopLeft: FOCUS_PADDING_TOP_LEFT, paddingBottomRight: FOCUS_PADDING_BOTTOM_RIGHT };
    if (firstFocus.current) {
      firstFocus.current = false;
      map.fitBounds(bounds, { ...options, animate: false });
    } else if (reducedMotion) {
      map.fitBounds(bounds, { ...options, animate: false });
    } else {
      map.flyToBounds(bounds, { ...options, duration: 0.8 });
    }
  }, [map, regionKey, reducedMotion]);

  // Bölgeye tıklama: o bölgeyi seç; zaten tek seçili bölgeyse seçimi kaldır.
  const onRegionClick = useCallback((id: RegionId) => {
    const { filters, setRegions } = useAppStore.getState();
    setRegions(filters.regions.length === 1 && filters.regions[0] === id ? [] : [id]);
  }, []);

  const onSelect = useCallback((id: string) => useAppStore.getState().select(id), []);

  return (
    <div className="absolute inset-0" style={atlasStyle}>
      <MapContainer
        ref={setMap}
        crs={L.CRS.Simple}
        bounds={WORLD_LAT_LNG_BOUNDS}
        maxBounds={PAN_LAT_LNG_BOUNDS}
        maxBoundsViscosity={0.8}
        minZoom={-4}
        maxZoom={4}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        zoomControl={false}
        attributionControl={false}
        className="kb-harita h-full w-full"
      >
        <BaseMapLayer
          seed={data.world.seed}
          revealedRegions={data.revealedRegions}
          glimpses={data.world.glimpses}
          fogSoftness={data.world.fogSoftness}
        />
        <RegionPolygons revealedRegions={data.revealedRegions} selectedRegions={regions} onRegionClick={onRegionClick} />
        {bubbleThreshold !== null && (
          <ClusterLayer
            characters={characters}
            atlas={atlas}
            activeParticipantIds={data.activeParticipantIds}
            selectedId={selectedId}
            focus={focus}
            bubbleMode={bubbleMode}
            detailZoom={bubbleThreshold + 0.75}
            animate={!reducedMotion}
            onSelect={onSelect}
            onBubbleClick={flyToRegion}
          />
        )}
      </MapContainer>

      <ZoomControls
        onZoomIn={() => map?.zoomIn()}
        onZoomOut={() => map?.zoomOut()}
        onReset={() => {
          useAppStore.getState().setRegions([]);
          map?.flyToBounds(WORLD_LAT_LNG_BOUNDS, { duration: reducedMotion ? 0 : 0.8 });
        }}
      />
    </div>
  );
}
