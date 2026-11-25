/**
 * Pinler ve kümeler.
 *
 *   Uzak görünüm (bubbleMode): her bölgede tek balon (sayı + nadirlik halkası + bölge adı).
 *     Balonlar bu bileşenin kendi katmanıdır; haritanın gerçek (kesirli) zoom'una göre açılıp kapanır.
 *   Yakın görünüm: her bölge ayrı bir markercluster grubu; yakın pinler küçük kümelerde toplanır,
 *     kümeler bölge sınırını aşmaz, en yakında pinler tek tek görünür.
 *
 * Leaflet nesneleri React dışında yönetilir; bileşen yalnızca değişiklikleri haritaya uygular.
 */
import L from "leaflet";
import "leaflet.markercluster";
import { useCallback, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { REGIONS } from "../content/regions";
import { atlasRect, type SpriteAtlas } from "../game/sprites/atlas";
import { clusterByRegion } from "../lib/clustering";
import { RARITIES, REGION_IDS } from "../types";
import type { Character, Rarity, RegionId } from "../types";
import { toLatLng } from "./mapCoords";
import { PIN_ANCHOR, PIN_SIZE, clusterHtml, clusterSize, escapeHtml, pinHtml } from "./markerIcons";

interface ClusterLayerProps {
  characters: readonly Character[];
  atlas: SpriteAtlas;
  activeParticipantIds: ReadonlySet<string>;
  selectedId: string | null;
  focus: { id: string; nonce: number } | null;
  /** true: bölge balonları, false: pinler ve küçük kümeler. */
  bubbleMode: boolean;
  /** Bir karaktere odaklanırken en az bu zoom'a yakınlaşılır (balon görünümünden çıkmak için). */
  detailZoom: number;
  animate: boolean;
  onSelect: (id: string) => void;
  onBubbleClick: (regionId: RegionId) => void;
}

export function ClusterLayer({
  characters,
  atlas,
  activeParticipantIds,
  selectedId,
  focus,
  bubbleMode,
  detailZoom,
  animate,
  onSelect,
  onBubbleClick,
}: ClusterLayerProps) {
  const map = useMap();
  const groupsRef = useRef(new Map<RegionId, L.MarkerClusterGroup>());
  const bubblesRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const characterOf = useRef(new WeakMap<L.Marker, Character>());
  const onSelectRef = useRef(onSelect);
  const onBubbleClickRef = useRef(onBubbleClick);
  const selectedRef = useRef(selectedId);
  const initialFocusDone = useRef(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onBubbleClickRef.current = onBubbleClick;
    selectedRef.current = selectedId;
  });

  const iconFor = useCallback(
    (c: Character, selected: boolean) => {
      const rect = atlasRect(atlas, c.id);
      if (!rect) return null;
      return L.divIcon({
        html: pinHtml(c.rarity, rect, { selected, inRaid: activeParticipantIds.has(c.id) }),
        className: "kb-ikon",
        iconSize: PIN_SIZE,
        iconAnchor: PIN_ANCHOR,
      });
    },
    [atlas, activeParticipantIds],
  );

  /** Karaktere yakınlaş: önce ayrıntı zoom'una, sonra kümesini açarak pinini göster. */
  const showCharacter = useCallback(
    (id: string) => {
      const marker = markersRef.current.get(id);
      const c = marker && characterOf.current.get(marker);
      if (!marker || !c) return;
      if (map.getZoom() < detailZoom) map.setView(marker.getLatLng(), detailZoom + 0.5, { animate: false });
      const group = groupsRef.current.get(c.region);
      if (!group) return;
      // Balon görünümündeysek pin gruplarını hemen haritaya al (görünüm efekti de aynısını yapacak).
      if (!map.hasLayer(group)) {
        bubblesRef.current?.remove();
        groupsRef.current.forEach((g) => g.addTo(map));
      }
      group.zoomToShowLayer(marker, () => marker.openTooltip());
    },
    [map, detailZoom],
  );

  // Bölge grupları ve balon katmanı (bir kez kurulur)
  useEffect(() => {
    const groups = new Map<RegionId, L.MarkerClusterGroup>();
    for (const regionId of REGION_IDS) {
      const group = L.markerClusterGroup({
        maxClusterRadius: 52,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        spiderfyOnMaxZoom: false,
        chunkedLoading: true,
        animate,
        iconCreateFunction: (cluster) => {
          const children = cluster.getAllChildMarkers();
          const byRarity = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
          for (const marker of children) byRarity[characterOf.current.get(marker)?.rarity ?? "siradan"] += 1;
          const size = clusterSize(children.length, false);
          return L.divIcon({ html: clusterHtml({ count: children.length, byRarity }), className: "kb-ikon", iconSize: [size, size] });
        },
      });
      group.on("clusterclick", (event) => {
        const cluster = (event as L.LeafletEvent & { layer: L.MarkerCluster }).layer;
        if (map.getZoom() >= map.getMaxZoom()) cluster.spiderfy();
        else cluster.zoomToBounds({ padding: [48, 48] });
      });
      groups.set(regionId, group);
    }
    groupsRef.current = groups;
    bubblesRef.current = L.layerGroup();
    return () => {
      groups.forEach((group) => group.remove());
      bubblesRef.current?.remove();
    };
  }, [map, animate]);

  // Görünüm: balonlar mı, pinler mi?
  useEffect(() => {
    const bubbles = bubblesRef.current;
    if (bubbleMode) {
      groupsRef.current.forEach((group) => group.remove());
      bubbles?.addTo(map);
    } else {
      bubbles?.remove();
      groupsRef.current.forEach((group) => group.addTo(map));
    }
  }, [map, bubbleMode, animate]);

  // Pinler ve balonlar (filtre değişince yeniden kurulur)
  useEffect(() => {
    const groups = groupsRef.current;
    const markers = markersRef.current;
    groups.forEach((group) => group.clearLayers());
    markers.clear();

    const byRegion = new Map<RegionId, L.Marker[]>();
    for (const c of characters) {
      const icon = iconFor(c, c.id === selectedRef.current);
      if (!icon) continue;
      const marker = L.marker(toLatLng(c.coordinates), {
        icon,
        title: c.displayName,
        alt: c.displayName,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: c.id === selectedRef.current ? 1000 : 0,
      });
      marker.bindTooltip(escapeHtml(c.displayName), { direction: "top", offset: [0, -42], className: "kb-tooltip" });
      marker.on("click", () => onSelectRef.current(c.id));
      characterOf.current.set(marker, c);
      markers.set(c.id, marker);
      const list = byRegion.get(c.region);
      if (list) list.push(marker);
      else byRegion.set(c.region, [marker]);
    }
    byRegion.forEach((list, regionId) => groups.get(regionId)?.addLayers(list));

    // Bölge balonları
    const bubbles = bubblesRef.current;
    bubbles?.clearLayers();
    for (const cluster of clusterByRegion(characters)) {
      const size = clusterSize(cluster.count, true);
      const bubble = L.marker(toLatLng(cluster.center), {
        icon: L.divIcon({
          html: clusterHtml({ count: cluster.count, byRarity: cluster.byRarity, regionName: REGIONS[cluster.regionId].name }),
          className: "kb-ikon",
          iconSize: [size, size],
        }),
        keyboard: true,
        title: `${REGIONS[cluster.regionId].name}: ${cluster.count} kahraman`,
      });
      bubble.on("click", () => onBubbleClickRef.current(cluster.regionId));
      bubbles?.addLayer(bubble);
    }

    // Paylaşılan link (?k=…) ile açıldıysa ilk kurulumda seçili karaktere yakınlaş.
    if (!initialFocusDone.current) {
      initialFocusDone.current = true;
      if (selectedRef.current) showCharacter(selectedRef.current);
    }
    // animate değişince gruplar yeniden kurulur; pinler de yeni gruplara eklenmeli.
  }, [characters, iconFor, animate, showCharacter]);

  // Seçim vurgusu: yalnızca eski ve yeni seçili pinin simgesi değişir.
  const previousSelected = useRef<string | null>(null);
  useEffect(() => {
    const markers = markersRef.current;
    for (const id of [previousSelected.current, selectedId]) {
      if (!id) continue;
      const marker = markers.get(id);
      const c = marker && characterOf.current.get(marker);
      if (!marker || !c) continue;
      const icon = iconFor(c, id === selectedId);
      if (icon) marker.setIcon(icon);
      marker.setZIndexOffset(id === selectedId ? 1000 : 0);
    }
    previousSelected.current = selectedId;
  }, [selectedId, iconFor]);

  // Aramadan seçilen karaktere uç.
  useEffect(() => {
    if (focus) showCharacter(focus.id);
  }, [focus, showCharacter]);

  return null;
}
