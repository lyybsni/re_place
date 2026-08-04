"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";

type RegionLevel = "country" | "province";

type EChartsClickParams = {
  name?: string;
};

type EChartsGeoJson = {
  type: "FeatureCollection";
  features: any[];
  [key: string]: unknown;
};

const PROVINCE_NAME_TO_FILE: Record<string, string> = {
  北京: "beijing",
  天津: "tianjin",
  上海: "shanghai",
  重庆: "chongqing",
  河北: "hebei",
  河南: "henan",
  云南: "yunnan",
  辽宁: "liaoning",
  黑龙江: "heilongjiang",
  湖南: "hunan",
  安徽: "anhui",
  山东: "shandong",
  新疆: "xinjiang",
  江苏: "jiangsu",
  浙江: "zhejiang",
  江西: "jiangxi",
  湖北: "hubei",
  广西: "guangxi",
  甘肃: "gansu",
  山西: "shanxi",
  内蒙古: "neimenggu",
  陕西: "shanxi1",
  吉林: "jilin",
  福建: "fujian",
  贵州: "guizhou",
  广东: "guangdong",
  青海: "qinghai",
  西藏: "xizang",
  四川: "sichuan",
  宁夏: "ningxia",
  海南: "hainan",
  台湾: "taiwan",
  香港: "xianggang",
  澳门: "aomen",
};

const CITY_CN_TO_EN: Record<string, string> = {
  北京: "Beijing",
  上海: "Shanghai",
  杭州: "Hangzhou",
  成都: "Chengdu",
  广州: "Guangzhou",
  深圳: "Shenzhen",
  南京: "Nanjing",
  苏州: "Suzhou",
  武汉: "Wuhan",
  西安: "Xi'an",
  重庆: "Chongqing",
  天津: "Tianjin",
};

function normalizeCityName(cityName: string): string {
  return cityName.replace(/(市|地区|盟|自治州|特别行政区)$/u, "").trim();
}

async function loadProvinceGeoJson(
  provinceFile: string,
): Promise<EChartsGeoJson> {
  return loadGeoJsonFromMirrors(`province/${provinceFile}.json`);
}

const MAP_JSON_MIRRORS = [
  "https://fastly.jsdelivr.net/npm/echarts@4.9.0/map/json",
  "https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json",
  "https://unpkg.com/echarts@4.9.0/map/json",
];

async function loadGeoJsonFromMirrors(
  path: string,
): Promise<EChartsGeoJson> {
  const errors: string[] = [];
  for (const baseUrl of MAP_JSON_MIRRORS) {
    const mapUrl = `${baseUrl}/${path}`;
    try {
      const response = await fetch(mapUrl);
      if (!response.ok) {
        errors.push(`${mapUrl} (${response.status})`);
        continue;
      }
      const geoJson = (await response.json()) as {
        type?: string;
        features?: any[];
        [key: string]: unknown;
      };
      if (geoJson.type !== "FeatureCollection" || !Array.isArray(geoJson.features)) {
        errors.push(`${mapUrl} (invalid geojson)`);
        continue;
      }
      return geoJson as EChartsGeoJson;
    } catch {
      errors.push(`${mapUrl} (network error)`);
    }
  }
  throw new Error(`地图数据加载失败：${errors.join(" | ")}`);
}

type ChinaDrilldownMapProps = {
  onCitySelectAction: (city: string) => void;
};

export default function ChinaDrilldownMap({
  onCitySelectAction,
}: ChinaDrilldownMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [level, setLevel] = useState<RegionLevel>("country");
  const [provinceName, setProvinceName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!containerRef.current || chartRef.current) {
      return;
    }

    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;

    function handleResize() {
      chart.resize();
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    const chartInstance: echarts.ECharts = chart;

    let cancelled = false;

    async function renderMap() {
      try {
        if (level === "country") {
          if (!echarts.getMap("china")) {
            const chinaMap = await loadGeoJsonFromMirrors("china.json");
            if (cancelled) {
              return;
            }
            echarts.registerMap("china", chinaMap);
          }

          if (cancelled) {
            return;
          }

          chartInstance.setOption(
            {
              tooltip: { trigger: "item" },
              series: [
                {
                  type: "map",
                  map: "china",
                  roam: true,
                  label: { show: false },
                  itemStyle: {
                    areaColor: "#dbeafe",
                    borderColor: "#4f46e5",
                    borderWidth: 1,
                  },
                  emphasis: {
                    itemStyle: { areaColor: "#bfdbfe" },
                    label: { show: false },
                  },
                },
              ],
            },
            true,
          );
          return;
        }

        if (!provinceName) {
          return;
        }

        const provinceFile = PROVINCE_NAME_TO_FILE[provinceName];
        if (!provinceFile) {
          setStatusMessage(`暂不支持省份：${provinceName}`);
          return;
        }

        const provinceMapName = `province-${provinceName}`;
        if (!echarts.getMap(provinceMapName)) {
          const provinceMap = await loadProvinceGeoJson(provinceFile);
          if (cancelled) {
            return;
          }
          echarts.registerMap(provinceMapName, provinceMap);
        }

        if (cancelled) {
          return;
        }

        chartInstance.setOption(
          {
            tooltip: { trigger: "item" },
            series: [
              {
                type: "map",
                map: provinceMapName,
                roam: true,
                label: { show: true, color: "#334155", fontSize: 11 },
                itemStyle: {
                  areaColor: "#e2e8f0",
                  borderColor: "#64748b",
                  borderWidth: 0.8,
                },
                emphasis: {
                  itemStyle: { areaColor: "#cbd5e1" },
                  label: { show: true },
                },
              },
            ],
          },
          true,
        );
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "地图加载失败，请稍后重试。",
        );
      }
    }

    void renderMap();

    return () => {
      cancelled = true;
    };
  }, [level, provinceName]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    chart.off("click");
    chart.on("click", (params: EChartsClickParams) => {
      const rawName = params.name?.trim();
      if (!rawName) {
        return;
      }

      if (level === "country") {
        if (!PROVINCE_NAME_TO_FILE[rawName]) {
          setStatusMessage(`暂不支持省份：${rawName}`);
          return;
        }
        setProvinceName(rawName);
        setLevel("province");
        setStatusMessage(`已进入 ${rawName}，可继续点击市级区域查看 digest。`);
        return;
      }

      const normalizedName = normalizeCityName(rawName);
      const mappedCity = CITY_CN_TO_EN[normalizedName];
      if (mappedCity) {
        onCitySelectAction(mappedCity);
        setStatusMessage(`已选择城市：${rawName}`);
        return;
      }

      onCitySelectAction(normalizedName);
      setStatusMessage(`城市 ${rawName} 暂无英文映射，已按原名称查询。`);
    });
  }, [level, onCitySelectAction]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="h-[360px] w-full rounded-xl bg-slate-100" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          {level === "country"
            ? "点击省份进入市级地图。"
            : `${provinceName ?? "当前省份"} / 点击城市加载 digest。`}
        </p>
        {level === "province" ? (
          <button
            type="button"
            onClick={() => {
              setLevel("country");
              setProvinceName(null);
              setStatusMessage("已返回全国地图。");
            }}
            className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            返回全国
          </button>
        ) : null}
      </div>
      {statusMessage ? <p className="text-xs text-slate-500">{statusMessage}</p> : null}
    </div>
  );
}
