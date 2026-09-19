/** @jest-environment jsdom */
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

  it('should register subtotalStyle and arrowStyle in core options with correct defaults', () => {
    const coreOptions = VisPluginTableModel.getCoreConfigOptions();
    expect(coreOptions.subtotalStyle).toBeDefined();
    expect(coreOptions.subtotalStyle.default).toBe('simple');
    expect(coreOptions.subtotalStyle.values).toEqual([
      { 'Simple': 'simple' },
      { 'Collapsed': 'collapsed' }
    ]);

    expect(coreOptions.arrowStyle).toBeDefined();
    expect(coreOptions.arrowStyle.default).toBe('arrows');
    expect(coreOptions.arrowStyle.values).toEqual([
      { 'Arrows': 'arrows' },
      { '+/-': 'plus_minus' }
    ]);
  });

  it('should format subtotal row label correctly when subtotalStyle is collapsed vs simple', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    metadata.fields.dimension_like.push({
      name: 'history.category',
      type: 'string',
      label: 'History Category',
      view: 'history',
      category: 'dimension'
    });

    const sampleRows = [
      {
        'history.created_month': { value: 'Brand A' },
        'history.category': { value: 'Cat 1' },
        'history.count': { value: 10 }
      },
      {
        'history.created_month': { value: 'Brand A' },
        'history.category': { value: 'Cat 2' },
        'history.count': { value: 20 }
      }
    ];

    const modelSimple = new VisPluginTableModel(sampleRows, metadata, {
      rowSubtotals: true,
      subtotalDepth: '(all)',
      subtotalStyle: 'simple'
    });
    const subtotalSimple = modelSimple.data.find(r => r.type === 'subtotal');
    expect(subtotalSimple.data['history.created_month'].value).toBe('Brand A');

    const modelCollapsed = new VisPluginTableModel(sampleRows, metadata, {
      rowSubtotals: true,
      subtotalDepth: '(all)',
      subtotalStyle: 'collapsed'
    });
    const subtotalCollapsed = modelCollapsed.data.find(r => r.type === 'subtotal');
    expect(subtotalCollapsed.data['history.created_month'].value).toBe('Brand A');
    expect(modelCollapsed.subtotalStyle).toBe('collapsed');

    // On line item rows, parent dimension (history.created_month) should be empty, leaf dimension (history.category) should retain value
    const lineItemSimple = modelSimple.data.find(r => r.type === 'line_item');
    expect(lineItemSimple.data['history.created_month'].value).toBe('Brand A');
    expect(lineItemSimple.data['history.category'].value).toBe('Cat 1');

    const lineItemCollapsed = modelCollapsed.data.find(r => r.type === 'line_item');
    expect(lineItemCollapsed.data['history.created_month'].value).toBe('Cat 1');

    // Only 1 dimension column should be visible when subtotalStyle is collapsed
    const visibleDimCols = modelCollapsed.columns.filter(c => c.isDimension && !c.hide);
    expect(visibleDimCols.length).toBe(1);

    // Header label should be concatenated dimension labels by default
    const firstDimCol = visibleDimCols[0];
    expect(firstDimCol.getHeaderCellLabelByType('field')).toBe('History Created Month / History Category');

    // Header label should be overridden if custom heading option is specified for first dimension
    const modelWithHeading = new VisPluginTableModel(sampleRows, metadata, {
      rowSubtotals: true,
      subtotalDepth: '(all)',
      subtotalStyle: 'collapsed',
      'heading|history.created_month': 'G/L Account'
    });
    const colWithHeading = modelWithHeading.columns.find(c => c.id === 'history.created_month');
    expect(colWithHeading.getHeaderCellLabelByType('field')).toBe('G/L Account');

    // When subtotalDepth is '1' and subtotalStyle is 'collapsed', dimensions beyond depth 1 should remain visible
    const modelPartialDepth = new VisPluginTableModel(sampleRows, metadata, {
      rowSubtotals: true,
      subtotalDepth: '1',
      subtotalStyle: 'collapsed'
    });
    const visiblePartialDimCols = modelPartialDepth.columns.filter(c => c.isDimension && !c.hide);
    expect(visiblePartialDimCols.length).toBe(2);
    expect(visiblePartialDimCols[0].getHeaderCellLabelByType('field')).toBe('History Created Month');
    expect(visiblePartialDimCols[1].getHeaderCellLabelByType('field')).toBe('History Category');

    // When rowSubtotals is false, subtotalStyle: 'collapsed' should be ignored and all dimension columns remain visible
    const modelSubtotalsOff = new VisPluginTableModel(sampleRows, metadata, {
      rowSubtotals: false,
      subtotalDepth: '(all)',
      subtotalStyle: 'collapsed'
    });
    expect(modelSubtotalsOff.subtotalStyle).toBe('simple');
    expect(modelSubtotalsOff.columns.filter(c => c.isDimension && !c.hide).length).toBe(2);
  });
});

