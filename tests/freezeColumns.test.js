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

// Mock looker visualization registration
let addedVis = null;
global.looker = {
  plugins: {
    visualizations: {
      add: (vis) => {
        addedVis = {
          ...vis,
          clearErrors: () => {},
          addError: () => {},
          trigger: jest.fn()
        };
      }
    }
  }
};

require('../src/report_table');

describe('Freeze first X columns option and functionality', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    const stickyStyle = document.getElementById('reportTableStickyStyle');
    if (stickyStyle) stickyStyle.remove();
  });

  it('registers freezeFirstColumns option with default 0 and type number', () => {
    const options = VisPluginTableModel.getCoreConfigOptions();
    expect(options.freezeFirstColumns).toBeDefined();
    expect(options.freezeFirstColumns.section).toBe('Table');
    expect(options.freezeFirstColumns.type).toBe('number');
    expect(options.freezeFirstColumns.default).toBe(0);
  });

  it('applies sticky CSS classes and container overflow when freezeFirstColumns > 0', async () => {
    const { rows, metadata } = parseJsonBi(fixtures.group_name);
    const element = document.createElement('div');
    document.body.appendChild(element);

    addedVis.create(element, {});

    const config = {
      freezeFirstColumns: 2
    };

    addedVis.updateAsync(rows, element, config, metadata, {}, () => {});

    // Wait a tick for D3 renderTable promise to resolve
    await new Promise(resolve => setTimeout(resolve, 50));

    const visContainer = document.getElementById('visContainer');
    expect(visContainer).toBeDefined();
    expect(visContainer.style.overflowX).toBe('auto');
    expect(visContainer.style.top).toBe('0px');
    expect(visContainer.style.left).toBe('0px');
    expect(visContainer.style.width).toBe('100%');
    expect(visContainer.style.height).toBe('100%');

    // Check that sticky styles are injected
    const stickyStyle = document.getElementById('reportTableStickyStyle');
    expect(stickyStyle).toBeDefined();
    expect(stickyStyle.textContent).toContain('position: sticky');
    expect(stickyStyle.textContent).toContain('border-collapse: collapse !important');
    expect(stickyStyle.textContent).toContain('border-spacing: 0 !important');

    // Check that cells in the first 2 columns have sticky class
    const stickyCells = document.querySelectorAll('#reportTable .sticky-col');
    expect(stickyCells.length).toBeGreaterThan(0);

    // Verify first body row cell structure
    const firstBodyRow = document.querySelector('#reportTable tbody tr');
    const firstRowCells = firstBodyRow.querySelectorAll('td');
    expect(firstRowCells[0].classList.contains('sticky-col')).toBe(true);
    expect(firstRowCells[1].classList.contains('sticky-col')).toBe(true);
    expect(firstRowCells[2].classList.contains('sticky-col')).toBe(false);
  });

  it('freezes appropriate columns when transposed mode is active', async () => {
    const { rows, metadata } = parseJsonBi(fixtures.group_name);
    const element = document.createElement('div');
    document.body.appendChild(element);

    addedVis.create(element, {});

    const config = {
      freezeFirstColumns: 2,
      transposeTable: true
    };

    addedVis.updateAsync(rows, element, config, metadata, {}, () => {});

    await new Promise(resolve => setTimeout(resolve, 50));

    const firstBodyRow = document.querySelector('#reportTable tbody tr');
    const firstRowCells = firstBodyRow.querySelectorAll('td');
    expect(firstRowCells[0].classList.contains('sticky-col')).toBe(true);
    expect(firstRowCells[1].classList.contains('sticky-col')).toBe(true);
    expect(firstRowCells[2].classList.contains('sticky-col')).toBe(false);
  });

  it('renders Clear Sorts button when clientSorts is active and clears sorts on click', async () => {
    const { rows, metadata } = parseJsonBi(fixtures.group_name);
    const element = document.createElement('div');
    document.body.appendChild(element);

    addedVis.create(element, {});

    const triggerSpy = jest.fn();
    addedVis.trigger = triggerSpy;

    const config = {
      clientSorts: [{ name: 'history.created_month', desc: true }]
    };

    addedVis.updateAsync(rows, element, config, metadata, {}, () => {});

    await new Promise(resolve => setTimeout(resolve, 50));

    const clearBtn = document.getElementById('clearSortsBtn');
    expect(clearBtn).toBeDefined();
    expect(clearBtn.getAttribute('title')).toBe('Clear Client Sorts');

    // Click the button
    clearBtn.click();

    // Verify it triggers updateConfig with empty clientSorts
    expect(triggerSpy).toHaveBeenCalledWith('updateConfig', [{ clientSorts: [] }]);
  });
});
