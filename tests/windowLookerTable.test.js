/**
 * @jest-environment jsdom
 */

import '../src/report_table';

describe('window.looker.table global function', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="vis-target" style="width: 800px; height: 600px;"></div>';
    container = document.getElementById('vis-target');
  });

  test('exposes window.looker.table and renders visualization', () => {
    expect(typeof window.looker.table).toBe('function');

    const queryResponse = {
      fields: {
        dimensions: [{ name: 'category', label: 'Category' }],
        measures: [{ name: 'revenue', label: 'Revenue' }],
        pivots: []
      }
    };

    const data = [
      { 'category': { value: 'Widgets' }, 'revenue': { value: 100 } }
    ];

    window.looker.table(container, {
      data,
      queryResponse,
      config: { theme: 'traditional' }
    });

    expect(container.querySelector('#visContainer')).not.toBeNull();
  });

  test('supports passing single options object containing element', () => {
    const queryResponse = {
      fields: {
        dimensions: [{ name: 'category', label: 'Category' }],
        measures: [{ name: 'revenue', label: 'Revenue' }],
        pivots: []
      }
    };

    const data = [
      { 'category': { value: 'Gadgets' }, 'revenue': { value: 200 } }
    ];

    window.looker.table({
      element: '#vis-target',
      data,
      queryResponse,
      config: { theme: 'contemporary' }
    });

    expect(container.querySelector('#visContainer')).not.toBeNull();
  });

  test('returns asExcel() function that generates Excel data URL', () => {
    const queryResponse = {
      fields: {
        dimensions: [{ name: 'category', label: 'Category' }],
        measures: [{ name: 'revenue', label: 'Revenue' }],
        pivots: []
      }
    };

    const data = [
      { 'category': { value: 'Widgets' }, 'revenue': { value: 100 } }
    ];

    const instance = window.looker.table(container, {
      data,
      queryResponse,
      config: { theme: 'traditional' }
    });

    expect(typeof instance.asExcel).toBe('function');
    const dataUrl = instance.asExcel();
    expect(dataUrl).toContain('data:application/vnd.ms-excel');
  });

  test('renders seamlessly with direct json_detail_lite_stream payload', () => {
    const jsonDetailPayload = require('./example_json_detail_lite_stream.json');
    window.looker.table(container, jsonDetailPayload);
    expect(container.querySelector('#visContainer')).not.toBeNull();
    expect(container.querySelector('table')).not.toBeNull();
  });

  test('renders plus_minus arrow style and collapsed subtotal style correctly', () => {
    const queryResponse = {
      fields: {
        dimensions: [
          { name: 'cat', label: 'Category' },
          { name: 'subcat', label: 'Subcategory' }
        ],
        measures: [{ name: 'val', label: 'Value' }],
        pivots: []
      }
    };

    const data = [
      { 'cat': { value: 'A' }, 'subcat': { value: 'A1' }, 'val': { value: 10 } },
      { 'cat': { value: 'A' }, 'subcat': { value: 'A2' }, 'val': { value: 20 } }
    ];

    window.looker.table(container, {
      data,
      queryResponse,
      config: {
        rowSubtotals: true,
        subtotalDepth: '(all)',
        subtotalStyle: 'collapsed',
        arrowStyle: 'plus_minus'
      }
    });

    const collapseIcon = container.querySelector('.row-collapse-icon');
    expect(collapseIcon).not.toBeNull();
    expect(collapseIcon.textContent).toBe('[-]');

    const subtotalRow = container.querySelector('tr.subtotal');
    expect(subtotalRow.classList.contains('subtotal-collapsed-0')).toBe(true);

    const lineItemRow = container.querySelector('tr.line_item');
    expect(lineItemRow.classList.contains('subtotal-collapsed-1')).toBe(true);
  });
});

