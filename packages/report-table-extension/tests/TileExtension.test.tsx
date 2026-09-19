/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { TileExtension } from "../TileExtension";

declare const describe: any, test: any, expect: any, jest: any;

describe("TileExtension", () => {
  test("renders ReportTable with visualizationData and signals rendered()", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const configureVisualization = jest.fn();
    const setVisConfig = jest.fn();
    const rendered = jest.fn();
    const updateTitle = jest.fn();
    const openDrillMenu = jest.fn();
    const clearErrors = jest.fn();

    const host = {
      rendered,
      updateTitle,
      tileSDK: { openDrillMenu, clearErrors },
      visualizationSDK: {
        configureVisualization,
        setVisConfig,
        visualizationData: {
          visConfig: { theme: "traditional" },
          queryResponse: {
            data: [
              {
                "users.state": { value: "California" },
                "users.count": { value: 42, rendered: "42" },
              },
            ],
            fields: {
              dimension_like: [
                {
                  name: "users.state",
                  label: "State",
                  label_short: "State",
                  view_label: "Users",
                },
              ],
              measure_like: [
                {
                  name: "users.count",
                  label: "Count",
                  label_short: "Count",
                  view_label: "Users",
                  is_numeric: true,
                },
              ],
              pivots: [],
            },
          },
        },
      },
    } as any;

    await act(async () => {
      root.render(<TileExtension host={host} />);
    });

    expect(container.querySelector("#reportTable")).not.toBeNull();
    expect(container.textContent).toContain("California");
    expect(container.textContent).toContain("42");
    expect(configureVisualization).toHaveBeenCalled();
    expect(rendered).toHaveBeenCalled();
    expect(updateTitle).toHaveBeenCalledWith("");
    expect(clearErrors).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
