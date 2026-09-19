import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  VisPluginTableModel,
  VisConfig,
  QueryResponse,
  attachStandaloneTableRunner,
} from 'report-table-js';
import { ReportTable } from './ReportTable';

interface VisElement extends HTMLElement {
  _reactRoot?: Root;
  _reactContainer?: HTMLDivElement;
  _skipNextUpdate?: boolean;
  _skipNextUpdateTimeout?: any;
}

export const visReactPlugin = {
  id: 'report_table_react',
  label: 'Report Table (React)',
  options: VisPluginTableModel.getCoreConfigOptions(),
  trigger: function (..._args: any[]) {},
  clearErrors: function () {},
  addError: function (err: any) {
    console.error(err);
  },

  create: function (element: VisElement, _config: VisConfig) {
    element.style.position = 'relative';
    element.style.margin = '0';
    element.style.padding = '0';
    element.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'report-table-react-root';
    container.style.width = '100%';
    container.style.height = '100%';
    element.appendChild(container);

    element._reactContainer = container;
    element._reactRoot = createRoot(container);
  },

  updateAsync: function (
    data: any[],
    element: VisElement,
    config: VisConfig,
    queryResponse: QueryResponse,
    details: Record<string, any>,
    done: () => void
  ) {
    if (element._skipNextUpdate) {
      element._skipNextUpdate = false;
      if (element._skipNextUpdateTimeout) clearTimeout(element._skipNextUpdateTimeout);
      if (typeof done === 'function') done();
      return;
    }

    const trigger = (typeof this.trigger === 'function' ? this.trigger : () => {}).bind(this);
    const clearErrors = (
      typeof this.clearErrors === 'function' ? this.clearErrors : () => {}
    ).bind(this);
    const addError = (
      typeof this.addError === 'function' ? this.addError : (err: any) => console.error(err)
    ).bind(this);

    clearErrors();

    if (
      queryResponse &&
      queryResponse.fields &&
      queryResponse.fields.pivots &&
      queryResponse.fields.pivots.length > 2
    ) {
      addError({
        title: 'Max Two Pivots',
        message: 'This visualization accepts no more than 2 pivot fields.',
      });
      if (typeof done === 'function') done();
      return;
    }

    if (typeof config.columnOrder === 'undefined') {
      trigger('updateConfig', [{ columnOrder: {} }]);
    }

    const handleUpdateConfig = (newConfig: Partial<VisConfig>) => {
      Object.assign(config, newConfig);
      element._skipNextUpdate = true;
      if (element._skipNextUpdateTimeout) clearTimeout(element._skipNextUpdateTimeout);
      element._skipNextUpdateTimeout = setTimeout(() => {
        element._skipNextUpdate = false;
      }, 500);
      trigger('updateConfig', [newConfig]);
    };

    const handleRegisterOptions = (options: Record<string, any>) => {
      trigger('registerOptions', options);
    };

    if (!element._reactRoot || !element._reactContainer) {
      this.create(element, config);
    }

    element._reactRoot!.render(
      <ReportTable
        data={data}
        queryResponse={queryResponse}
        config={{ ...config }}
        details={details}
        updateConfig={handleUpdateConfig}
        registerOptions={handleRegisterOptions}
        onDone={done}
      />
    );
  },
};

const globalObj: any =
  typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {};

if (typeof globalObj.looker === 'undefined') {
  globalObj.looker = { plugins: { visualizations: { add: () => {} } } };
}

if (
  globalObj.looker &&
  globalObj.looker.plugins &&
  globalObj.looker.plugins.visualizations &&
  typeof globalObj.looker.plugins.visualizations.add === 'function'
) {
  globalObj.looker.plugins.visualizations.add(visReactPlugin);
}

attachStandaloneTableRunner(visReactPlugin);
