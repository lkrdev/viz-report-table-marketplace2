import React, {
  useCallback,
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

  useEffect(() => {
    setLocalConfigOverrides({});
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

  // ponytail: Memoize VisPluginTableModel on structural inputs only so view/collapse/theme updates skip model & D3 table rebuild
  const dataTable = useMemo(() => {
    return new VisPluginTableModel(data, queryResponse, effectiveConfig);
  }, [data, queryResponse, structuralSignature]);

  dataTable.config = effectiveConfig;

  const updateConfigRef = useRef(updateConfig);
  updateConfigRef.current = updateConfig;

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const applyConfigUpdate = useCallback((newConfig: Partial<VisConfig>) => {
    setLocalConfigOverrides((prev) => ({ ...prev, ...newConfig }));
    updateConfigRef.current(newConfig);
  }, []);

  const lastRegisteredOptionsSigRef = useRef<string>("");
  useEffect(() => {
    const opts = dataTable.getConfigOptions();
    const sig = JSON.stringify(opts);
    if (sig !== lastRegisteredOptionsSigRef.current) {
      lastRegisteredOptionsSigRef.current = sig;
      registerOptions(opts);
    }
  }, [dataTable, registerOptions]);

  const prevDataTableRef = useRef<VisPluginTableModel | null>(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    (rootRef.current as any)._isReactManaged = true;
    const stylesPromise = loadThemeStyles(effectiveConfig, rootRef.current);

    if (
      prevDataTableRef.current !== dataTable ||
      !rootRef.current.querySelector("#reportTable")
    ) {
      prevDataTableRef.current = dataTable;
      buildReportTable(
        effectiveConfig,
        dataTable,
        (newOrder: Record<string, number>) =>
          applyConfigUpdate({ columnOrder: newOrder }),
        applyConfigUpdate,
        rootRef.current,
        stylesPromise,
      ).then(() => onDoneRef.current?.());
    } else {
      applyCollapsedConfigToRows(rootRef.current, effectiveConfig, dataTable);
      if (stylesPromise && typeof stylesPromise.then === "function") {
        stylesPromise.then(() => onDoneRef.current?.());
      } else {
        onDoneRef.current?.();
      }
    }
  }, [
    dataTable,
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
