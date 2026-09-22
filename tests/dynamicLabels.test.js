import { VisPluginTableModel } from '../src/vis_table_plugin';
const fixtures = require('./fixtures.json');

const parseJsonBi = (fixture, defaultSorts = []) => {
  const clonedFixture = JSON.parse(JSON.stringify(fixture));
  const metadata = {
    ...clonedFixture.metadata,
    fields: {
      ...clonedFixture.metadata.fields,
      dimension_like: clonedFixture.metadata.fields.dimensions || [],
      measure_like: [
        ...(clonedFixture.metadata.fields.measures || []),
        ...(clonedFixture.metadata.fields.table_calculations || [])
      ],
      pivots: clonedFixture.metadata.fields.pivots || []
    },
    pivots: (clonedFixture.metadata.pivots || []).map(p => ({
      ...p,
      metadata: p.metadata || Object.fromEntries(
        Object.entries(p.data || {}).map(([k, v]) => [k, typeof v === 'object' && v !== null ? v : { value: v }])
      )
    })),
    sorts: (clonedFixture.metadata.sorts || clonedFixture.sorts || defaultSorts).map(s => {
      if (typeof s === 'object' && s !== null) return s;
      const parts = String(s).trim().split(/\s+/);
      return {
        name: parts[0],
        desc: parts.length > 1 && parts[1].toLowerCase() === 'desc'
      };
    })
  };
  return { rows: clonedFixture.rows, metadata };
};

