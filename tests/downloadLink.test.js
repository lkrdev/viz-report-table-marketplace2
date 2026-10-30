/**
 * @jest-environment jsdom
 */

import { downloadTableAsExcel } from '../src/download_link';

describe('downloadTableAsExcel', () => {
  let mockOpenWindow;
  let mockLinkElement;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    window.URL.revokeObjectURL = jest.fn();

    mockLinkElement = {
      href: '',
      download: '',
      click: jest.fn(),
    };

    mockOpenWindow = {
      document: {
        createElement: jest.fn().mockImplementation((tagName) => {
          if (tagName === 'a') return mockLinkElement;
          return {};
        }),
        body: {
          appendChild: jest.fn(),
        },
      },
      close: jest.fn(),
    };

    jest.spyOn(window, 'open').mockReturnValue(mockOpenWindow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    // Clean up DOM
    const tbl = document.getElementById('reportTable');
    if (tbl) tbl.remove();
  });

  it('should log an error if table with id reportTable is not found', async () => {
    await downloadTableAsExcel();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Table element with id 'reportTable' not found");
  });

  it('should successfully trigger download when reportTable exists', async () => {
    // Set up a mock table in the DOM
    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    tbl.innerHTML = '<thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody>';
    document.body.appendChild(tbl);

    // Mock getComputedStyle to return a specific style
    jest.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const styles = {
        'background-color': 'rgb(255, 0, 0)',
        'color': 'rgb(0, 0, 0)',
      };
      return {
        getPropertyValue: (prop) => styles[prop] || '',
      };
    });

    // Run the function
    const promise = downloadTableAsExcel();

    // Fast-forward the setTimeout
    jest.advanceTimersByTime(500);
    await promise;

    // Verify window.open was called
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');

    // Verify an 'a' element was created in the opened window
    expect(mockOpenWindow.document.createElement).toHaveBeenCalledWith('a');

    // Verify it was appended to the opened window body
    expect(mockOpenWindow.document.body.appendChild).toHaveBeenCalledWith(mockLinkElement);

    // Verify href is a data URI containing the excel xml structure and table content
    expect(mockLinkElement.href).toContain('data:application/vnd.ms-excel,');
    expect(decodeURIComponent(mockLinkElement.href)).toContain('<table id="reportTable"');
    expect(decodeURIComponent(mockLinkElement.href)).toContain('Header');

    // Verify download attribute has the correct filename pattern
    expect(mockLinkElement.download).toMatch(/^table.*\.xls$/);

    // Verify the download link was clicked
    expect(mockLinkElement.click).toHaveBeenCalled();

    // Verify the opened window was closed
    expect(mockOpenWindow.close).toHaveBeenCalled();
  });

  it('should remove row collapse icons from the generated Excel data', async () => {
    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    tbl.innerHTML = '<tbody><tr><td><span class="row-collapse-icon">[-]</span><span>July</span></td></tr></tbody>';
    document.body.appendChild(tbl);

    const promise = downloadTableAsExcel();
    jest.advanceTimersByTime(500);
    await promise;

    const exportedHtml = decodeURIComponent(mockLinkElement.href);
    expect(exportedHtml).not.toContain('row-collapse-icon');
    expect(exportedHtml).not.toContain('[-]');
    expect(exportedHtml).toContain('July');
  });

  it('should handle errors during download gracefully', async () => {
    // Set up a mock table in the DOM
    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    document.body.appendChild(tbl);

    // Mock window.open to throw an error (e.g. popup blocked)
    jest.spyOn(window, 'open').mockImplementation(() => {
      throw new Error('Popup blocked');
    });

    // Run the function
    const promise = downloadTableAsExcel();

    // Fast-forward the setTimeout
    jest.advanceTimersByTime(500);
    
    // Let's see if it throws/rejects or fails due to ReferenceError
    await promise;

    // We expect the original error to be logged to console.error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error clicking download link:",
      expect.any(Error)
    );
  });

  it('should exclude hidden and placeholder rows when excludeHiddenRows is enabled', async () => {
    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    tbl.innerHTML =
      '<tbody>' +
      '<tr><td>Visible Row</td></tr>' +
      '<tr style="display: none;"><td>Hidden Row</td></tr>' +
      '<tr data-subtotal-path="All|(Expand Men...)"><td>(Expand Men...)</td></tr>' +
      '</tbody>';
    document.body.appendChild(tbl);

    const promise = downloadTableAsExcel(tbl, { excludeHiddenRows: true });
    jest.advanceTimersByTime(500);
    await promise;

    const exportedHtml = decodeURIComponent(mockLinkElement.href);
    expect(exportedHtml).toContain('Visible Row');
    expect(exportedHtml).not.toContain('Hidden Row');
    expect(exportedHtml).not.toContain('(Expand Men...)');
  });

  it('should flatten inner cell wrappers and only indent cells with >= 15px padding', async () => {
    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    tbl.innerHTML =
      '<thead><tr><th><div><span>Outline Member</span><svg class="sort-icon"></svg></div></th></tr></thead>' +
      '<tbody><tr>' +
      '<td class="dimension" style="padding-left: 16px;"><div><span class="row-collapse-icon">[-]</span><span>AMER Ops</span></div></td>' +
      '<td class="measure">832</td>' +
      '</tr></tbody>';
    document.body.appendChild(tbl);

    jest.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const isCell = el.tagName === 'TH' || el.tagName === 'TD';
      return {
        getPropertyValue: (prop) => {
          if (prop === 'background-color') return isCell ? 'rgb(197, 217, 241)' : 'rgba(0, 0, 0, 0)';
          if (prop === 'padding-left') return el.style?.paddingLeft || '8px';
          return '';
        },
      };
    });

    const promise = downloadTableAsExcel(tbl);
    jest.advanceTimersByTime(500);
    await promise;

    const exportedHtml = decodeURIComponent(mockLinkElement.href);
    expect(exportedHtml).not.toContain('rgba(0, 0, 0, 0)');
    expect(exportedHtml).not.toContain('sort-icon');
    expect(exportedHtml).toContain('\u200B\u00A0\u00A0\u00A0\u00A0AMER Ops</td>');
    expect(exportedHtml).toContain('>832</td>');
  });
});
