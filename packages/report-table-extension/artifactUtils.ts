import { VisConfig } from "report-table-react";

const DEFAULT_CONFIG_VALUES: Record<string, any> = {
  hideSubtotals: false,
  collapsedSubtotals: "",
  expandSubtotals: "",
  clientSorts: [],
  columnOrder: {},
};

const TRANSIENT_OVERRIDE_KEYS = new Set(["hasUserEdits", "resetUserEdits"]);

export function computeConfigDiff(
  base: VisConfig,
  overrides: Partial<VisConfig>,
): Partial<VisConfig> {
  const diff: Partial<VisConfig> = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (TRANSIENT_OVERRIDE_KEYS.has(k) || v === undefined) continue;
    const baseVal = base[k] !== undefined ? base[k] : DEFAULT_CONFIG_VALUES[k];
    if (JSON.stringify(v) !== JSON.stringify(baseVal)) {
      diff[k] = v;
    }
  }
  return diff;
}

export function normalizeFilterValue(val: any): string {
  if (val === null || val === undefined) return "";
  return typeof val === "string" ? val : JSON.stringify(val);
}

export function areFilterValuesEqual(a: any, b: any): boolean {
  return normalizeFilterValue(a) === normalizeFilterValue(b);
}

export function serializeFilters(filters: Record<string, any>): string {
  return JSON.stringify(
    Object.keys(filters)
      .sort()
      .map((k) => [k, normalizeFilterValue(filters[k])]),
  );
}

export function parseArtifactRecord(record: any): Record<string, any> {
  if (!record?.value) return {};
  const parsed =
    typeof record.value === "string" ? JSON.parse(record.value) : record.value;
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function computeFilterDiff(
  baseFilters: Record<string, any>,
  currentFilters: Record<string, any>,
): Record<string, any> {
  const diff: Record<string, any> = {};
  for (const [k, v] of Object.entries(currentFilters)) {
    if (v === undefined) continue;
    if (!areFilterValuesEqual(v, baseFilters[k])) {
      diff[k] = v;
    }
  }
  return diff;
}

export function applyFiltersToHost(
  tileSDK: any,
  filtersToApply: Record<string, any>,
  currentFilters?: Record<string, any>,
  requireExistingKey = false,
) {
  if (!tileSDK?.updateFilters) return;
  const changedOnly: Record<string, any> = {};
  for (const [k, v] of Object.entries(filtersToApply)) {
    if (v === undefined) continue;
    if (requireExistingKey && currentFilters && !(k in currentFilters)) {
      continue;
    }
    if (currentFilters && areFilterValuesEqual(currentFilters[k], v)) {
      continue;
    }
    changedOnly[k] = v;
  }
  const keys = Object.keys(changedOnly);
  if (keys.length === 0) return;
  if (keys.length === 1 || typeof tileSDK.runDashboard !== "function") {
    tileSDK.updateFilters(changedOnly, true);
  } else {
    tileSDK.updateFilters(changedOnly, false);
    tileSDK.runDashboard();
  }
}