describe('Dynamic label and config option handling', () => {
  it('registers label config options with empty default strings and proper placeholders', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    const model = new VisPluginTableModel(rows, metadata, {});
    const options = model.getConfigOptions();

    expect(options['label|history.created_month']).toBeDefined();
    expect(options['label|history.created_month'].default).toBe('');
    expect(options['label|history.created_month'].placeholder).toBe('History Created Month');
  });

  it('displays dynamic label from queryResponse when label config is empty or undefined', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    // Simulate dynamic label update by Looker (e.g. via label_from_parameter)
    metadata.fields.dimension_like[0].label = 'Dynamically Updated Month Label';
    
    // Simulate Looker passing an empty or untouched config
    const model = new VisPluginTableModel(rows, metadata, {
      'label|history.created_month': ''
    });

    const column = model.columns.find(c => c.id === 'history.created_month');
    expect(column).toBeDefined();

    // The lowest level cell in dimension column is the field label
    const fieldHeaderCell = column.levels.find(l => l.type === 'field');
    expect(fieldHeaderCell).toBeDefined();
    expect(fieldHeaderCell.label).toBe('Dynamically Updated Month Label');
  });

  it('respects user configured label overrides in config', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    metadata.fields.dimension_like[0].label = 'Original LookML Label';
    
    const model = new VisPluginTableModel(rows, metadata, {
      'label|history.created_month': 'User Custom Header Override'
    });

    const column = model.columns.find(c => c.id === 'history.created_month');
    const fieldHeaderCell = column.levels.find(l => l.type === 'field');
    expect(fieldHeaderCell.label).toBe('User Custom Header Override');
  });

  it('dynamically hides customTheme unless theme is set to custom', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);

    const defaultModel = new VisPluginTableModel(rows, metadata, {});
    expect(defaultModel.getConfigOptions().customTheme.hidden).toBe(true);

    const customThemeModel = new VisPluginTableModel(rows, metadata, { theme: 'custom' });
    expect(customThemeModel.getConfigOptions().customTheme.hidden).toBe(false);
    expect(VisPluginTableModel.getCoreConfigOptions().customTheme.hidden).toBe(true);

    const lookerThemeModel = new VisPluginTableModel(rows, metadata, { theme: 'looker' });
    expect(lookerThemeModel.getConfigOptions().customTheme.hidden).toBe(true);
  });

  it('places Theme options under section "Theme" and disables allowDimensionOrder and allowMeasureOrder (display_size: "half") via disabledReason unless allowUserEdits is enabled', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);

    const defaultModel = new VisPluginTableModel(rows, metadata, {});
    const defaultOpts = defaultModel.getConfigOptions();
    expect(defaultOpts.theme.section).toBe('Theme');
    expect(defaultOpts.allowUserEdits.section).toBe('Theme');
    expect(defaultOpts.allowDimensionOrder.section).toBe('Theme');
    expect(defaultOpts.allowDimensionOrder.display_size).toBe('half');
    expect(defaultOpts.allowDimensionOrder.disabled).toBe(true);
    expect(defaultOpts.allowDimensionOrder.disabledReason({})).toBe('Requires "Allow User Edits" to be enabled.');
    expect(defaultOpts.allowMeasureOrder.section).toBe('Theme');
    expect(defaultOpts.allowMeasureOrder.display_size).toBe('half');
    expect(defaultOpts.allowMeasureOrder.disabled).toBe(true);
    expect(defaultOpts.allowMeasureOrder.disabledReason({})).toBe('Requires "Allow User Edits" to be enabled.');

    const editsEnabledModel = new VisPluginTableModel(rows, metadata, { allowUserEdits: true });
    const enabledOpts = editsEnabledModel.getConfigOptions();
    expect(enabledOpts.allowDimensionOrder.disabled).toBe(false);
    expect(enabledOpts.allowDimensionOrder.disabledReason({ allowUserEdits: true, rowSubtotals: true, allowSubtotalToggle: true })).toBeUndefined();
    expect(enabledOpts.allowMeasureOrder.disabled).toBe(false);
    expect(enabledOpts.allowMeasureOrder.disabledReason({ allowUserEdits: true })).toBeUndefined();
  });

  it('reorders dimensions (when allowDimensionOrder is on and rowSubtotals is off) and measures (when allowMeasureOrder is on) independently', () => {
    const rows = [
      {
        'd1': { value: 'A', rendered: 'A' },
        'd2': { value: 'B', rendered: 'B' },
        'm1': { value: 10, rendered: '10' },
        'm2': { value: 20, rendered: '20' },
      },
    ];
    const metadata = {
      fields: {
        dimension_like: [
          { name: 'd1', label: 'Dim 1' },
          { name: 'd2', label: 'Dim 2' },
        ],
        measure_like: [
          { name: 'm1', label: 'Meas 1', is_numeric: true },
          { name: 'm2', label: 'Meas 2', is_numeric: true },
        ],
        pivots: [],
      },
      sorts: [],
    };

    const reorderedModel = new VisPluginTableModel(rows, metadata, {
      allowUserEdits: true,
      allowDimensionOrder: true,
      allowMeasureOrder: true,
      rowSubtotals: false,
      columnOrder: { d1: 10, d2: 0, m1: 10, m2: 0 },
    });
    expect(reorderedModel.columns.filter(c => !c.hide).map(c => c.id)).toEqual(['d2', 'd1', 'm2', 'm1']);
    expect(reorderedModel.firstVisibleDimension).toBe('d2');

    // Measure-only toggle reorders measures while leaving dimensions untouched even if rowSubtotals is false
    const measureOnlyModel = new VisPluginTableModel(rows, metadata, {
      allowUserEdits: true,
      allowDimensionOrder: false,
      allowMeasureOrder: true,
      rowSubtotals: false,
      columnOrder: { d1: 10, d2: 0, m1: 10, m2: 0 },
    });
    expect(measureOnlyModel.columns.filter(c => !c.hide).map(c => c.id)).toEqual(['d1', 'd2', 'm2', 'm1']);

    // When rowSubtotals is true, dimensions stay in original order while measures still reorder
    const subtotalModel = new VisPluginTableModel(rows, metadata, {
      allowUserEdits: true,
      allowDimensionOrder: true,
      allowMeasureOrder: true,
      rowSubtotals: true,
      columnOrder: { d1: 10, d2: 0, m1: 10, m2: 0 },
    });
    expect(subtotalModel.columns.filter(c => !c.hide).map(c => c.id)).toEqual(['d1', 'd2', 'm2', 'm1']);

    // When pivoted, measure columnOrder reorders measures across all pivot groups
    const pivotedRows = [
      {
        'd1': { value: 'A', rendered: 'A' },
        'm1': { '2024': { value: 1, rendered: '1' }, '2025': { value: 2, rendered: '2' } },
        'm2': { '2024': { value: 10, rendered: '10' }, '2025': { value: 20, rendered: '20' } },
      },
    ];
    const pivotedMetadata = {
      fields: {
        dimension_like: [{ name: 'd1', label: 'Dim 1' }],
        measure_like: [
          { name: 'm1', label: 'Meas 1', is_numeric: true },
          { name: 'm2', label: 'Meas 2', is_numeric: true },
        ],
        pivots: [{ name: 'year', label: 'Year' }],
      },
      pivots: [
        { key: '2024', data: { year: '2024' }, sort_values: { year: '2024' }, metadata: { year: { value: '2024' } } },
        { key: '2025', data: { year: '2025' }, sort_values: { year: '2025' }, metadata: { year: { value: '2025' } } },
      ],
      sorts: [{ name: 'year', desc: false }],
    };
    const pivotedModel = new VisPluginTableModel(pivotedRows, pivotedMetadata, {
      allowUserEdits: true,
      allowMeasureOrder: true,
      columnOrder: { m1: 10, m2: 0 },
    });
    expect(pivotedModel.columns.filter(c => !c.hide).map(c => c.id)).toEqual([
      'd1',
      '2024.m2',
      '2024.m1',
      '2025.m2',
      '2025.m1',
    ]);
  });
});
