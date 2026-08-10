"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlaceDigest } from "@/lib/types";
import { CHINA_BLOCK_CITY_NODES, type ChinaBlockCityNode } from "@/lib/china-block-city-nodes";

type ProjectedCityNode = ChinaBlockCityNode & {
  x: number;
  y: number;
};

type BlockCell = {
  id: string;
  col: number;
  row: number;
  city: string;
  label: string;
  count: number;
  isInsideMap: boolean;
};

const GRID_COLS = 56;
const GRID_ROWS = 34;
const NEARBY_CITY_LIMIT = 3;
const MAP_JSON_MIRRORS = [
  "https://fastly.jsdelivr.net/npm/echarts@4.9.0/map/json",
  "https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json",
  "https://unpkg.com/echarts@4.9.0/map/json",
] as const;

type EChartsGeoJson = {
  type: "FeatureCollection";
  UTF8Encoding?: boolean;
  features: Array<{
    geometry?: {
      type?: "Polygon" | "MultiPolygon";
      coordinates?: unknown;
      encodeOffsets?: unknown;
    };
  }>;
};

type ChinaMapMask = {
  rings: [number, number][][];
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function projectToNormalizedPoint(
  longitude: number,
  latitude: number,
  mapMask: ChinaMapMask | null,
) {
  if (!mapMask) {
    const x = clamp((longitude - 73) / (136 - 73), 0, 1);
    const y = clamp(1 - (latitude - 17) / (54 - 17), 0, 1);
    return { x, y };
  }
  const x = clamp((longitude - mapMask.lonMin) / (mapMask.lonMax - mapMask.lonMin), 0, 1);
  const y = clamp(1 - (latitude - mapMask.latMin) / (mapMask.latMax - mapMask.latMin), 0, 1);
  return { x, y };
}

function pointInRing(longitude: number, latitude: number, ring: readonly [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const cross =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (cross) {
      inside = !inside;
    }
  }
  return inside;
}

function isInsideChinaMap(longitude: number, latitude: number, mapMask: ChinaMapMask | null) {
  if (!mapMask) {
    return true;
  }
  if (
    longitude < mapMask.lonMin ||
    longitude > mapMask.lonMax ||
    latitude < mapMask.latMin ||
    latitude > mapMask.latMax
  ) {
    return false;
  }
  return mapMask.rings.some((ring) => pointInRing(longitude, latitude, ring));
}

async function loadGeoJsonFromMirrors(path: string): Promise<EChartsGeoJson> {
  const errors: string[] = [];
  for (const baseUrl of MAP_JSON_MIRRORS) {
    const mapUrl = `${baseUrl}/${path}`;
    try {
      const response = await fetch(mapUrl);
      if (!response.ok) {
        errors.push(`${mapUrl} (${response.status})`);
        continue;
      }
      const geoJson = (await response.json()) as EChartsGeoJson;
      if (geoJson.type !== "FeatureCollection" || !Array.isArray(geoJson.features)) {
        errors.push(`${mapUrl} (invalid geojson)`);
        continue;
      }
      return geoJson;
    } catch {
      errors.push(`${mapUrl} (network error)`);
    }
  }
  throw new Error(`地图数据加载失败：${errors.join(" | ")}`);
}

function extractRingsFromGeometry(geometry: EChartsGeoJson["features"][number]["geometry"]) {
  if (!geometry?.coordinates) {
    return [] as [number, number][][];
  }
  if (geometry.type === "Polygon") {
    const polygon = geometry.coordinates as unknown as [number, number][][];
    return polygon.length > 0 ? [polygon[0]] : [];
  }
  if (geometry.type === "MultiPolygon") {
    const multiPolygon = geometry.coordinates as unknown as [number, number][][][];
    return multiPolygon.map((polygon) => polygon[0]).filter((ring) => ring?.length);
  }
  return [] as [number, number][][];
}

function decodeUtf8PolygonRing(encodedRing: string, encodeOffset: readonly [number, number]) {
  const ring: [number, number][] = [];
  let offsetX = encodeOffset[0];
  let offsetY = encodeOffset[1];

  for (let index = 0; index < encodedRing.length; index += 2) {
    let x = encodedRing.charCodeAt(index) - 64;
    let y = encodedRing.charCodeAt(index + 1) - 64;

    x = (x >> 1) ^ (-(x & 1));
    y = (y >> 1) ^ (-(y & 1));

    x += offsetX;
    y += offsetY;
    offsetX = x;
    offsetY = y;

    ring.push([x / 1024, y / 1024]);
  }

  return ring;
}

function toOffsetPair(rawOffset: unknown): [number, number] | null {
  if (!Array.isArray(rawOffset) || rawOffset.length < 2) {
    return null;
  }
  const [offsetX, offsetY] = rawOffset;
  if (typeof offsetX !== "number" || typeof offsetY !== "number") {
    return null;
  }
  return [offsetX, offsetY];
}

function decodeUtf8Geometry(geometry: EChartsGeoJson["features"][number]["geometry"]) {
  if (!geometry?.coordinates || !geometry.encodeOffsets) {
    return geometry;
  }

  if (geometry.type === "Polygon") {
    const encodedRings = geometry.coordinates as string[];
    const encodeOffsets = geometry.encodeOffsets as unknown[];
    const decodedCoordinates = encodedRings
      .map((encodedRing, index) => {
        const offset = toOffsetPair(encodeOffsets[index]);
        if (!offset) {
          return null;
        }
        return decodeUtf8PolygonRing(encodedRing, offset);
      })
      .filter((ring): ring is [number, number][] => Boolean(ring));
    return {
      ...geometry,
      coordinates: decodedCoordinates,
    };
  }

  if (geometry.type === "MultiPolygon") {
    const encodedPolygons = geometry.coordinates as string[][];
    const encodeOffsets = geometry.encodeOffsets as unknown[];
    const decodedCoordinates = encodedPolygons.map((polygon, polygonIndex) =>
      polygon
        .map((encodedRing, ringIndex) => {
          const polygonOffsets = Array.isArray(encodeOffsets[polygonIndex])
            ? (encodeOffsets[polygonIndex] as unknown[])
            : [];
          const offset = toOffsetPair(polygonOffsets[ringIndex]);
          if (!offset) {
            return null;
          }
          return decodeUtf8PolygonRing(encodedRing, offset);
        })
        .filter((ring): ring is [number, number][] => Boolean(ring)),
    );
    return {
      ...geometry,
      coordinates: decodedCoordinates,
    };
  }

  return geometry;
}

function normalizeGeoJsonForMask(geoJson: EChartsGeoJson): EChartsGeoJson {
  if (!geoJson.UTF8Encoding) {
    return geoJson;
  }

  return {
    ...geoJson,
    UTF8Encoding: false,
    features: geoJson.features.map((feature) => ({
      ...feature,
      geometry: decodeUtf8Geometry(feature.geometry),
    })),
  };
}

function buildChinaMapMask(geoJson: EChartsGeoJson): ChinaMapMask {
  const normalizedGeoJson = normalizeGeoJsonForMask(geoJson);
  const rings = normalizedGeoJson.features.flatMap((feature) =>
    extractRingsFromGeometry(feature.geometry),
  );
  let lonMin = Number.POSITIVE_INFINITY;
  let lonMax = Number.NEGATIVE_INFINITY;
  let latMin = Number.POSITIVE_INFINITY;
  let latMax = Number.NEGATIVE_INFINITY;

  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      lonMin = Math.min(lonMin, lon);
      lonMax = Math.max(lonMax, lon);
      latMin = Math.min(latMin, lat);
      latMax = Math.max(latMax, lat);
    }
  }

  if (!Number.isFinite(lonMin) || !Number.isFinite(latMin)) {
    throw new Error("地图边界数据为空");
  }

  return { rings, lonMin, lonMax, latMin, latMax };
}

