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
});
