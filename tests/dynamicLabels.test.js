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
});