function getNearestCityNode(nx: number, ny: number, nodes: readonly ProjectedCityNode[]): ProjectedCityNode {
  let nearestNode = nodes[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const distance = (node.x - nx) ** 2 + (node.y - ny) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestNode = node;
    }
  }
  return nearestNode;
}

function getBlockColor(
  count: number,
  maxCount: number,
  active: boolean,
  isInsideMap: boolean,
): string {
  if (!isInsideMap) {
    return "rgb(241 245 249)";
  }
  if (active) {
    return "rgb(99 102 241)";
  }
  if (maxCount <= 0) {
    return "rgb(165 180 252)";
  }
  const ratio = Math.min(count / maxCount, 1);
  const lightness = 88 - ratio * 48;
  return `hsl(231 82% ${lightness}%)`;
}

function getDistanceInKm(from: ChinaBlockCityNode, to: ChinaBlockCityNode): number {
  const rad = (degree: number) => (degree * Math.PI) / 180;
  const lat1 = rad(from.latitude);
  const lat2 = rad(to.latitude);
  const dLat = lat2 - lat1;
  const dLon = rad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

type ChinaBlockMapProps = {
  cityArticleCounts: Record<string, number>;
  nearbyCityDigests: PlaceDigest[];
  nearbyCityName: string | null;
  nearbyLoading: boolean;
  onCitySelectAction: (city: string, nearbyCities: string[]) => void;
};

export default function ChinaBlockMap({
  cityArticleCounts,
  nearbyCityDigests,
  nearbyCityName,
  nearbyLoading,
  onCitySelectAction,
}: ChinaBlockMapProps) {
  const [hoveredBlock, setHoveredBlock] = useState<BlockCell | null>(null);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const [level, setLevel] = useState<"overview" | "nearby">("overview");
  const [mapMask, setMapMask] = useState<ChinaMapMask | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function loadMapMask() {
      try {
        const geoJson = await loadGeoJsonFromMirrors("china.json");
        if (cancelled) {
          return;
        }
        setMapMask(buildChinaMapMask(geoJson));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setStatusMessage(
          error instanceof Error ? `${error.message}，已使用基础网格显示。` : "地图边界加载失败，已使用基础网格显示。",
        );
      }
    }

    void loadMapMask();

    return () => {
      cancelled = true;
    };
  }, []);

  const projectedCityNodes = useMemo(
    () =>
      CHINA_BLOCK_CITY_NODES.map((node) => {
        const point = projectToNormalizedPoint(node.longitude, node.latitude, mapMask);
        return { ...node, ...point };
      }),
    [mapMask],
  );

  const nearbyCityByName = useMemo(() => {
    const nearbyMap = new Map<string, string[]>();
    for (const node of CHINA_BLOCK_CITY_NODES) {
      const nearest = CHINA_BLOCK_CITY_NODES
        .filter((targetNode) => targetNode.city !== node.city)
        .map((targetNode) => ({
          city: targetNode.city,
          distance: getDistanceInKm(node, targetNode),
        }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, NEARBY_CITY_LIMIT)
        .map((targetNode) => targetNode.city);
      nearbyMap.set(node.city, nearest);
    }
    return nearbyMap;
  }, []);

  const blocks = useMemo(() => {
    const nextBlocks: BlockCell[] = [];
    const lonSpan = mapMask ? mapMask.lonMax - mapMask.lonMin : 136 - 73;
    const latSpan = mapMask ? mapMask.latMax - mapMask.latMin : 54 - 17;

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const xRatio = (col + 0.5) / GRID_COLS;
        const yRatio = (row + 0.5) / GRID_ROWS;
        const lon = (mapMask?.lonMin ?? 73) + xRatio * lonSpan;
        const lat = (mapMask?.latMax ?? 54) - yRatio * latSpan;
        const nearestNode = getNearestCityNode(xRatio, yRatio, projectedCityNodes);
        const articleCount = cityArticleCounts[nearestNode.city] ?? 0;
        const isInsideMap = isInsideChinaMap(lon, lat, mapMask);
        nextBlocks.push({
          id: `${col}-${row}`,
          col,
          row,
          city: nearestNode.city,
          label: nearestNode.label,
          count: articleCount,
          isInsideMap,
        });
      }
    }
    return nextBlocks;
  }, [cityArticleCounts, mapMask, projectedCityNodes]);

  const maxArticleCount = useMemo(
    () =>
      blocks.reduce(
        (currentMax, block) => Math.max(currentMax, block.count),
        0,
      ),
    [blocks],
  );

  if (level === "nearby") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            {nearbyCityName ? `${nearbyCityName} 附近城市 Digest` : "附近城市 Digest"}
          </p>
          <button
            type="button"
            onClick={() => {
              setLevel("overview");
              setActiveCity(null);
            }}
            className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            返回方块地图
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {nearbyLoading ? (
            <p className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              Loading nearby city digests...
            </p>
          ) : nearbyCityDigests.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              暂无可展示的附近城市 digest。
            </p>
          ) : (
            nearbyCityDigests.map((digest) => (
              <article key={digest.city} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <p className="font-semibold text-slate-800">{digest.city}</p>
                <p className="mt-1 text-slate-600">Articles: {digest.articleCount}</p>
                <p className="mt-1 text-slate-500">
                  Topics: {digest.topics.join(", ") || "None"}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div
          className="grid gap-px rounded-lg bg-slate-100 p-1"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
        >
          {blocks.map((block) => {
            const isActive = activeCity === block.city;
            return (
              <button
                key={block.id}
                type="button"
                title={
                  `${block.label} · ${block.count} 篇文章`
                }
                onMouseEnter={() => setHoveredBlock(block)}
                onFocus={() => setHoveredBlock(block)}
                onMouseLeave={() => setHoveredBlock(null)}
                onBlur={() => setHoveredBlock(null)}
                onClick={() => {
                  setActiveCity(block.city);
                  setLevel("nearby");
                  onCitySelectAction(block.city, nearbyCityByName.get(block.city) ?? []);
                }}
                className="aspect-square rounded-[2px] transition-transform hover:scale-125 focus:scale-125"
                style={{
                  backgroundColor: getBlockColor(
                    block.count,
                    maxArticleCount,
                    isActive,
                    block.isInsideMap,
                  ),
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <p>长方形主干视图。点击方块查看该城市与附近城市 digest。</p>
        <p>
          {hoveredBlock
            ? `${hoveredBlock.label}: ${hoveredBlock.count}`
            : "Hover any block"}
        </p>
      </div>
      {statusMessage ? <p className="text-xs text-slate-500">{statusMessage}</p> : null}
    </div>
  );
}
