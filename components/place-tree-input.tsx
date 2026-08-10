"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CHINA_CITIES_BY_PROVINCE } from "@/lib/china-locations";

type PlaceTreeInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function PlaceTreeInput({ value, onChange, placeholder }: PlaceTreeInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const provinces = useMemo(
    () =>
      Object.entries(CHINA_CITIES_BY_PROVINCE).map(([province, cities]) => ({
        province,
        cities,
      })),
    [],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery(value);
    }
  }, [isOpen, value]);

  const filteredProvinces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return provinces;
    }

    return provinces
      .map(({ province, cities }) => {
        const provinceMatch = province.toLowerCase().includes(normalizedQuery);
        const matchedCities = cities.filter((city) => city.toLowerCase().includes(normalizedQuery));
        return {
          province,
          cities: provinceMatch ? cities : matchedCities,
          expanded: provinceMatch || matchedCities.length > 0,
        };
      })
      .filter((item) => item.expanded);
  }, [provinces, query]);

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
      />

      {isOpen ? (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="sticky top-0 bg-white pb-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search province or city"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="space-y-1">
            {filteredProvinces.length > 0 ? (
              filteredProvinces.map(({ province, cities }) => (
                <div key={province} className="rounded-xl border border-slate-100 bg-slate-50/70">
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(province);
                      setQuery(province);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-indigo-50"
                  >
                    <span>{province}</span>
                    <span className="text-xs text-slate-500">Province</span>
                  </button>
                  {cities.length > 0 ? (
                    <div className="border-t border-slate-200/70 py-1">
                      {cities.map((city) => (
                        <button
                          key={city}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            onChange(city);
                            setQuery(city);
                            setIsOpen(false);
                          }}
                          className="flex w-full items-center justify-between px-5 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50"
                        >
                          <span>{city}</span>
                          <span className="text-xs text-slate-500">City</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-slate-500">No matching locations.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
