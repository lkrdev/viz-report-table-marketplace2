import * as d3Selection from 'd3-selection'
import { getTableExcelDataUrl } from '../download_link'
import { VisPluginTableModel } from '../model/table_model'
import { buildReportTable, getHeaderCellSortInfo } from './table_renderer'

const d3 = { select: d3Selection.select }

const themes = {
  traditional: require('../theme_traditional.css'),
  looker: require('../theme_looker.css'),
  contemporary: require('../theme_contemporary.css'),

  fixed: require('../layout_fixed.css'),
  auto: require('../layout_auto.css')
}

const removeStyles = function() {
  const links = document.getElementsByTagName('link')
  while (links[0]) links[0].parentNode.removeChild(links[0])

  Object.keys(themes).forEach((theme) => {
    try {
      themes[theme].unuse();
    } catch(e) {}
  });
}

const loadStylesheet = function(link) {
  return new Promise((resolve) => {
    const linkElement = document.createElement('link');

    linkElement.setAttribute('rel', 'stylesheet');
    linkElement.setAttribute('href', link);
    linkElement.onload = () => resolve();
    linkElement.onerror = () => {
      console.warn('Failed to load stylesheet: ' + link);
      resolve();
    };

    document.getElementsByTagName('head')[0].appendChild(linkElement);
  });
};

let lastThemeSignature = null;

const loadThemeStyles = function(config, element = null) {
  const sig = `${config.theme || ''}|${config.layout || ''}|${config.customTheme || ''}`;
  const prevSig = element ? element._lastThemeSignature : lastThemeSignature;
  if (sig === prevSig) {
    return null;
  }
  if (element) {
    element._lastThemeSignature = sig;
  }
  lastThemeSignature = sig;

  let stylesLoadedPromise = null;
  removeStyles();
  if (typeof config.customTheme !== 'undefined' && config.customTheme && config.theme === 'custom') {
    if (typeof themes[config.layout] !== 'undefined') {
      themes[config.layout].use()
    }
    stylesLoadedPromise = loadStylesheet(config.customTheme);
  } else {
    if (typeof themes[config.theme] !== 'undefined') {
      themes[config.theme].use()
    }
    if (typeof themes[config.layout] !== 'undefined') {
      themes[config.layout].use()
    }
  }
  return stylesLoadedPromise;
}

const visPlugin = {
  options: VisPluginTableModel.getCoreConfigOptions(),
  trigger: function() {},
  clearErrors: function() {},
  addError: function(err) { console.error(err); },
  
  create: function(element, config) {
    this.tooltip = d3.select(element)
      .append("div")
      .attr("id", "tooltip")
      .attr("class", "hidden")
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    if (element._skipNextUpdate) {
      element._skipNextUpdate = false
      if (element._skipNextUpdateTimeout) clearTimeout(element._skipNextUpdateTimeout)
      done()
      return;
    }

    const trigger = (typeof this.trigger === 'function' ? this.trigger : () => {}).bind(this);
    const clearErrors = (typeof this.clearErrors === 'function' ? this.clearErrors : () => {}).bind(this);
    const addError = (typeof this.addError === 'function' ? this.addError : (err) => console.error(err)).bind(this);

    const skipLookerEcho = () => {
      element._skipNextUpdate = true
      if (element._skipNextUpdateTimeout) clearTimeout(element._skipNextUpdateTimeout)
      element._skipNextUpdateTimeout = setTimeout(() => { element._skipNextUpdate = false }, 500)
    }
    const updateColumnOrder = newOrder => {
      Object.assign(config, { columnOrder: newOrder })
      skipLookerEcho()
      trigger('updateConfig', [{ columnOrder: newOrder }])
    }
    const updateConfig = newConfig => {
      Object.assign(config, newConfig)
      skipLookerEcho()
      if ('hideSubtotals' in newConfig) {
        Object.assign(dataTable, new VisPluginTableModel(data, queryResponse, config))
      }
      trigger('updateConfig', [newConfig])
    }

    clearErrors();

    if (queryResponse && queryResponse.fields && queryResponse.fields.pivots && queryResponse.fields.pivots.length > 2) {
      addError({
        title: 'Max Two Pivots',
        message: 'This visualization accepts no more than 2 pivot fields.'
      });
      return
    }

    try {
      var elem = element.querySelector('#visContainer');
      if (elem && elem.parentNode) elem.parentNode.removeChild(elem);  
    } catch(e) {}    

    element.style.position = 'relative';
    element.style.margin = '0';
    element.style.padding = '0';

    this.container = d3.select(element)
      .append('div')
      .attr('id', 'visContainer')

    if (typeof config.columnOrder === 'undefined') {
      trigger('updateConfig', [{ columnOrder: {} }])
    }
  
    if (typeof config.theme === 'undefined') {
      config = Object.assign({
        bodyFontSize: 12,
        headerFontSize: 12,
        theme: "traditional",
        showHighlight: true,
        showTooltip: true
      }, config)
    }

    const stylesLoadedPromise = loadThemeStyles(config, element);
    var dataTable = new VisPluginTableModel(data, queryResponse, config)
    trigger('registerOptions', dataTable.getConfigOptions())
    buildReportTable(config, dataTable, updateColumnOrder, updateConfig, element, stylesLoadedPromise).then(() => {
      if (typeof done === 'function') {
        done();
      }
    }).catch((err) => {
      console.error(err);
      if (typeof done === 'function') {
        done();
      }
    });
  }
}

