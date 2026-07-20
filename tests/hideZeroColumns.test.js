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

describe('Hide zero columns option', () => {
  it('does not hide any column when hideZeroCols is false or undefined, even if all values are zero', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    
    // Modify one column to have all zero values
    const modifiedRows = rows.map(row => {
      const newRow = { ...row };
      if (newRow['history.count'] && newRow['history.count']['All Users']) {
        newRow['history.count']['All Users'].value = 0;
      }
      return newRow;
    });

    const model = new VisPluginTableModel(modifiedRows, metadata, {
      hideZeroCols: false
    });

    const column = model.columns.find(c => c.id === 'All Users.history.count');
    expect(column).toBeDefined();
    expect(column.hide).toBe(false);
  });

  it('hides columns where all values are zero when hideZeroCols is true', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    
    // Modify "All Users" column to have all zero values, and "Gemini Default Users" column to have mix of zeroes and non-zeroes
    const modifiedRows = rows.map((row, index) => {
      const newRow = { ...row };
      if (newRow['history.count']) {
        if (newRow['history.count']['All Users']) {
          newRow['history.count']['All Users'].value = 0;
        }
        if (newRow['history.count']['Gemini Default Users']) {
          // One non-zero value, others zero
          newRow['history.count']['Gemini Default Users'].value = index === 0 ? 5 : 0;
        }
      }
      return newRow;
    });

    const model = new VisPluginTableModel(modifiedRows, metadata, {
      hideZeroCols: true
    });

    // "All Users" column should be hidden
    const allUsersCol = model.columns.find(c => c.id === 'All Users.history.count');
    expect(allUsersCol).toBeDefined();
    expect(allUsersCol.hide).toBe(true);

    // "Gemini Default Users" column should NOT be hidden (has 5)
    const geminiUsersCol = model.columns.find(c => c.id === 'Gemini Default Users.history.count');
    expect(geminiUsersCol).toBeDefined();
    expect(geminiUsersCol.hide).toBe(false);
  });

  it('hides columns where all values are zero or null/undefined when hideZeroCols is true', () => {
    const { rows, metadata } = parseJsonBi(fixtures.history_created_month);
    
    // Modify "All Users" column to have mix of zeros, null, and undefined values
    const modifiedRows = rows.map((row, index) => {
      const newRow = { ...row };
      if (newRow['history.count'] && newRow['history.count']['All Users']) {
        if (index === 0) {
          newRow['history.count']['All Users'].value = 0;
        } else if (index === 1) {
          newRow['history.count']['All Users'].value = null;
        } else {
          newRow['history.count']['All Users'].value = undefined;
        }
      }
      return newRow;
    });

    const model = new VisPluginTableModel(modifiedRows, metadata, {
      hideZeroCols: true
    });

    const allUsersCol = model.columns.find(c => c.id === 'All Users.history.count');
    expect(allUsersCol).toBeDefined();
    expect(allUsersCol.hide).toBe(true);
  });
});
