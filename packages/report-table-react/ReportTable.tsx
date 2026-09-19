import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  QueryResponse,
  VisConfig,
  VisPluginTableModel,
  applyCollapsedConfigToRows,
  buildReportTable,
  loadThemeStyles,
} from "report-table-js";

export interface ReportTableProps {
  data: any[];
  queryResponse: QueryResponse;
  config?: VisConfig;
  details?: Record<string, any>;
  updateConfig?: (newConfig: Partial<VisConfig>) => void;
  registerOptions?: (options: Record<string, any>) => void;
  onDone?: () => void;
}

const VIEW_ONLY_CONFIG_KEYS = new Set([
  "collapsedSubtotals",
  "expandSubtotals",
  "startFolded",
  "freezeTableHeaders",
  "freezeColumns",
  "theme",
  "layout",
  "customTheme",
]);

function getStructuralConfigSignature(config: VisConfig): string {
  const structural: Record<string, any> = {};
  Object.keys(config || {})
    .sort()
    .forEach((k) => {
      if (!VIEW_ONLY_CONFIG_KEYS.has(k)) {
        structural[k] = config[k];
      }
    });
  return JSON.stringify(structural);
}

export const ReportTable: React.FC<ReportTableProps> = ({
  data,
  queryResponse,
  config = {},
  updateConfig = () => {},
  registerOptions = () => {},
  onDone,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [localConfigOverrides, setLocalConfigOverrides] = useState<
    Partial<VisConfig>
  >({});
  const prevConfigRef = useRef<VisConfig>({ ...config });

  // Clear local overrides only for keys that changed externally from Looker's sidebar
  useEffect(() => {
    const prev = prevConfigRef.current || {};
    const next = config || {};
    const changedExternalKeys = Object.keys(next).filter(
      (k) => next[k] !== prev[k],
    );
    if (changedExternalKeys.length > 0) {
      setLocalConfigOverrides((curr) => {
        const updated = { ...curr };
        changedExternalKeys.forEach((k) => delete updated[k]);
        return updated;
      });
    }
    prevConfigRef.current = { ...next };
  }, [config]);

  const effectiveConfig: VisConfig = {
    bodyFontSize: 12,
    headerFontSize: 12,
    theme: "traditional",
    showHighlight: true,
    showTooltip: true,
    ...config,
    ...localConfigOverrides,
  };

  const structuralSignature = getStructuralConfigSignature(effectiveConfig);

  // Memoize VisPluginTableModel on structural inputs only so view/collapse/theme updates skip model & D3 table rebuild
  const dataTable = useMemo(() => {
    return new VisPluginTableModel(data, queryResponse, effectiveConfig);
  }, [data, queryResponse, structuralSignature]);

  if (dataTable) {
    (dataTable as any).config = effectiveConfig;
  }

  const updateConfigRef = useRef(updateConfig);
  updateConfigRef.current = updateConfig;

  const applyConfigUpdate = React.useCallback((newConfig: Partial<VisConfig>) => {
    setLocalConfigOverrides((prev) => ({ ...prev, ...newConfig }));
    prevConfigRef.current = { ...prevConfigRef.current, ...newConfig };
    updateConfigRef.current(newConfig);
  }, []);

  const lastRegisteredOptionsSigRef = useRef<string>("");
  useEffect(() => {
    const opts = dataTable.getConfigOptions();
    const sig = JSON.stringify(Object.keys(opts));
    if (sig !== lastRegisteredOptionsSigRef.current) {
      lastRegisteredOptionsSigRef.current = sig;
      registerOptions(opts);
    }
  }, [dataTable, registerOptions]);

  const isFullyBuiltRef = useRef(false);

  // Build table via shared D3 renderer only when dataTable (structural config / data) changes
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    (rootRef.current as any)._isReactManaged = true;
    isFullyBuiltRef.current = false;
    const stylesPromise = loadThemeStyles(effectiveConfig, rootRef.current);
    buildReportTable(
      effectiveConfig,
      dataTable,
      (newOrder: Record<string, number>) =>
        applyConfigUpdate({ columnOrder: newOrder }),
      applyConfigUpdate,
      rootRef.current,
      stylesPromise,
    ).then(() => {
      isFullyBuiltRef.current = true;
      onDone?.();
    });
  }, [dataTable]);

  // Surgically update existing DOM on view-only changes (collapse/uncollapse, sticky headers/columns, theme) without rebuilding table
  useLayoutEffect(() => {
    if (!rootRef.current || !rootRef.current.querySelector("#reportTable"))
      return;
    if (!isFullyBuiltRef.current) return;
    const stylesPromise = loadThemeStyles(effectiveConfig, rootRef.current);
    applyCollapsedConfigToRows(rootRef.current, effectiveConfig, dataTable);
    if (stylesPromise && typeof stylesPromise.then === "function") {
      stylesPromise.then(() => onDone?.());
    } else {
      onDone?.();
    }
  }, [
    dataTable,
    onDone,
    effectiveConfig.collapsedSubtotals,
    effectiveConfig.expandSubtotals,
    effectiveConfig.startFolded,
    effectiveConfig.freezeTableHeaders,
    effectiveConfig.freezeColumns,
    effectiveConfig.theme,
    effectiveConfig.layout,
    effectiveConfig.customTheme,
  ]);

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        margin: 0,
        padding: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <div id="tooltip" className="hidden" />
      <div id="visContainer" style={{ position: "relative" }} />
    </div>
  );
};
