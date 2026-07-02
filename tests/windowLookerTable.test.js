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
});
