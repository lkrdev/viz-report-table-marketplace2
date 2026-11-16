/**
 * @jest-environment jsdom
 */

import fs from 'fs';
import path from 'path';
import {
  detectExportMode,
  downloadTableAsExcel,
  getDownloadRelayUrl,
  getTableExcelHtml,
} from '../src/download_link';

describe('downloadTableAsExcel', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    window.URL.createObjectURL = jest.fn(() => 'blob:test-excel-url');
    window.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    const tbl = document.getElementById('reportTable');
    if (tbl) tbl.remove();
  });

  it('should log an error if table with id reportTable is not found', async () => {
    await downloadTableAsExcel();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Table element with id 'reportTable' not found");
  });

  it('should trigger in-frame Blob download in top-level or Extension mode without window.open', async () => {
    const openSpy = jest.spyOn(window, 'open');
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    tbl.innerHTML = '<thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody>';
    document.body.appendChild(tbl);

    jest.spyOn(window, 'getComputedStyle').mockImplementation(() => {
      const styles = {
        'background-color': 'rgb(255, 0, 0)',
        'color': 'rgb(0, 0, 0)',
      };
      return { getPropertyValue: (prop) => styles[prop] || '' };
    });

    await downloadTableAsExcel(tbl, { isExtension: true });

    expect(openSpy).not.toHaveBeenCalled();
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const exportedHtml = getTableExcelHtml(tbl);
    expect(exportedHtml).toContain('<table id="reportTable"');
    expect(exportedHtml).toContain('Header');

    jest.advanceTimersByTime(1000);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-excel-url');
  });

  it('should use postMessage download.html relay in Custom Viz iframe mode', async () => {
    const mockPopup = { postMessage: jest.fn() };
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(mockPopup);

    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    tbl.innerHTML = '<thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody>';
    document.body.appendChild(tbl);

    await downloadTableAsExcel(tbl, { mode: 'custom-viz' });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [openedUrl, target] = openSpy.mock.calls[0];
    expect(target).toBe('_blank');
    expect(openedUrl).toMatch(/^https:\/\/cdn\.lkr\.dev\/viz\/report-table\/latest\/download\.html#.+:.+/);
    const hash = openedUrl.split('#')[1];
    const nonce = hash.split(':')[0];

    // Ignore spoofed origin or wrong nonce
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        source: mockPopup,
        data: { type: 'report-table-ready', nonce },
      }),
    );
    expect(mockPopup.postMessage).not.toHaveBeenCalled();

    // Valid ready handshake from relay popup
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://cdn.lkr.dev',
        source: mockPopup,
        data: { type: 'report-table-ready', nonce },
      }),
    );

    expect(mockPopup.postMessage).toHaveBeenCalledTimes(1);
    const [payload, targetOrigin] = mockPopup.postMessage.mock.calls[0];
    expect(targetOrigin).toBe('https://cdn.lkr.dev');
    expect(payload.type).toBe('report-table-download');
    expect(payload.nonce).toBe(nonce);
    expect(payload.filename).toMatch(/^table-.*\.xls$/);
    expect(payload.html).toContain('Header');
  });

  it('should fall back to in-frame Blob download if relay window.open throws', async () => {
    jest.spyOn(window, 'open').mockImplementation(() => {
      throw new Error('Popup blocked');
    });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    document.body.appendChild(tbl);

    await downloadTableAsExcel(tbl, { mode: 'custom-viz' });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error clicking download link:', expect.any(Error));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('should execute download.html relay handshake, render fallback link, and auto-close after 1000ms', () => {
    const htmlFile = fs.readFileSync(path.resolve(__dirname, '../src/download.html'), 'utf8');
    const scriptMatch = htmlFile.match(/<script>([\s\S]*?)<\/script>/);
    const mockOpener = { postMessage: jest.fn() };
    const closeSpy = jest.spyOn(window, 'close').mockImplementation(() => {});
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    Object.defineProperty(window, 'opener', { value: mockOpener, configurable: true });
    window.location.hash = '#nonce123:http://localhost';

    // Execute the static relay page script
    new Function(scriptMatch[1])();

    expect(mockOpener.postMessage).toHaveBeenCalledWith(
      { type: 'report-table-ready', nonce: 'nonce123' },
      'http://localhost',
    );

    // Reject spoofed e.origin
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        source: mockOpener,
        data: {
          type: 'report-table-download',
          nonce: 'nonce123',
          filename: 'table:export.xls',
          html: '<html><body>ok</body></html>',
        },
      }),
    );
    expect(clickSpy).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://localhost',
        source: mockOpener,
        data: {
          type: 'report-table-download',
          nonce: 'nonce123',
          filename: 'table:export.xls',
          html: '<html><body>ok</body></html>',
        },
      }),
    );

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const fallbackLink = document.body.querySelector('a[download="table_export.xls"]');
    expect(fallbackLink?.textContent).toBe('Click here if your download does not start automatically');
    expect(closeSpy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(window.URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('pagehide'));
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-excel-url');
    fallbackLink?.remove();

    // Also verify opaque "null" origin from sandboxed Looker Custom Viz iframe uses "*" postTargetOrigin and checks e.origin === "null"
    window.location.hash = '#nonce456:null';
    new Function(scriptMatch[1])();
    expect(mockOpener.postMessage).toHaveBeenLastCalledWith(
      { type: 'report-table-ready', nonce: 'nonce456' },
      '*',
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'null',
        source: mockOpener,
        data: {
          type: 'report-table-download',
          nonce: 'nonce456',
          filename: 'table.xls',
          html: '<html><body>opaque</body></html>',
        },
      }),
    );
    expect(clickSpy).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(1000);
    document.body.querySelectorAll('a[download]').forEach((el) => el.remove());

    Object.defineProperty(window, 'opener', { value: null, configurable: true });
    window.location.hash = '';
  });

  it('should classify and export across all 3 Looker sandbox modes (extension-data-uri, extension-subdomain, custom-viz)', async () => {
    const origOrigin = Object.getOwnPropertyDescriptor(window, 'origin');
    const origPath = window.location.pathname;
    const tbl = Object.assign(document.createElement('table'), {
      id: 'reportTable',
      innerHTML: '<tbody><tr><td>3-Mode Check</td></tr></tbody>',
    });
    document.body.appendChild(tbl);

    try {
      // Mode 1: Extension data: URI sandbox
      const dataUriWin = { location: { protocol: 'data:', pathname: 'text/html;base64,abc' }, origin: 'null' };
      expect(detectExportMode({ isExtension: true }, dataUriWin)).toBe('extension-data-uri');
      const blockedOpen = jest.spyOn(window, 'open').mockImplementation(() => {
        throw new Error('window.open is not available');
      });
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      await downloadTableAsExcel(tbl, { mode: 'extension-data-uri', isExtension: true });
      expect(blockedOpen).not.toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Mode 2: Extension subdomained extension.loader sandbox
      window.history.replaceState({}, '', '/project-resource/public/extension.loader');
      window.lookerExtensionMetadata = { lookerVersion: '26.14' };
      expect(detectExportMode()).toBe('extension-subdomain');
      await downloadTableAsExcel(tbl);
      expect(blockedOpen).not.toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(2);
      delete window.lookerExtensionMetadata;

      // Mode 3: Custom Visualization sandbox (window.location.origin is Looker host while window.origin is "null")
      window.history.replaceState({}, '', '/visualizations/sandbox/render/report-table');
      Object.defineProperty(window, 'origin', { value: 'null', configurable: true });
      expect(detectExportMode()).toBe('custom-viz');

      const mockPopup = { postMessage: jest.fn() };
      blockedOpen.mockReturnValue(mockPopup);
      await downloadTableAsExcel(tbl);
      const [openedUrl] = blockedOpen.mock.calls[0];
      expect(openedUrl).toMatch(/^https:\/\/cdn\.lkr\.dev\/viz\/report-table\/latest\/download\.html#[^:]+:null$/);
      const nonce = openedUrl.split('#')[1].split(':')[0];
      window.dispatchEvent(
        new MessageEvent('message', { origin: 'https://cdn.lkr.dev', source: mockPopup, data: { type: 'report-table-ready', nonce } }),
      );
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'report-table-download', nonce }),
        'https://cdn.lkr.dev',
      );
    } finally {
      delete window.lookerExtensionMetadata;
      window.history.replaceState({}, '', origPath);
      if (origOrigin) Object.defineProperty(window, 'origin', origOrigin);
      else delete window.origin;
    }
  });

  it('should resolve getDownloadRelayUrl for CDN, localhost, and /plugins/ fallback', () => {
    expect(getDownloadRelayUrl('https://cdn.lkr.dev/viz/report-table/abc1234/report_table.js')).toBe(
      'https://cdn.lkr.dev/viz/report-table/abc1234/download.html',
    );
    expect(getDownloadRelayUrl('https://localhost:8080/report_table.js')).toBe(
      'https://localhost:8080/download.html',
    );
    expect(getDownloadRelayUrl('https://customer.cloud.looker.com/plugins/visualizations/report_table.js')).toBe(
      'https://cdn.lkr.dev/viz/report-table/latest/download.html',
    );
  });

  it('should remove row collapse icons from the generated Excel data', () => {
    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    tbl.innerHTML = '<tbody><tr><td><span class="row-collapse-icon">[-]</span><span>July</span></td></tr></tbody>';
    document.body.appendChild(tbl);

    const exportedHtml = getTableExcelHtml(tbl);
    expect(exportedHtml).not.toContain('row-collapse-icon');
    expect(exportedHtml).not.toContain('[-]');
    expect(exportedHtml).toContain('July');
  });

  it('should exclude hidden and placeholder rows when excludeHiddenRows is enabled', () => {
    const tbl = document.createElement('table');
    tbl.id = 'reportTable';
    tbl.innerHTML =
      '<tbody>' +
      '<tr><td>Visible Row</td></tr>' +
      '<tr style="display: none;"><td>Hidden Row</td></tr>' +
      '<tr data-subtotal-path="All|(Expand Men...)"><td>(Expand Men...)</td></tr>' +
      '</tbody>';
    document.body.appendChild(tbl);

    const exportedHtml = getTableExcelHtml(tbl, { excludeHiddenRows: true });
    expect(exportedHtml).toContain('Visible Row');
    expect(exportedHtml).not.toContain('Hidden Row');
    expect(exportedHtml).not.toContain('(Expand Men...)');
  });

  it('should omit transparent child backgrounds and only indent cells with >= 15px padding', () => {
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

    const exportedHtml = getTableExcelHtml(tbl);
    expect(exportedHtml).not.toContain('rgba(0, 0, 0, 0)');
    expect(exportedHtml).not.toContain('sort-icon');
    expect(exportedHtml).toContain('\u200B\u00A0\u00A0\u00A0\u00A0AMER Ops</span>');
    expect(exportedHtml).toContain('>832</td>');
  });
});