export function attachStandaloneTableRunner(plugin) {
  const rootGlobal = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
  rootGlobal.looker = rootGlobal.looker || { plugins: { visualizations: { add: () => {} } } };
  if (rootGlobal.looker.plugins && rootGlobal.looker.plugins.visualizations && typeof rootGlobal.looker.plugins.visualizations.add === 'function') {
    rootGlobal.looker.plugins.visualizations.add(plugin);
  }
  rootGlobal.looker.table = function(targetElement, options = {}) {
    let el = targetElement;
    let opts = options;

    if (targetElement && !targetElement.nodeType && typeof targetElement === 'object' && targetElement.element) {
      el = targetElement.element;
      opts = targetElement;
    }

    if (typeof el === 'string' && typeof document !== 'undefined') {
      el = document.querySelector(el);
    }

    if (!el || typeof el.hasChildNodes !== 'function') {
      console.error('window.looker.table: Target element standard node or selector is required.');
      return;
    }

    const data = opts.data || [];
    const queryResponse = opts.queryResponse || opts;
    const config = opts.config || {};
    const details = opts.details || {};
    const done = opts.done || (() => {});

    const normalizedQueryResponse = Object.assign({}, queryResponse);
    if (normalizedQueryResponse.fields) {
      normalizedQueryResponse.fields = Object.assign({}, normalizedQueryResponse.fields);
      normalizedQueryResponse.fields.dimension_like = normalizedQueryResponse.fields.dimension_like || normalizedQueryResponse.fields.dimensions || [];
      normalizedQueryResponse.fields.measure_like = normalizedQueryResponse.fields.measure_like || [
        ...(normalizedQueryResponse.fields.measures || []),
        ...(normalizedQueryResponse.fields.table_calculations || [])
      ];
      normalizedQueryResponse.fields.pivots = normalizedQueryResponse.fields.pivots || [];
    } else {
      normalizedQueryResponse.fields = { dimension_like: [], measure_like: [], pivots: [] };
    }

    if (plugin.id === 'report_table_react' ? !el._reactRoot : !el.hasChildNodes()) {
      plugin.create(el, config);
    }

    plugin.updateAsync(data, el, config, normalizedQueryResponse, details, done);

    return {
      element: el,
      asExcel: () => getTableExcelDataUrl(el),
      downloadExcel: (filename) => {
        const url = getTableExcelDataUrl(el);
        if (!url) return null;
        if (typeof window !== 'undefined' && window.document) {
          const downloadRef = document.createElement("a");
          downloadRef.href = url;
          downloadRef.download = filename || `table-${new Date().toISOString().slice(0, 10)}.xls`;
          document.body.appendChild(downloadRef);
          downloadRef.click();
          document.body.removeChild(downloadRef);
        }
        return url;
      }
    };
  };
}

if (typeof looker === 'undefined') {
  global.looker = { plugins: { visualizations: { add: () => {} } } };
}

looker.plugins.visualizations.add(visPlugin);
attachStandaloneTableRunner(visPlugin);

export { getHeaderCellSortInfo, visPlugin, loadThemeStyles, removeStyles, themes, loadStylesheet }
