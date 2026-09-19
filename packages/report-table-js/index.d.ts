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

export class VisPluginTableModel {
  constructor(data: any[], queryResponse: QueryResponse, config: VisConfig);
  static getCoreConfigOptions(): Record<string, any>;
  getConfigOptions(): Record<string, any>;
  config: VisConfig;
  [key: string]: any;
}

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

export function attachStandaloneTableRunner(plugin: any): void;
export function loadThemeStyles(config: VisConfig, element?: HTMLElement | null): Promise<void> | null;
export const visPlugin: Record<string, any>;
