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

  it('should split subtotal row dimension colspans according to freezeFirstColumns', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    
    metadata.fields.dimension_like.push({
      name: 'history.category',
      type: 'string',
      label: 'History Category',
      view: 'history',
      category: 'dimension'
    });
    metadata.fields.dimension_like.push({
      name: 'history.status',
      type: 'string',
      label: 'History Status',
      view: 'history',
      category: 'dimension'
    });

    const newRows = [
      {
        'history.created_month': { value: 'Brand A' },
        'history.category': { value: 'Cat 1' },
        'history.status': { value: 'Status 1' },
        'history.count': { value: 10 }
      }
    ];

    const model = new VisPluginTableModel(newRows, metadata, {
      rowSubtotals: true,
      freezeFirstColumns: 2
    });

    const subtotalRows = model.data.filter(r => r.type === 'subtotal');
    expect(subtotalRows.length).toBeGreaterThan(0);
    const subtotalRow = subtotalRows[0];

    expect(subtotalRow.data['history.created_month'].colspan).toBe(2);
    expect(subtotalRow.data['history.category'].colspan).toBe(-1);
    expect(subtotalRow.data['history.status'].colspan).toBe(1);

    expect(subtotalRow.data['history.created_month'].value).toBe('Brand A | Cat 1');
    expect(subtotalRow.data['history.status'].value).toBe('');
  });

  it('should split totals row dimension colspans according to freezeFirstColumns', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    
    metadata.fields.dimension_like.push({
      name: 'history.category',
      type: 'string',
      label: 'History Category',
      view: 'history',
      category: 'dimension'
    });
    metadata.fields.dimension_like.push({
      name: 'history.status',
      type: 'string',
      label: 'History Status',
      view: 'history',
      category: 'dimension'
    });

    const newRows = [
      {
        'history.created_month': { value: 'Brand A' },
        'history.category': { value: 'Cat 1' },
        'history.status': { value: 'Status 1' },
        'history.count': { value: 10 }
      }
    ];

    metadata.totals_data = {
      'history.count': { value: 10 }
    };

    const model = new VisPluginTableModel(newRows, metadata, {
      freezeFirstColumns: 2
    });

    const totalRow = model.data.find(r => r.type === 'total');
    expect(totalRow).toBeDefined();

    expect(totalRow.data['history.created_month'].colspan).toBe(2);
    expect(totalRow.data['history.category'].colspan).toBe(-1);
    expect(totalRow.data['history.status'].colspan).toBe(1);
  });

  it('should maintain single subtotal per group when rows are interleaved by measure sort', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month, [{ name: 'history.count', desc: true }]);
    
    delete metadata.pivots;
    metadata.fields.pivots = [];
    metadata.fields.dimension_like.push({
      name: 'history.category',
      type: 'string',
      label: 'History Category',
      view: 'history',
      category: 'dimension'
    });

    const interleavedRows = [
      {
        'history.created_month': { value: 'France' },
        'history.category': { value: 'Womens' },
        'history.count': { value: 272 }
      },
      {
        'history.created_month': { value: 'UK' },
        'history.category': { value: 'Mens' },
        'history.count': { value: 245 }
      },
      {
        'history.created_month': { value: 'France' },
        'history.category': { value: 'Mens' },
        'history.count': { value: 239 }
      }
    ];

    const model = new VisPluginTableModel(interleavedRows, metadata, {
      rowSubtotals: true,
      subtotalDepth: '1'
    });

    const subtotalRows = model.data.filter(r => r.type === 'subtotal');
    expect(subtotalRows.length).toBe(2);
    expect(subtotalRows.map(r => r.data['history.created_month'].value)).toEqual(['France', 'UK']);

    const franceSubtotal = subtotalRows.find(r => r.data['history.created_month'].value === 'France');
    expect(franceSubtotal).toBeDefined();
    expect(franceSubtotal.data['history.count'].value).toBe(511);
  });

  it('should position subtotals on top when subtotalsOnTop option is true', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    
    metadata.fields.dimension_like.push({
      name: 'history.category',
      type: 'string',
      label: 'History Category',
      view: 'history',
      category: 'dimension'
    });
    metadata.fields.dimension_like.push({
      name: 'history.status',
      type: 'string',
      label: 'History Status',
      view: 'history',
      category: 'dimension'
    });

    const multiLevelRows = [
      {
        'history.created_month': { value: 'France' },
        'history.category': { value: 'Europe' },
        'history.status': { value: 'Accessories' },
        'history.count': { value: 100 }
      },
      {
        'history.created_month': { value: 'France' },
        'history.category': { value: 'Europe' },
        'history.status': { value: 'Clothing' },
        'history.count': { value: 200 }
      }
    ];

    const modelBottom = new VisPluginTableModel(multiLevelRows, metadata, {
      rowSubtotals: true,
      subtotalDepth: '(all)',
      subtotalsOnTop: false
    });

    const labelsBottom = modelBottom.data.map(r => {
      if (r.type === 'subtotal') return r.id;
      return `${r.data['history.created_month']?.value} | ${r.data['history.category']?.value} | ${r.data['history.status']?.value}`;
    });

    // Expect line items first, then subtotal depth 1, then subtotal depth 0
    expect(labelsBottom).toEqual([
      'France | Europe | Accessories',
      'France | Europe | Clothing',
      'Subtotal|France|Europe',
      'Subtotal|France'
    ]);

    const modelTop = new VisPluginTableModel(multiLevelRows, metadata, {
      rowSubtotals: true,
      subtotalDepth: '(all)',
      subtotalsOnTop: true
    });

    const labelsTop = modelTop.data.map(r => {
      if (r.type === 'subtotal') return r.id;
      return `${r.data['history.created_month']?.value} | ${r.data['history.category']?.value} | ${r.data['history.status']?.value}`;
    });

    // Expect subtotal depth 0 (France), subtotal depth 1 (France|Europe), then line items
    expect(labelsTop).toEqual([
      'Subtotal|France',
      'Subtotal|France|Europe',
      'France | Europe | Accessories',
      'France | Europe | Clothing'
    ]);
  });
});





