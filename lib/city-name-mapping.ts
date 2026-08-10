import { CHINA_BLOCK_CITY_NODES } from "@/lib/china-block-city-nodes";

const CITY_SUFFIX_REGEX = /(特别行政区|自治州|地区|盟|市|县|区)$/u;

function normalizeCityLookupKey(value: string) {
  return value
    .trim()
    .replace(/[（）()]/g, "")
    .replace(CITY_SUFFIX_REGEX, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "")
    .toLowerCase();
}

const CANONICAL_CITY_BY_KEY = (() => {
  const map = new Map<string, string>();
  for (const node of CHINA_BLOCK_CITY_NODES) {
    map.set(normalizeCityLookupKey(node.city), node.city);
    map.set(normalizeCityLookupKey(node.label), node.city);
    map.set(normalizeCityLookupKey(`${node.label}市`), node.city);
  }

  const extraAliases: Array<[string, string]> = [
    ["xian", "Xi'an"],
    ["xianshi", "Xi'an"],
    ["xianyangshi", "Xianyang"],
    ["wulumuqi", "Urumqi"],
    ["wulumuqishi", "Urumqi"],
  ];

  for (const [alias, canonicalCity] of extraAliases) {
    map.set(normalizeCityLookupKey(alias), canonicalCity);
  }
  return map;
})();

export function toCanonicalCityName(cityInput: string): string | null {
  const key = normalizeCityLookupKey(cityInput);
  if (!key) {
    return null;
  }
  return CANONICAL_CITY_BY_KEY.get(key) ?? null;
}

export function getCanonicalChinaBlockCities() {
  return CHINA_BLOCK_CITY_NODES.map((node) => node.city);
}
