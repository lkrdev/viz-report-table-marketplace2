import { VisPluginTableModel } from '../src/vis_table_plugin';
import { getHeaderCellSortInfo } from '../src/report_table';
const fixtures = require('./fixtures.json');

const parseJsonBi = (fixture, defaultSorts = []) => {
  const metadata = {
    ...fixture.metadata,
    fields: {
      ...fixture.metadata.fields,
      dimension_like: fixture.metadata.fields.dimensions || [],
      measure_like: [
        ...(fixture.metadata.fields.measures || []),
        ...(fixture.metadata.fields.table_calculations || [])
      ],
      pivots: fixture.metadata.fields.pivots || []
    },
    pivots: (fixture.metadata.pivots || []).map(p => ({
      ...p,
      metadata: p.metadata || Object.fromEntries(
        Object.entries(p.data || {}).map(([k, v]) => [k, typeof v === 'object' && v !== null ? v : { value: v }])
      )
    })),
    sorts: (fixture.metadata.sorts || fixture.sorts || defaultSorts).map(s => {
      if (typeof s === 'object' && s !== null) return s;
      const parts = String(s).trim().split(/\s+/);
      return {
        name: parts[0],
        desc: parts.length > 1 && parts[1].toLowerCase() === 'desc'
      };
    })
  };
  return { rows: fixture.rows, metadata };
};

