import { VisPluginTableModel } from '../src/vis_table_plugin';
import { INDEX_COLUMN } from '../src/constants';
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

describe('Hide Null Dimension Columns option', () => {
  it('does not hide dimension columns when hideNullDimensionCols is false or undefined, even if all values are null', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    metadata.fields.dimension_like.push({
      name: 'history.null_dim',
      label: 'Null Dimension',
      type: 'string',
      category: 'dimension'
    });

    const modifiedRows = rows.map(row => ({
      ...row,
      'history.null_dim': { value: null }
    }));

    const model = new VisPluginTableModel(modifiedRows, metadata, {
      hideNullDimensionCols: false
    });

    const col = model.columns.find(c => c.id === 'history.null_dim');
    expect(col).toBeDefined();
    expect(col.hide).toBe(false);
  });

  it('hides dimension columns where all values are null, undefined, or empty strings when hideNullDimensionCols is true', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    metadata.fields.dimension_like.push({
      name: 'history.null_dim',
      label: 'Null Dimension',
      type: 'string',
      category: 'dimension'
    });
    metadata.fields.dimension_like.push({
      name: 'history.valid_dim',
      label: 'Valid Dimension',
      type: 'string',
      category: 'dimension'
    });

    const modifiedRows = rows.map((row, idx) => ({
      ...row,
      'history.null_dim': { value: idx % 2 === 0 ? null : '' },
      'history.valid_dim': { value: idx === 0 ? 'Active' : null }
    }));

    const model = new VisPluginTableModel(modifiedRows, metadata, {
      hideNullDimensionCols: true
    });

    const nullCol = model.columns.find(c => c.id === 'history.null_dim');
    expect(nullCol).toBeDefined();
    expect(nullCol.hide).toBe(true);

    const validCol = model.columns.find(c => c.id === 'history.valid_dim');
    expect(validCol).toBeDefined();
    expect(validCol.hide).toBe(false);
  });

  it('does not hide dimension columns with boolean false or number 0 values', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    metadata.fields.dimension_like.push({
      name: 'history.zero_dim',
      label: 'Zero Dimension',
      type: 'number',
      category: 'dimension'
    });
    metadata.fields.dimension_like.push({
      name: 'history.false_dim',
      label: 'False Dimension',
      type: 'yesno',
      category: 'dimension'
    });

    const modifiedRows = rows.map(row => ({
      ...row,
      'history.zero_dim': { value: 0 },
      'history.false_dim': { value: false }
    }));

    const model = new VisPluginTableModel(modifiedRows, metadata, {
      hideNullDimensionCols: true
    });

    const zeroCol = model.columns.find(c => c.id === 'history.zero_dim');
    expect(zeroCol.hide).toBe(false);

    const falseCol = model.columns.find(c => c.id === 'history.false_dim');
    expect(falseCol.hide).toBe(false);
  });

  it('does not hide dimension columns when dataset has no rows', () => {
    const { metadata } = parseJsonBi(fixtures.history_created_month);
    const model = new VisPluginTableModel([], metadata, {
      hideNullDimensionCols: true
    });

    const col = model.columns.find(c => c.id === 'history.created_month');
    expect(col).toBeDefined();
    expect(col.hide).toBe(false);
  });

  it('excludes null dimension columns and their subtotal rows when hideNullDimensionCols and rowSubtotals are enabled', () => {
    const { metadata } = parseJsonBi(fixtures.history_created_month);
    metadata.fields.dimension_like = [
      { name: 'country', label: 'Country', type: 'string', category: 'dimension' },
      { name: 'cluster', label: 'Cluster', type: 'string', category: 'dimension' },
      { name: 'collection', label: 'Collection', type: 'string', category: 'dimension' },
      { name: 'level4', label: 'Level 4', type: 'string', category: 'dimension' },
      { name: 'level5', label: 'Level 5', type: 'string', category: 'dimension' }
    ];

    const rows = [
      {
        country: { value: 'MEXICO' },
        cluster: { value: 'LATAM' },
        collection: { value: "LEVI'S MAINLINE" },
        level4: { value: null },
        level5: { value: null },
        'history.count': { value: 5879203 }
      },
      {
        country: { value: 'MEXICO' },
        cluster: { value: 'LATAM' },
        collection: { value: "LEVI'S LICENSED" },
        level4: { value: null },
        level5: { value: null },
        'history.count': { value: 328128 }
      }
    ];

    // Without hideNullDimensionCols, depth 4 subtotals with trailing nulls are produced
    const modelWithoutFix = new VisPluginTableModel(rows, metadata, {
      rowSubtotals: true,
      hideNullDimensionCols: false
    });
    const subtotalRowsWithoutFix = modelWithoutFix.data.filter(r => r.type === 'subtotal');
    expect(subtotalRowsWithoutFix.some(r => r.id.includes("LEVI'S MAINLINE"))).toBe(true);

    // With hideNullDimensionCols, level4 and level5 are hidden and no trailing subtotals are generated
    const modelWithFix = new VisPluginTableModel(rows, metadata, {
      rowSubtotals: true,
      hideNullDimensionCols: true
    });

    const level4Col = modelWithFix.columns.find(c => c.id === 'level4');
    const level5Col = modelWithFix.columns.find(c => c.id === 'level5');
    expect(level4Col.hide).toBe(true);
    expect(level5Col.hide).toBe(true);

    const subtotalRows = modelWithFix.data.filter(r => r.type === 'subtotal');
    // Depths should be 1 (Country) and 2 (Country | Cluster)
    const subtotalLabels = subtotalRows.map(r => r.data['country'].value);
    expect(subtotalLabels).toContain('MEXICO');
    expect(subtotalLabels).toContain('MEXICO | LATAM');
    // Level 3 (Collection) is now the leaf level, so it shouldn't produce depth 4 subtotals with null values
    expect(subtotalLabels.some(label => label.endsWith('|') || label.includes('null') || label.includes('None'))).toBe(false);
  });

  it('updates indexColumn to use the last non-null visible dimension when useIndexColumn is true', () => {
    const { metadata } = parseJsonBi(fixtures.history_created_month);
    metadata.fields.dimension_like = [
      { name: 'country', label: 'Country', type: 'string', category: 'dimension' },
      { name: 'cluster', label: 'Cluster', type: 'string', category: 'dimension' },
      { name: 'level3_null', label: 'Level 3 Null', type: 'string', category: 'dimension' }
    ];

    const rows = [
      {
        country: { value: 'MEXICO' },
        cluster: { value: 'LATAM' },
        level3_null: { value: null },
        'history.count': { value: 100 }
      }
    ];

    const model = new VisPluginTableModel(rows, metadata, {
      indexColumn: true,
      hideNullDimensionCols: true
    });

    const lineItem = model.data.find(r => r.type === 'line_item');
    expect(lineItem.data[INDEX_COLUMN].value).toBe('LATAM');
  });
});