describe('Server subtotals ingestion and percentage fallback', () => {
  const baseMetadata = {
    fields: {
      dimensions: [
        { name: 'cluster', type: 'string', label: 'Cluster' },
        { name: 'country', type: 'string', label: 'Country' }
      ],
      dimension_like: [
        { name: 'cluster', type: 'string', label: 'Cluster' },
        { name: 'country', type: 'string', label: 'Country' }
      ],
      measures: [
        { name: 'sales', type: 'number', label: 'Sales', is_numeric: true },
        { name: 'growth_pct', type: 'number', label: 'Growth %', is_numeric: true, value_format: '0.0%' }
      ],
      measure_like: [
        { name: 'sales', type: 'number', label: 'Sales', is_numeric: true },
        { name: 'growth_pct', type: 'number', label: 'Growth %', is_numeric: true, value_format: '0.0%' }
      ],
      pivots: []
    },
    sorts: []
  };

  const sampleRows = [
    {
      cluster: { value: 'LATAM' },
      country: { value: 'Brazil' },
      sales: { value: 100 },
      growth_pct: { value: 0.1, rendered: '10.0%' }
    },
    {
      cluster: { value: 'LATAM' },
      country: { value: 'Chile' },
      sales: { value: 200 },
      growth_pct: { value: 0.2, rendered: '20.0%' }
    },
    {
      cluster: { value: 'USCA' },
      country: { value: 'USA' },
      sales: { value: 500 },
      growth_pct: { value: -0.126, rendered: '-12.6%' }
    },
    {
      cluster: { value: 'USCA' },
      country: { value: 'Canada' },
      sales: { value: 50 },
      growth_pct: { value: -0.003, rendered: '-0.3%' }
    }
  ];

  it('should ingest server subtotals across depths when subtotalDepth is (all)', () => {
    const queryResponseWithSubtotals = {
      ...baseMetadata,
      has_subtotals: true,
      subtotal_sets: [['cluster']],
      subtotals_data: {
        '1': [
          {
            cluster: { value: 'LATAM' },
            country: { value: null },
            sales: { value: 8780737, rendered: '$8,780,737' },
            growth_pct: { value: 0.158, rendered: '15.8%' },
            '$$$__grouping__$$$': ['cluster']
          },
          {
            cluster: { value: 'USCA' },
            country: { value: null },
            sales: { value: 49569605, rendered: '$49,569,605' },
            growth_pct: { value: -0.120, rendered: '-12.0%' },
            '$$$__grouping__$$$': ['cluster']
          }
        ]
      }
    };

    const model = new VisPluginTableModel(sampleRows, queryResponseWithSubtotals, {
      rowSubtotals: true,
      subtotalDepth: '(all)'
    });

    expect(Object.keys(model.subtotals_data).length).toBeGreaterThan(0);
    const subtotalRows = model.data.filter(r => r.type === 'subtotal');
    expect(subtotalRows.length).toBe(2);

    const latamSubtotal = subtotalRows.find(r => r.id === 'Subtotal|LATAM');
    expect(latamSubtotal).toBeDefined();
    expect(latamSubtotal.data.sales.value).toBe(8780737);
    expect(latamSubtotal.data.sales.rendered).toBe('$8,780,737');
    expect(latamSubtotal.data.growth_pct.value).toBe(0.158);
    expect(latamSubtotal.data.growth_pct.rendered).toBe('15.8%');

    const uscaSubtotal = subtotalRows.find(r => r.id === 'Subtotal|USCA');
    expect(uscaSubtotal).toBeDefined();
    expect(uscaSubtotal.data.growth_pct.value).toBe(-0.120);
    expect(uscaSubtotal.data.growth_pct.rendered).toBe('-12.0%');
  });

  it('should correctly match null dimension subtotals (Subtotal|Others)', () => {
    const rowsWithNull = [
      {
        cluster: { value: null },
        country: { value: 'Brazil' },
        sales: { value: 50 },
        growth_pct: { value: 0.05, rendered: '5.0%' }
      }
    ];

    const queryResponseWithNullSubtotal = {
      ...baseMetadata,
      has_subtotals: true,
      subtotal_sets: [['cluster']],
      subtotals_data: {
        '1': [
          {
            cluster: { value: null },
            country: { value: null },
            sales: { value: 5000, rendered: '$5,000' },
            growth_pct: { value: 0.25, rendered: '25.0%' },
            '$$$__grouping__$$$': ['cluster']
          }
        ]
      }
    };

    const model = new VisPluginTableModel(rowsWithNull, queryResponseWithNullSubtotal, {
      rowSubtotals: true,
      subtotalDepth: '(all)'
    });

    const subtotalRows = model.data.filter(r => r.type === 'subtotal');
    expect(subtotalRows.length).toBe(1);
    const nullSubtotal = subtotalRows[0];
    expect(nullSubtotal.id).toBe('Subtotal|Others');
    expect(nullSubtotal.data.sales.value).toBe(5000);
    expect(nullSubtotal.data.growth_pct.rendered).toBe('25.0%');
  });

  it('should suppress summing percentages and ratios in client-side fallback', () => {
    // No subtotals_data provided -> triggers client-side aggregation fallback
    const queryResponseWithoutSubtotals = {
      ...baseMetadata
    };

    const model = new VisPluginTableModel(sampleRows, queryResponseWithoutSubtotals, {
      rowSubtotals: true,
      subtotalDepth: '(all)'
    });

    const subtotalRows = model.data.filter(r => r.type === 'subtotal');
    expect(subtotalRows.length).toBe(2);

    const latamSubtotal = subtotalRows.find(r => r.id === 'Subtotal|LATAM');
    expect(latamSubtotal).toBeDefined();
    // Non-percentage measure should still be summed (100 + 200 = 300)
    expect(latamSubtotal.data.sales.value).toBe(300);
    // Percentage measure must NOT be summed (should be null / empty string)
    expect(latamSubtotal.data.growth_pct.value).toBeNull();
    expect(latamSubtotal.data.growth_pct.rendered).toBe('');
  });

  it('should ingest multiple subtotal depths when subtotalDepth is (all)', () => {
    const multiDepthMetadata = {
      fields: {
        dimensions: [
          { name: 'region', type: 'string', label: 'Region' },
          { name: 'country', type: 'string', label: 'Country' },
          { name: 'city', type: 'string', label: 'City' }
        ],
        dimension_like: [
          { name: 'region', type: 'string', label: 'Region' },
          { name: 'country', type: 'string', label: 'Country' },
          { name: 'city', type: 'string', label: 'City' }
        ],
        measures: [
          { name: 'sales', type: 'number', label: 'Sales', is_numeric: true }
        ],
        measure_like: [
          { name: 'sales', type: 'number', label: 'Sales', is_numeric: true }
        ],
        pivots: []
      },
      sorts: []
    };

    const multiDepthRows = [
      { region: { value: 'EMEA' }, country: { value: 'UK' }, city: { value: 'London' }, sales: { value: 10 } },
      { region: { value: 'EMEA' }, country: { value: 'UK' }, city: { value: 'Manchester' }, sales: { value: 20 } },
      { region: { value: 'EMEA' }, country: { value: 'France' }, city: { value: 'Paris' }, sales: { value: 30 } }
    ];

    const queryResponse = {
      ...multiDepthMetadata,
      has_subtotals: true,
      subtotal_sets: [['region'], ['region', 'country']],
      subtotals_data: {
        '1': [
          {
            region: { value: 'EMEA' },
            country: { value: null },
            city: { value: null },
            sales: { value: 60, rendered: '$60' },
            '$$$__grouping__$$$': ['region']
          }
        ],
        '2': [
          {
            region: { value: 'EMEA' },
            country: { value: 'UK' },
            city: { value: null },
            sales: { value: 30, rendered: '$30' },
            '$$$__grouping__$$$': ['region', 'country']
          },
          {
            region: { value: 'EMEA' },
            country: { value: 'France' },
            city: { value: null },
            sales: { value: 30, rendered: '$30' },
            '$$$__grouping__$$$': ['region', 'country']
          }
        ]
      }
    };

    const modelAll = new VisPluginTableModel(multiDepthRows, queryResponse, {
      rowSubtotals: true,
      subtotalDepth: '(all)'
    });

    const subtotalRows = modelAll.data.filter(r => r.type === 'subtotal');
    expect(subtotalRows.length).toBe(3);

    const emeaSubtotal = subtotalRows.find(r => r.id === 'Subtotal|EMEA');
    expect(emeaSubtotal).toBeDefined();
    expect(emeaSubtotal.data.sales.value).toBe(60);
    expect(emeaSubtotal.data.sales.rendered).toBe('$60');

    const ukSubtotal = subtotalRows.find(r => r.id === 'Subtotal|EMEA|UK');
    expect(ukSubtotal).toBeDefined();
    expect(ukSubtotal.data.sales.value).toBe(30);
    expect(ukSubtotal.data.sales.rendered).toBe('$30');
  });

  it('groups row subtotal options and hides them unless rowSubtotals is enabled', () => {
    const defaultModel = new VisPluginTableModel(sampleRows, baseMetadata, {});
    const defaultOpts = defaultModel.getConfigOptions();

    const subtotalOptionKeys = [
      'allowSubtotalToggle',
      'subtotalDepth',
      'subtotalStyle',
      'subtotalsOnTop',
      'genericLabelForSubtotals',
      'arrowStyle',
      'startFolded'
    ];

    subtotalOptionKeys.forEach(key => {
      expect(defaultOpts[key]).toBeDefined();
      expect(defaultOpts[key].hidden).toBe(true);
      expect(defaultOpts[key].order).toBeGreaterThan(defaultOpts.colSubtotals.order);
      expect(defaultOpts[key].order).toBeLessThan(defaultOpts.spanRows.order);
    });
    expect(defaultOpts.hideSubtotals.hidden).toBe(true);

    const enabledModel = new VisPluginTableModel(sampleRows, baseMetadata, { rowSubtotals: true });
    const enabledOpts = enabledModel.getConfigOptions();
    subtotalOptionKeys.forEach(key => {
      expect(enabledOpts[key].hidden).toBe(false);
    });
    expect(enabledOpts.hideSubtotals.hidden).toBe(true);
  });

  it('omits subtotal rows when hideSubtotals is true and allowSubtotalToggle is enabled, and ignores hideSubtotals when allowSubtotalToggle is off', () => {
    const hiddenSubtotalsModel = new VisPluginTableModel(sampleRows, baseMetadata, {
      rowSubtotals: true,
      allowSubtotalToggle: true,
      hideSubtotals: true
    });
    expect(hiddenSubtotalsModel.hasSubtotals).toBe(false);
    expect(hiddenSubtotalsModel.data.filter(r => r.type === 'subtotal').length).toBe(0);

    const toggleDisabledModel = new VisPluginTableModel(sampleRows, baseMetadata, {
      rowSubtotals: true,
      allowSubtotalToggle: false,
      hideSubtotals: true
    });
    expect(toggleDisabledModel.hasSubtotals).toBe(true);
    expect(toggleDisabledModel.data.filter(r => r.type === 'subtotal').length).toBeGreaterThan(0);
  });

  it('renders toggleSubtotalsBtn in floating action bar and toggles subtotals on click', async () => {
    const { visPlugin } = require('../src/report_table');
    document.body.innerHTML = '<div id="vis"></div>';
    const element = document.getElementById('vis');

    visPlugin.create(element, {});
    const triggerSpy = jest.fn();
    visPlugin.trigger = triggerSpy;

    const config = {
      rowSubtotals: true,
      allowSubtotalToggle: true
    };

    visPlugin.updateAsync(sampleRows, element, config, baseMetadata, {}, () => {});
    await new Promise(resolve => setTimeout(resolve, 50));

    let toggleBtn = element.querySelector('#toggleSubtotalsBtn');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('title')).toBe('Hide Subtotals');
    expect(element.querySelector('#expandAllBtn')).not.toBeNull();
    expect(element.querySelectorAll('tr.subtotal').length).toBeGreaterThan(0);

    // Click toggle button to hide subtotals
    toggleBtn.click();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(triggerSpy).toHaveBeenCalledWith('updateConfig', [{ hideSubtotals: true }]);
    expect(element.querySelectorAll('tr.subtotal').length).toBe(0);
    expect(element.querySelector('#expandAllBtn')).toBeNull();

    toggleBtn = element.querySelector('#toggleSubtotalsBtn');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('title')).toBe('Show Subtotals');

    // Click toggle button again to restore subtotals
    toggleBtn.click();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(triggerSpy).toHaveBeenCalledWith('updateConfig', [{ hideSubtotals: false }]);
    expect(element.querySelectorAll('tr.subtotal').length).toBeGreaterThan(0);
    expect(element.querySelector('#expandAllBtn')).not.toBeNull();
  });
});







