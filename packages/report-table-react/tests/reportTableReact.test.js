/**
 * @jest-environment jsdom
 */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ReportTable, visReactPlugin } from '../index';

describe('ReportTable React Component & visReactPlugin', () => {
  let container;

  const sampleQueryResponse = {
    fields: {
      dimension_like: [
        { name: 'region', label: 'Region' },
        { name: 'city', label: 'City' },
      ],
      measure_like: [{ name: 'revenue', label: 'Revenue', is_numeric: true }],
      pivots: [],
    },
  };

  const sampleData = [
    {
      region: { value: 'West', rendered: 'West' },
      city: { value: 'Seattle', rendered: 'Seattle' },
      revenue: { value: 100, rendered: '$100' },
    },
    {
      region: { value: 'West', rendered: 'West' },
      city: { value: 'Portland', rendered: 'Portland' },
      revenue: { value: 150, rendered: '$150' },
    },
    {
      region: { value: 'East', rendered: 'East' },
      city: { value: 'New York', rendered: 'New York' },
      revenue: { value: 300, rendered: '$300' },
    },
  ];

  beforeEach(() => {
    document.body.innerHTML = '<div id="react-vis-target" style="width: 800px; height: 600px;"></div>';
    container = document.getElementById('react-vis-target');
  });

  test('renders <ReportTable /> with subtotals and surgically updates row visibility without recreating table DOM nodes', async () => {
    const root = createRoot(container);
    const baseConfig = {
      theme: 'traditional',
      rowSubtotals: true,
      subtotalDepth: '1',
    };

    await act(async () => {
      root.render(
        <ReportTable
          data={sampleData}
          queryResponse={sampleQueryResponse}
          config={baseConfig}
        />
      );
    });

    const tableEl = container.querySelector('#reportTable');
    expect(tableEl).not.toBeNull();

    const subtotalRows = Array.from(container.querySelectorAll('tbody tr.subtotal'));
    expect(subtotalRows.length).toBeGreaterThan(0);

    const firstSubtotalRow = subtotalRows[0];
    const subtotalPath = firstSubtotalRow.getAttribute('data-subtotal-path') || '';
    expect(subtotalPath).toBeTruthy();

    // Capture a line item child row reference before collapse config update
    const childRowBefore = container.querySelector(
      `tbody tr.line_item[data-subtotal-path^="${subtotalPath}"]`
    );
    expect(childRowBefore).not.toBeNull();
    expect(childRowBefore.style.display).not.toBe('none');

    // Trigger surgical visConfig update for collapsedSubtotals
    await act(async () => {
      root.render(
        <ReportTable
          data={sampleData}
          queryResponse={sampleQueryResponse}
          config={{
            ...baseConfig,
            collapsedSubtotals: subtotalPath,
          }}
        />
      );
    });

    const tableElAfter = container.querySelector('#reportTable');
    const childRowAfter = container.querySelector(
      `tbody tr.line_item[data-subtotal-path^="${subtotalPath}"]`
    );

    // Verify exact same DOM nodes (no full table redraw or remount)
    expect(tableElAfter).toBe(tableEl);
    expect(childRowAfter).toBe(childRowBefore);
    expect(childRowAfter.style.display).toBe('none');
    expect(firstSubtotalRow.classList.contains('collapsed')).toBe(true);

    // Uncollapse via config update
    await act(async () => {
      root.render(
        <ReportTable
          data={sampleData}
          queryResponse={sampleQueryResponse}
          config={{
            ...baseConfig,
            collapsedSubtotals: '',
          }}
        />
      );
    });

    expect(childRowAfter.style.display).toBe('');
    expect(firstSubtotalRow.classList.contains('collapsed')).toBe(false);
    root.unmount();
  });

  test('visReactPlugin create and updateAsync lifecycle works cleanly with Looker custom visualization API', async () => {
    const doneMock = jest.fn();
    const config = {
      theme: 'traditional',
      rowSubtotals: true,
      subtotalDepth: '1',
    };

    await act(async () => {
      visReactPlugin.create(container, config);
      visReactPlugin.updateAsync(
        sampleData,
        container,
        config,
        sampleQueryResponse,
        {},
        doneMock
      );
    });

    const tableEl = container.querySelector('#reportTable');
    expect(tableEl).not.toBeNull();
    expect(doneMock).toHaveBeenCalled();
  });

  test('clicking toggleSubtotalsBtn after initial load immediately hides subtotals on the first click', async () => {
    const doneMock = jest.fn();
    const config = {
      theme: 'traditional',
      rowSubtotals: true,
      allowSubtotalToggle: true,
      subtotalDepth: '1',
    };

    await act(async () => {
      visReactPlugin.create(container, config);
      visReactPlugin.updateAsync(
        sampleData,
        container,
        config,
        sampleQueryResponse,
        {},
        doneMock
      );
    });

    expect(container.querySelectorAll('tbody tr.subtotal').length).toBeGreaterThan(0);
    const toggleBtn = container.querySelector('#toggleSubtotalsBtn');
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('title')).toBe('Hide Subtotals');

    await act(async () => {
      toggleBtn.click();
    });

    expect(container.querySelectorAll('tbody tr.subtotal').length).toBe(0);
    expect(toggleBtn.getAttribute('title')).toBe('Show Subtotals');
  });

  test('shows cursor: pointer only on cells with drill links (Total Sale Price) and cursor: default on cells without drills (Average Days to Process)', async () => {
    const drillQueryResponse = {
      fields: {
        dimension_like: [
          { name: 'order_items.created_month', label: 'Created Month' },
          { name: 'products.category', label: 'Category' },
          { name: 'products.brand', label: 'Brand' },
        ],
        measure_like: [
          { name: 'order_items.total_sale_price', label: 'Total Sale Price', is_numeric: true },
          { name: 'order_items.average_days_to_process', label: 'Average Days to Process', is_numeric: true },
        ],
        pivots: [],
      },
      subtotalSets: [
        ['order_items.created_month'],
        ['order_items.created_month', 'products.category'],
      ],
      subtotalsData: {
        '1': [
          {
            'order_items.created_month': {
              value: '2025-01',
              rendered: '2025-01',
              links: [{ label: 'Drill Month', url: '/explore/m?fields=...' }],
            },
            'products.category': { value: null, filterable_value: 'EMPTY' },
            'products.brand': { value: null, filterable_value: 'EMPTY' },
            'order_items.total_sale_price': {
              value: 500,
              rendered: '$500.00',
              links: [{ label: 'Show All 10 Rows', url: '/explore/m?fields=...' }],
            },
            'order_items.average_days_to_process': {
              value: 2.5,
              rendered: '2.50',
              links: [],
            },
          },
        ],
      },
    };

    const drillData = [
      {
        'order_items.created_month': { value: '2025-01', rendered: '2025-01', links: [] },
        'products.category': { value: 'Apparel', rendered: 'Apparel', links: [] },
        'products.brand': { value: 'Acme', rendered: 'Acme', links: [] },
        'order_items.total_sale_price': {
          value: 500,
          rendered: '$500.00',
          links: [{ label: 'Show All 10 Rows', url: '/explore/m?fields=...' }],
        },
        'order_items.average_days_to_process': {
          value: 2.5,
          rendered: '2.50',
          links: [],
        },
      },
    ];

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ReportTable
          data={drillData}
          queryResponse={drillQueryResponse}
          config={{
            theme: 'traditional',
            rowSubtotals: true,
            subtotalDepth: '1',
          }}
        />
      );
    });

    const rows = Array.from(container.querySelectorAll('#reportTable tbody tr'));
    expect(rows.length).toBeGreaterThan(0);

    const sampleSubtotalRow = rows.find((r) => r.classList.contains('subtotal'));
    const sampleLineItemRow = rows.find((r) => r.classList.contains('line_item'));
    expect(sampleSubtotalRow).toBeDefined();
    expect(sampleLineItemRow).toBeDefined();

    // Subtotal row merges the 3 dimension columns (colspan=3) into subCells[0], so subCells[1] = total_sale_price, subCells[2] = average_days_to_process
    const subCells = sampleSubtotalRow.querySelectorAll('td');
    const lineCells = sampleLineItemRow.querySelectorAll('td');

    expect(subCells[1].style.cursor).toBe('pointer');
    expect(subCells[2].style.cursor).toBe('default');
    expect(lineCells[3].style.cursor).toBe('pointer');
    expect(lineCells[4].style.cursor).toBe('default');

    root.unmount();
  });
});
