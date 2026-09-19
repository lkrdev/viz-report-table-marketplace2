export interface VisConfig {
  theme?: string;
  customTheme?: string;
  layout?: string;
  bodyFontSize?: number;
  headerFontSize?: number;
  showHighlight?: boolean;
  showTooltip?: boolean;
  freezeTableHeaders?: boolean;
  freezeColumns?: number | string;
  rowSubtotals?: boolean;
  allowSubtotalToggle?: boolean;
  hideSubtotals?: boolean;
  subtotalDepth?: string | number;
  subtotalStyle?: string;
  subtotal_style?: string;
  subtotalsOnTop?: boolean;
  startFolded?: boolean;
  collapsedSubtotals?: string;
  expandSubtotals?: string;
  arrowStyle?: string;
  arrow_style?: string;
  exposeDownloadLink?: boolean;
  transposeTable?: boolean;
  columnOrder?: Record<string, number>;
  clientSorts?: Array<{ name: string; desc: boolean }>;
  [key: string]: any;
}

export interface QueryResponseField {
  name: string;
  label?: string;
  label_short?: string;
  view_label?: string;
  is_numeric?: boolean;
  is_table_calculation?: boolean;
  is_turtle?: boolean;
  type?: string;
  value_format?: string;
  tags?: string[];
  isNull?: boolean;
  [key: string]: any;
}

export interface QueryResponse {
  fields?: {
    dimension_like?: QueryResponseField[];
    measure_like?: QueryResponseField[];
    dimensions?: QueryResponseField[];
    measures?: QueryResponseField[];
    table_calculations?: QueryResponseField[];
    pivots?: QueryResponseField[];
  };
  data?: any[];
  pivots?: any[];
  has_totals?: boolean;
  has_row_totals?: boolean;
  [key: string]: any;
}

export interface DataCell {
  id: string | null;
  value: any;
  rendered: string | null;
  html: string | null;
  links: any[];
  cell_style: string[];
  align: string;
  rowspan: number;
  colspan: number;
  colid: string;
  rowid: string;
  depthIndex?: number;
}

export interface Row {
  id: string;
  hide: boolean;
  type: 'line_item' | 'subtotal' | 'total' | string;
  sort: any[];
  data: Record<string, DataCell>;
  depthIndex?: number;
}

export interface HeaderCell {
  id: string;
  column: Column;
  type: string;
  colspan: number;
  rowspan: number;
  headerRow: boolean;
  cell_style: string[];
  label: string | null;
  align: string;
  modelField: QueryResponseField;
  pivotData: Record<string, any>;
}

export interface Column {
  id: string;
  idx: number;
  pos: number;
  levels: HeaderCell[];
  pivot_key: string;
  pivot_index?: number;
  unit: string;
  hide: boolean;
  isVariance: boolean;
  variance_type: string | null;
  pivoted: boolean;
  isRowTotal: boolean;
  super: boolean;
  subtotal: boolean;
  isDimension?: boolean;
  modelField: QueryResponseField;
  getHeaderCellLabel(level: number): string;
  getHeaderCellLabelByType(type: string): string | null;
}

export class VisPluginTableModel {
  constructor(data: any[], queryResponse: QueryResponse, config: VisConfig);
  static getCoreConfigOptions(): Record<string, any>;
  getConfigOptions(): Record<string, any>;
  getHeaderTiers(): any[];
  getTableHeaderCells(levelIndex: number): Column[];
  getTableColumnGroups(): Array<Array<{ id: string; type: string }>>;
  getDataRows(): Row[];
  getTableRowColumns(row: Row): Column[];
  getEffectiveFreezeColumns(): number;
  getCellToolTip(rowid: string, colid: string): string;
  getActiveSorts(): Array<{ name: string; desc: boolean }>;
  clientSort(sortId: string, shiftKey?: boolean): void;
  sortData(): void;
  sortColumns(): void;
  moveColumns(movingIdx: number, targetIdx: number, updateColumnOrder?: (newOrder: Record<string, number>) => void): void;

  columns: Column[];
  dimensions: QueryResponseField[];
  pivot_fields: QueryResponseField[];
  data: Row[];
  transposed_data: Row[];
  headers: Array<{ type: string }>;
  column_series: Array<{ column: Column; series: { values: any[] } }>;
  has_pivots: boolean;
  hasSubtotals: boolean;
  subtotalsOnTop: boolean;
  subtotalStyle: string;
  subtotalDepth: string | number;
  useIndexColumn: boolean;
  firstVisibleDimension: string;
  minWidthForIndexColumns: boolean;
  transposeTable: boolean;
  showHighlight: boolean;
  showTooltip: boolean;
  sortColsBy: string;
  clientSorts: Array<{ name: string; desc: boolean }>;
  sorts: Array<{ name: string; desc: boolean }>;
}

export const INDEX_COLUMN: string;

export function getHeaderCellSortInfo(d: HeaderCell, dataTable: VisPluginTableModel): {
  sortId: string;
  sortIndex: number;
  sortObj: { name: string; desc: boolean } | null;
  points: string | null;
};

export function computeColumnTextWidths(dataTable: VisPluginTableModel, config: VisConfig): Record<string, number>;
export function getTextWidth(text: string, font?: string, defaultFontSize?: number): number;
export function applyStickyStyles(element: HTMLElement, config: VisConfig, dataTable: VisPluginTableModel): void;
export function applyStickyHeaders(element: HTMLElement, config: VisConfig, dataTable: VisPluginTableModel): void;
export function applyStickyColumns(element: HTMLElement, config: VisConfig, dataTable: VisPluginTableModel): void;
export function updateRowIcon(rowEl: HTMLElement, config: VisConfig): void;
export function syncRowVisibility(
  element: HTMLElement,
  config: VisConfig,
  dataTable: VisPluginTableModel,
  callbacks?: { updateConfig?: (newConfig: Partial<VisConfig>) => void },
  skipUpdateConfig?: boolean
): void;
export function buildReportTable(
  config: VisConfig,
  dataTable: VisPluginTableModel,
  updateColumnOrder: (newOrder: Record<string, number>) => void,
  updateConfig: (newConfig: Partial<VisConfig>) => void,
  element: HTMLElement,
  stylesLoadedPromise?: Promise<void> | null
): Promise<void>;
export function applyCollapsedConfigToRows(
  element: HTMLElement,
  config: VisConfig,
  dataTable: VisPluginTableModel
): void;
export function renderFloatingActionBar(
  element: HTMLElement,
  config: VisConfig,
  dataTable: VisPluginTableModel,
  callbacks?: {
    updateConfig?: (newConfig: Partial<VisConfig>) => void;
    redraw?: () => void;
  }
): void;
export function handleCellHoverAndTooltip(
  action: 'enter' | 'move' | 'leave',
  d: DataCell,
  event: any,
  rootEl: HTMLElement | null,
  tooltipEl: HTMLElement | null,
  dataTable: VisPluginTableModel
): void;
export function attachStandaloneTableRunner(plugin: any): void;
export function loadThemeStyles(config: VisConfig, element?: HTMLElement | null): Promise<void> | null;
export function removeStyles(): void;
export function downloadTableAsExcel(element: HTMLElement): Promise<string | null>;
export function getTableExcelDataUrl(element: HTMLElement): string | null;
export const visPlugin: Record<string, any>;