describe('clientSorts across multiple iterations', () => {
  const iterations = [
    'group_name',
    'group_name_desc',
    'history_created_month',
    'history_created_month_desc',
    'history_count_desc_0',
    'group_name_history_count_desc_1_history_created_month_desc'
  ];

  iterations.forEach((key) => {
    it(`instantiates VisPluginTableModel for ${key}`, () => {
      const { rows, metadata } = parseJsonBi(fixtures[key]);
      const model = new VisPluginTableModel(rows, metadata, {});
      expect(model).toBeDefined();
      expect(model.data.length).toBeGreaterThan(0);
    });
  });

  it('allows sorting by pivot field (group.name)', () => {
    const { rows, metadata } = parseJsonBi(fixtures.group_name);
    const model = new VisPluginTableModel(rows, metadata, {});
    
    // First sort sets default ascending
    model.clientSort('group.name', false);
    expect(model.clientSorts).toEqual([{ name: 'group.name', desc: false }]);

    // Toggle to descending
    model.clientSort('group.name', false);
    expect(model.clientSorts).toEqual([{ name: 'group.name', desc: true }]);
  });

  it('allows sorting by dimension field (history.created_month)', () => {
    const { rows, metadata } = parseJsonBi(fixtures.group_name);
    const model = new VisPluginTableModel(rows, metadata, {});
    
    model.clientSort('history.created_month', false);
    expect(model.clientSorts).toEqual([{ name: 'history.created_month', desc: false }]);
  });

  it('inherits underlying query sort initially via getActiveSorts', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month, ['history.created_month']);
    const model = new VisPluginTableModel(rows, metadata, {});
    expect(model.clientSorts).toEqual([]);
    expect(model.getActiveSorts()).toEqual([{ name: 'history.created_month', desc: false }]);
  });

  describe('getHeaderCellSortInfo (arrow indicators)', () => {
    it('returns left and right arrows strictly for top-left pivot headers', () => {
      const { rows, metadata } = parseJsonBi(fixtures.group_name, ['group.name']);
      const model = new VisPluginTableModel(rows, metadata, {});
      
      const topLeft = { type: 'pivot0', modelField: { name: 'group.name' } };
      const info = getHeaderCellSortInfo(topLeft, model);
      expect(info.sortId).toBe('group.name');
      expect(info.points).toBe("9 6 15 12 9 18"); // Right arrow (ascending)
    });

    it('prevents rendering sort indicators on pivot header cells over sorted measures', () => {
      const { rows, metadata } = parseJsonBi(fixtures.history_count_desc_0, ['history.count desc']);
      const model = new VisPluginTableModel(rows, metadata, {});
      
      const pivotCell = { type: 'pivot0', colspan: 1, column: { id: '2024.history.count' } };
      const info = getHeaderCellSortInfo(pivotCell, model);
      expect(info.sortId).toBe('');
      expect(info.points).toBeNull();
    });

    it('draws vertical sort indicator on sorted measure leaf headers', () => {
      const { rows, metadata } = parseJsonBi(fixtures.history_count_desc_0, ['history.count desc']);
      const model = new VisPluginTableModel(rows, metadata, {});
      
      const measureCell = { type: 'field', colspan: 1, column: { id: 'history.count' } };
      const info = getHeaderCellSortInfo(measureCell, model);
      expect(info.points).toBe("6 9 12 15 18 9"); // Down arrow (descending)
    });

    it('draws vertical sort indicator on dimension headers under sortColsBy = measures', () => {
      const { rows, metadata } = parseJsonBi(fixtures.history_created_month, ['history.created_month']);
      const model = new VisPluginTableModel(rows, metadata, { sortColumnsBy: 'measures' });
      
      const dimColumn = model.columns.find(c => c.isDimension);
      const dimCell = { type: 'field', colspan: 1, column: dimColumn };
      const info = getHeaderCellSortInfo(dimCell, model);
      expect(info.sortId).toBe('history.created_month');
      expect(info.points).toBe("6 15 12 9 18 15"); // Up arrow (ascending)
    });

    it('defensively handles null or undefined input in getHeaderCellSortInfo', () => {
      expect(getHeaderCellSortInfo(null, null)).toEqual({
        sortId: '',
        sortIndex: -1,
        sortObj: null,
        points: null
      });
      expect(getHeaderCellSortInfo(undefined, null)).toEqual({
        sortId: '',
        sortIndex: -1,
        sortObj: null,
        points: null
      });
    });
  });

  it('avoids mutating underlying sort objects during multi-column shift sorting', () => {
    const { rows, metadata } = parseJsonBi(fixtures.group_name);
    metadata.sorts = [{ name: 'group.name', desc: false }];
    const model = new VisPluginTableModel(rows, metadata, {});

    model.clientSort('group.name', true);
    expect(model.clientSorts).toEqual([{ name: 'group.name', desc: true }]);
    expect(metadata.sorts[0].desc).toBe(false);
  });

  it('safely handles uneven sort depth without throwing TypeError in compareSortArrays', () => {
    const { rows, metadata } = parseJsonBi(fixtures.group_name);
    const model = new VisPluginTableModel(rows, metadata, {});
    const comparator = model.compareSortArrays(model);
    const a = { sort: [{ name: 'group.name', value: 1 }] };
    const b = { sort: [{ name: 'group.name', value: 2 }, { name: 'other', value: 3 }] };
    expect(() => comparator(a, b)).not.toThrow();
  });

  describe('sorting with row subtotals enabled', () => {
    const getTestModel = () => {
      const metadata = {
        fields: {
          dimension_like: [
            { name: 'category', label: 'Category', type: 'string', category: 'dimension' },
            { name: 'subcategory', label: 'Subcategory', type: 'string', category: 'dimension' }
          ],
          measure_like: [
            { name: 'revenue', label: 'Revenue', type: 'number', category: 'measure', is_numeric: true }
          ],
          pivots: []
        },
        sorts: []
      };
      const rows = [
        { category: { value: 'A' }, subcategory: { value: 'X' }, revenue: { value: 10 } },
        { category: { value: 'A' }, subcategory: { value: 'Y' }, revenue: { value: 20 } },
        { category: { value: 'B' }, subcategory: { value: 'Z' }, revenue: { value: 30 } },
        { category: { value: 'B' }, subcategory: { value: 'W' }, revenue: { value: 40 } }
      ];
      return new VisPluginTableModel(rows, metadata, { rowSubtotals: true, subtotalDepth: '1' });
    };

    it('correctly indexes subtotal rows during construction', () => {
      const model = getTestModel();
      expect(model.subtotalRows).toBeDefined();
      expect(model.subtotalRows[0]).toBeDefined();
      expect(model.subtotalRows[0].length).toBe(2);
      expect(model.subtotalRows[0][0].id).toBe('Subtotal|A');
      expect(model.subtotalRows[0][1].id).toBe('Subtotal|B');
    });

    it('sorts subtotal groups and line items descending by subtotal/individual values', () => {
      const model = getTestModel();
      
      // Sort descending by revenue
      model.clientSort('revenue', false);
      expect(model.clientSorts).toEqual([{ name: 'revenue', desc: true }]);

      const sortedRows = model.data.map(r => ({
        id: r.id,
        type: r.type,
        revenue: r.data.revenue.value
      }));

      expect(sortedRows).toEqual([
        { id: 'B|W', type: 'line_item', revenue: 40 },
        { id: 'B|Z', type: 'line_item', revenue: 30 },
        { id: 'Subtotal|B', type: 'subtotal', revenue: 70 },
        { id: 'A|Y', type: 'line_item', revenue: 20 },
        { id: 'A|X', type: 'line_item', revenue: 10 },
        { id: 'Subtotal|A', type: 'subtotal', revenue: 30 }
      ]);
    });

    it('sorts subtotal groups and line items ascending by subtotal/individual values', () => {
      const model = getTestModel();

      // First sort (sets descending)
      model.clientSort('revenue', false);
      // Second sort (toggles to ascending)
      model.clientSort('revenue', false);
      expect(model.clientSorts).toEqual([{ name: 'revenue', desc: false }]);

      const sortedRows = model.data.map(r => ({
        id: r.id,
        type: r.type,
        revenue: r.data.revenue.value
      }));

      expect(sortedRows).toEqual([
        { id: 'A|X', type: 'line_item', revenue: 10 },
        { id: 'A|Y', type: 'line_item', revenue: 20 },
        { id: 'Subtotal|A', type: 'subtotal', revenue: 30 },
        { id: 'B|Z', type: 'line_item', revenue: 30 },
        { id: 'B|W', type: 'line_item', revenue: 40 },
        { id: 'Subtotal|B', type: 'subtotal', revenue: 70 }
      ]);
    });
  });
});
