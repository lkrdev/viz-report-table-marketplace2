import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  VisPluginTableModel,
  VisConfig,
  QueryResponse,
  buildReportTable,
  applyCollapsedConfigToRows,
  loadThemeStyles,
} from 'report-table-js';

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
  'collapsedSubtotals',
  'expandSubtotals',
  'startFolded',
  'freezeTableHeaders',
  'freezeColumns',
  'theme',
  'layout',
  'customTheme',
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
  const [localConfigOverrides, setLocalConfigOverrides] = useState<Partial<VisConfig>>({});
  const prevConfigRef = useRef<VisConfig>({ ...config });

  // Clear local overrides only for keys that changed externally from Looker's sidebar
  useEffect(() => {
    const prev = prevConfigRef.current || {};
    const next = config || {};
    const changedExternalKeys = Object.keys(next).filter((k) => next[k] !== prev[k]);
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
    theme: 'traditional',
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

  const applyConfigUpdate = (newConfig: Partial<VisConfig>) => {
    Object.assign(effectiveConfig, newConfig);
    if ('hideSubtotals' in newConfig) {
      Object.assign(dataTable, new VisPluginTableModel(data, queryResponse, effectiveConfig));
    }
    setLocalConfigOverrides((prev) => ({ ...prev, ...newConfig }));
    prevConfigRef.current = { ...prevConfigRef.current, ...newConfig };
    updateConfig(newConfig);
  };

  useEffect(() => {
    registerOptions(dataTable.getConfigOptions());
  }, [queryResponse, effectiveConfig.theme]);

  // Build table via shared D3 renderer only when dataTable (structural config / data) changes
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const stylesPromise = loadThemeStyles(effectiveConfig);
    buildReportTable(
      effectiveConfig,
      dataTable,
      (newOrder: Record<string, number>) => applyConfigUpdate({ columnOrder: newOrder }),
      applyConfigUpdate,
      rootRef.current,
      stylesPromise
    ).then(() => {
      onDone?.();
    });
  }, [dataTable]);

  // Surgically update existing DOM on view-only changes (collapse/uncollapse, sticky headers/columns, theme) without rebuilding table
  useLayoutEffect(() => {
    if (!rootRef.current || !rootRef.current.querySelector('#reportTable')) return;
    const stylesPromise = loadThemeStyles(effectiveConfig);
    applyCollapsedConfigToRows(rootRef.current, effectiveConfig, dataTable);
    if (stylesPromise && typeof stylesPromise.then === 'function') {
      stylesPromise.then(() => onDone?.());
    } else {
      onDone?.();
    }
  }, [
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
    <div ref={rootRef} style={{ position: 'relative', margin: 0, padding: 0, width: '100%', height: '100%' }}>
      <div id="tooltip" className="hidden" />
      <div id="visContainer" style={{ position: 'relative' }} />
    </div>
  );
};
