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

describe('Subtotals option bug reproduction', () => {
  it('should generate subtotal rows when rowSubtotals is enabled', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    
    // Add a second dimension
    metadata.fields.dimension_like.push({
      name: 'history.category',
      type: 'string',
      label: 'History Category',
      view: 'history',
      category: 'dimension'
    });

    // Modify rows to have two dimensions and some measure values
    const newRows = [
      {
        'history.created_month': { value: 'Brand A' },
        'history.category': { value: 'Cat 1' },
        'history.count': { value: 10 }
      },
      {
        'history.created_month': { value: 'Brand A' },
        'history.category': { value: 'Cat 2' },
        'history.count': { value: 20 }
      },
      {
        'history.created_month': { value: 'Brand B' },
        'history.category': { value: 'Cat 1' },
        'history.count': { value: 30 }
      },
      {
        'history.created_month': { value: 'Brand B' },
        'history.category': { value: 'Cat 2' },
        'history.count': { value: 40 }
      }
    ];

    const model = new VisPluginTableModel(newRows, metadata, {
      rowSubtotals: true
    });

    const subtotalRows = model.data.filter(r => r.type === 'subtotal');
    expect(subtotalRows.length).toBeGreaterThan(0);
  });
});
