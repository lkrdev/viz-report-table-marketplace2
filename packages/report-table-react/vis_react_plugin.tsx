import React from "react";
import { Root, createRoot } from "react-dom/client";
import {
  QueryResponse,
  VisConfig,
  attachStandaloneTableRunner,
  visPlugin,
} from "report-table-js";
import { ReportTable } from "./ReportTable";

interface VisElement extends HTMLElement {
  _reactRoot?: Root;
  _reactContainer?: HTMLDivElement;
  _skipNextUpdate?: boolean;
  _skipNextUpdateTimeout?: any;
}

export const visReactPlugin = {
  ...visPlugin,
  id: "report_table_react",
  label: "Report Table (React)",

  create(element: VisElement, _config: VisConfig) {
    Object.assign(element.style, {
      position: "relative",
      margin: "0",
      padding: "0",
    });
    element.innerHTML = "";
    const container = document.createElement("div");
    container.className = "report-table-react-root";
    Object.assign(container.style, { width: "100%", height: "100%" });
    element.appendChild(container);
    element._reactContainer = container;
    element._reactRoot = createRoot(container);
  },

  destroy(element: VisElement) {
    if (element._reactRoot) {
      element._reactRoot.unmount();
      delete element._reactRoot;
    }
    if (element._skipNextUpdateTimeout) {
      clearTimeout(element._skipNextUpdateTimeout);
    }
  },

  updateAsync(
    data: any[],
    element: VisElement,
    config: VisConfig,
    queryResponse: QueryResponse,
    details: Record<string, any>,
    done: () => void,
  ) {
    if (element._skipNextUpdate) {
      element._skipNextUpdate = false;
      clearTimeout(element._skipNextUpdateTimeout);
      done?.();
      return;
    }

    const trigger = (
      typeof this.trigger === "function" ? this.trigger : () => {}
    ).bind(this);
    this.clearErrors?.();

    if ((queryResponse?.fields?.pivots?.length ?? 0) > 2) {
      this.addError?.({
        title: "Max Two Pivots",
        message: "This visualization accepts no more than 2 pivot fields.",
      });
      done?.();
      return;
    }

    if (typeof config.columnOrder === "undefined") {
      trigger("updateConfig", [{ columnOrder: {} }]);
    }

    if (!element._reactRoot || !element._reactContainer) {
      this.create(element, config);
    }

    element._reactRoot!.render(
      <ReportTable
        data={data}
        queryResponse={queryResponse}
        config={{ ...config }}
        details={details}
        updateConfig={(newConfig) => {
          Object.assign(config, newConfig);
          element._skipNextUpdate = true;
          clearTimeout(element._skipNextUpdateTimeout);
          element._skipNextUpdateTimeout = setTimeout(() => {
            element._skipNextUpdate = false;
          }, 500);
          trigger("updateConfig", [newConfig]);
        }}
        registerOptions={(opts) => trigger("registerOptions", opts)}
        onDone={done}
      />,
    );
  },
};

attachStandaloneTableRunner(visReactPlugin);
