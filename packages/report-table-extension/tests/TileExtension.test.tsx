/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { TileExtension, computeConfigDiff } from "../TileExtension";

declare const describe: any, test: any, expect: any, jest: any;

const makeBaseQueryResponse = (extra: Record<string, any> = {}) => ({
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
  ...extra,
});

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
          queryResponse: makeBaseQueryResponse(),
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

  test("computeConfigDiff keeps only keys differing from base config or defaults", () => {
    const base = {
      theme: "traditional",
      rowSubtotals: true,
      allowSubtotalToggle: true,
    };

    expect(
      computeConfigDiff(base, {
        hideSubtotals: true,
        theme: "traditional",
      }),
    ).toEqual({ hideSubtotals: true });

    expect(
      computeConfigDiff(base, {
        hideSubtotals: false,
        collapsedSubtotals: "",
        clientSorts: [],
        columnOrder: {},
      }),
    ).toEqual({});
  });

  test("Dashboard view loads user+element artifact override, saves diff with version on update, and deletes when reverted to base", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const setVisConfig = jest.fn();
    let storedArtifact: any = {
      key: "user_99_element_52",
      value: JSON.stringify({ hideSubtotals: true }),
      content_type: "application/json",
      version: 3,
    };

    const invokeCoreSdk = jest.fn(
      async (method: string, path: string, params?: any, body?: any) => {
        if (method === "GET" && path === "/user") {
          return { ok: true, value: { id: "99" } };
        }
        if (
          method === "GET" &&
          path === "/artifact/report-table%3A%3Adev-report-table-extension"
        ) {
          return { ok: true, value: storedArtifact ? [storedArtifact] : [] };
        }
        if (
          method === "PUT" &&
          path === "/artifacts/report-table%3A%3Adev-report-table-extension"
        ) {
          const item = body[0];
          storedArtifact = {
            ...item,
            version: (item.version ?? 0) + 1,
          };
          return { ok: true, value: [storedArtifact] };
        }
        if (
          method === "DELETE" &&
          path === "/artifact/report-table%3A%3Adev-report-table-extension"
        ) {
          storedArtifact = null;
          return { ok: true, value: null };
        }
        return { ok: true, value: null };
      },
    );

    const host = {
      lookerHostData: {
        extensionId: "report-table::dev-report-table-extension",
      },
      invokeCoreSdk,
      rendered: jest.fn(),
      updateTitle: jest.fn(),
      tileSDK: {
        openDrillMenu: jest.fn(),
        clearErrors: jest.fn(),
        tileHostData: {
          isDashboardEditing: false,
          isExploring: false,
          dashboardId: 5,
          elementId: 52,
        },
      },
      visualizationSDK: {
        configureVisualization: jest.fn(),
        setVisConfig,
        visualizationData: {
          visConfig: {
            theme: "traditional",
            rowSubtotals: true,
            allowSubtotalToggle: true,
            allowUserEdits: true,
            hideSubtotals: false,
          },
          queryResponse: makeBaseQueryResponse(),
        },
      },
    } as any;

    await act(async () => {
      root.render(<TileExtension host={host} />);
    });

    // Loaded initial override hideSubtotals: true from artifact store -> button title is "Show Subtotals"
    const toggleBtn = container.querySelector(
      "#toggleSubtotalsBtn",
    ) as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute("title")).toBe("Show Subtotals");

    // Click toggle -> reverts hideSubtotals back to false (matching baseVisConfig) -> should DELETE artifact
    await act(async () => {
      toggleBtn.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(setVisConfig).not.toHaveBeenCalled();
    expect(invokeCoreSdk).toHaveBeenCalledWith(
      "DELETE",
      "/artifact/report-table%3A%3Adev-report-table-extension",
      { key: "user_99_element_52" },
      null,
      undefined,
      expect.any(Object),
      "4.0",
    );
    expect(storedArtifact).toBeNull();

    // Click toggle again -> hideSubtotals becomes true (differs from base) -> should PUT new artifact
    const toggleBtnAfterDelete = container.querySelector(
      "#toggleSubtotalsBtn",
    ) as HTMLButtonElement;
    await act(async () => {
      toggleBtnAfterDelete.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(invokeCoreSdk).toHaveBeenCalledWith(
      "PUT",
      "/artifacts/report-table%3A%3Adev-report-table-extension",
      { fields: undefined },
      [
        {
          key: "user_99_element_52",
          value: JSON.stringify({ hideSubtotals: true }),
          content_type: "application/json",
        },
      ],
      undefined,
      expect.any(Object),
      "4.0",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("Look view resolves look_id from hostUrl and saves with latest version", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const setVisConfig = jest.fn();
    let storedArtifact: any = {
      key: "user_42_query_777",
      value: JSON.stringify({ collapsedSubtotals: "2026" }),
      content_type: "application/json",
      version: 10,
    };

    const invokeCoreSdk = jest.fn(
      async (method: string, path: string, params?: any, body?: any) => {
        if (method === "GET" && path === "/user") {
          return { ok: true, value: { id: "42" } };
        }
        if (
          method === "GET" &&
          path === "/artifact/report-table%3A%3Adev-report-table-extension"
        ) {
          return { ok: true, value: storedArtifact ? [storedArtifact] : [] };
        }
        if (
          method === "PUT" &&
          path === "/artifacts/report-table%3A%3Adev-report-table-extension"
        ) {
          return { ok: true, value: body };
        }
        return { ok: true, value: null };
      },
    );

    const host = {
      lookerHostData: {
        extensionId: "report-table::dev-report-table-extension",
        hostUrl: "https://example.looker.app",
      },
      invokeCoreSdk,
      rendered: jest.fn(),
      updateTitle: jest.fn(),
      tileSDK: {
        openDrillMenu: jest.fn(),
        clearErrors: jest.fn(),
        tileHostData: {
          isDashboardEditing: false,
          dashboardRunState: "RUNNING",
          isExploring: true,
        },
      },
      visualizationSDK: {
        configureVisualization: jest.fn(),
        setVisConfig,
        visualizationData: {
          visConfig: {
            theme: "traditional",
            rowSubtotals: true,
            allowSubtotalToggle: true,
            allowUserEdits: true,
            hideSubtotals: false,
          },
          queryResponse: {
            ...makeBaseQueryResponse(),
            id: 'query-result-8:{"hidden_points_if_no":[],"hidden_fields":[]}',
            server_id: 777,
          },
        },
      },
    } as any;

    await act(async () => {
      root.render(<TileExtension host={host} />);
      await new Promise((r) => setTimeout(r, 0));
    });

    const toggleBtn = container.querySelector(
      "#toggleSubtotalsBtn",
    ) as HTMLButtonElement;
    await act(async () => {
      toggleBtn.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(setVisConfig).not.toHaveBeenCalled();
    expect(invokeCoreSdk).toHaveBeenCalledWith(
      "PUT",
      "/artifacts/report-table%3A%3Adev-report-table-extension",
      { fields: undefined },
      [
        {
          key: "user_42_query_777",
          value: JSON.stringify({
            collapsedSubtotals: "2026",
            hideSubtotals: true,
          }),
          content_type: "application/json",
          version: 10,
        },
      ],
      undefined,
      expect.any(Object),
      "4.0",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("Dashboard editing mode bypasses artifacts and calls visualizationSDK.setVisConfig", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const setVisConfig = jest.fn();
    const invokeCoreSdk = jest.fn();

    const host = {
      lookerHostData: {
        extensionId: "report-table::dev-report-table-extension",
      },
      invokeCoreSdk,
      rendered: jest.fn(),
      updateTitle: jest.fn(),
      tileSDK: {
        openDrillMenu: jest.fn(),
        clearErrors: jest.fn(),
        tileHostData: {
          isDashboardEditing: true,
          isExploring: false,
          dashboardId: 5,
          elementId: 52,
        },
      },
      visualizationSDK: {
        configureVisualization: jest.fn(),
        setVisConfig,
        visualizationData: {
          visConfig: {
            theme: "traditional",
            rowSubtotals: true,
            allowSubtotalToggle: true,
            hideSubtotals: false,
          },
          queryResponse: makeBaseQueryResponse(),
        },
      },
    } as any;

    await act(async () => {
      root.render(<TileExtension host={host} />);
    });

    const toggleBtn = container.querySelector(
      "#toggleSubtotalsBtn",
    ) as HTMLButtonElement;
    await act(async () => {
      toggleBtn.click();
    });

    expect(invokeCoreSdk).not.toHaveBeenCalled();
    expect(setVisConfig).toHaveBeenCalledWith(
      expect.objectContaining({ hideSubtotals: true }),
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("Multi-tab concurrency: merges partial update onto latest server artifact modified by another tab", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    // Initially empty when Tab B mounts
    let storedArtifact: any = null;

    const invokeCoreSdk = jest.fn(
      async (method: string, path: string, params?: any, body?: any) => {
        if (method === "GET" && path === "/user") {
          return { ok: true, value: { id: "99" } };
        }
        if (
          method === "GET" &&
          path === "/artifact/report-table%3A%3Adev-report-table-extension"
        ) {
          return { ok: true, value: storedArtifact ? [storedArtifact] : [] };
        }
        if (
          method === "PUT" &&
          path === "/artifacts/report-table%3A%3Adev-report-table-extension"
        ) {
          return { ok: true, value: body };
        }
        return { ok: true, value: null };
      },
    );

    const host = {
      lookerHostData: {
        extensionId: "report-table::dev-report-table-extension",
      },
      invokeCoreSdk,
      rendered: jest.fn(),
      updateTitle: jest.fn(),
      tileSDK: {
        openDrillMenu: jest.fn(),
        clearErrors: jest.fn(),
        tileHostData: {
          isDashboardEditing: false,
          isExploring: false,
          dashboardId: 5,
          elementId: 52,
        },
      },
      visualizationSDK: {
        configureVisualization: jest.fn(),
        setVisConfig: jest.fn(),
        visualizationData: {
          visConfig: {
            theme: "traditional",
            rowSubtotals: true,
            allowSubtotalToggle: true,
            allowUserEdits: true,
            hideSubtotals: false,
          },
          queryResponse: makeBaseQueryResponse(),
        },
      },
    } as any;

    await act(async () => {
      root.render(<TileExtension host={host} />);
      await new Promise((r) => setTimeout(r, 0));
    });

    // Simulate Tab A saving { collapsedSubtotals: "2026" } at version 5 while Tab B is already open
    storedArtifact = {
      key: "user_99_element_52",
      value: JSON.stringify({ collapsedSubtotals: "2026" }),
      content_type: "application/json",
      version: 5,
    };

    // Now user in Tab B clicks Toggle Subtotals (partial = { hideSubtotals: true })
    const toggleBtn = container.querySelector(
      "#toggleSubtotalsBtn",
    ) as HTMLButtonElement;
    await act(async () => {
      toggleBtn.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    // Tab B's GET-before-PUT fetches Tab A's version 5 and merges { hideSubtotals: true } onto { collapsedSubtotals: "2026" }
    expect(invokeCoreSdk).toHaveBeenCalledWith(
      "PUT",
      "/artifacts/report-table%3A%3Adev-report-table-extension",
      { fields: undefined },
      [
        {
          key: "user_99_element_52",
          value: JSON.stringify({
            collapsedSubtotals: "2026",
            hideSubtotals: true,
          }),
          content_type: "application/json",
          version: 5,
        },
      ],
      undefined,
      expect.any(Object),
      "4.0",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("When allowUserEdits is off, user artifact overrides are neither applied nor saved in view mode", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const setVisConfig = jest.fn();
    const invokeCoreSdk = jest.fn();

    const host = {
      lookerHostData: {
        extensionId: "report-table::dev-report-table-extension",
      },
      invokeCoreSdk,
      rendered: jest.fn(),
      updateTitle: jest.fn(),
      tileSDK: {
        openDrillMenu: jest.fn(),
        clearErrors: jest.fn(),
        tileHostData: {
          isDashboardEditing: false,
          isExploring: false,
          dashboardId: 5,
          elementId: 52,
        },
      },
      visualizationSDK: {
        configureVisualization: jest.fn(),
        setVisConfig,
        visualizationData: {
          visConfig: {
            theme: "traditional",
            rowSubtotals: true,
            allowSubtotalToggle: true,
            allowUserEdits: false,
            hideSubtotals: false,
          },
          queryResponse: makeBaseQueryResponse(),
        },
      },
    } as any;

    await act(async () => {
      root.render(<TileExtension host={host} />);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(invokeCoreSdk).not.toHaveBeenCalled();
    expect(container.querySelector("#resetEditsBtn")).toBeNull();

    const toggleBtn = container.querySelector(
      "#toggleSubtotalsBtn",
    ) as HTMLButtonElement;
    await act(async () => {
      toggleBtn.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(invokeCoreSdk).not.toHaveBeenCalled();
    expect(setVisConfig).not.toHaveBeenCalled();
    expect(container.querySelector("#resetEditsBtn")).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("Reset Edits button renders when user has active edits and Allow User Edits is on, and resets edits + deletes artifact on click", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const configureVisualization = jest.fn();
    let storedArtifact: any = {
      key: "user_99_query_qid_123",
      value: JSON.stringify({ hideSubtotals: true }),
      content_type: "application/json",
      version: 2,
    };

    const invokeCoreSdk = jest.fn(
      async (method: string, path: string, params?: any, body?: any) => {
        if (method === "GET" && path === "/user") {
          return { ok: true, value: { id: "99" } };
        }
        if (
          method === "GET" &&
          path === "/artifact/report-table%3A%3Adev-report-table-extension"
        ) {
          return { ok: true, value: storedArtifact ? [storedArtifact] : [] };
        }
        if (
          method === "DELETE" &&
          path === "/artifact/report-table%3A%3Adev-report-table-extension"
        ) {
          storedArtifact = null;
          return { ok: true, value: null };
        }
        return { ok: true, value: null };
      },
    );

    const host = {
      lookerHostData: {
        extensionId: "report-table::dev-report-table-extension",
        hostUrl: "https://example.looker.app",
      },
      invokeCoreSdk,
      rendered: jest.fn(),
      updateTitle: jest.fn(),
      tileSDK: {
        openDrillMenu: jest.fn(),
        clearErrors: jest.fn(),
        tileHostData: {
          isDashboardEditing: false,
          dashboardRunState: "RUNNING",
          isExploring: true,
        },
      },
      visualizationSDK: {
        configureVisualization,
        setVisConfig: jest.fn(),
        visualizationData: {
          visConfig: {
            theme: "traditional",
            rowSubtotals: true,
            allowSubtotalToggle: true,
            allowUserEdits: true,
            hideSubtotals: false,
          },
          queryResponse: makeBaseQueryResponse({ server_id: "qid_123" }),
        },
      },
    } as any;

    await act(async () => {
      root.render(<TileExtension host={host} />);
      await new Promise((r) => setTimeout(r, 0));
    });

    // Verify configureVisualization preserved saved baseVisConfig values as option defaults
    expect(configureVisualization).toHaveBeenCalled();
    const registeredOpts = configureVisualization.mock.calls[0][0];
    expect(registeredOpts.rowSubtotals.default).toBe(true);
    expect(registeredOpts.allowSubtotalToggle.default).toBe(true);
    expect(registeredOpts.allowUserEdits.default).toBe(true);

    // Reset Edits button is visible because storedArtifact has { hideSubtotals: true }
    const resetBtn = container.querySelector(
      "#resetEditsBtn",
    ) as HTMLButtonElement;
    expect(resetBtn).not.toBeNull();
    expect(resetBtn.getAttribute("title")).toBe("Reset Edits");

    // Click Reset Edits -> clears overrides and deletes artifact
    await act(async () => {
      resetBtn.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(invokeCoreSdk).toHaveBeenCalledWith(
      "DELETE",
      "/artifact/report-table%3A%3Adev-report-table-extension",
      { key: "user_99_query_qid_123" },
      null,
      undefined,
      expect.any(Object),
      "4.0",
    );
    expect(storedArtifact).toBeNull();
    expect(container.querySelector("#resetEditsBtn")).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("allowUserFilters restores saved filters on load, skips identical filters, saves user filter changes, and resets to defaults on Reset Edits", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    let storedFilterArtifact: any = {
      key: "user_99_dashboard_5_filters",
      value: JSON.stringify({
        Status: "Cancelled",
        Region: "West",
        Priority: "High",
      }),
      content_type: "application/json",
      version: 1,
    };

    const invokeCoreSdk = jest.fn(
      async (method: string, path: string, params?: any, body?: any) => {
        if (method === "GET" && path === "/user") {
          return { ok: true, value: { id: "99" } };
        }
        if (
          method === "GET" &&
          path === "/artifact/report-table%3A%3Adev-report-table-extension"
        ) {
          if (params?.key === "user_99_dashboard_5_filters") {
            return {
              ok: true,
              value: storedFilterArtifact ? [storedFilterArtifact] : [],
            };
          }
          return { ok: true, value: [] };
        }
        if (
          method === "PUT" &&
          path === "/artifacts/report-table%3A%3Adev-report-table-extension"
        ) {
          const item = body[0];
          if (item.key === "user_99_dashboard_5_filters") {
            storedFilterArtifact = {
              ...item,
              version: (item.version ?? 0) + 1,
            };
            return { ok: true, value: [storedFilterArtifact] };
          }
        }
        if (
          method === "DELETE" &&
          path === "/artifact/report-table%3A%3Adev-report-table-extension"
        ) {
          if (params?.key === "user_99_dashboard_5_filters") {
            storedFilterArtifact = null;
          }
          return { ok: true, value: null };
        }
        return { ok: true, value: null };
      },
    );

    const updateFilters = jest.fn();
    const runDashboard = jest.fn();

    const makeHost = (dashboardFilters: Record<string, string>) =>
      ({
        lookerHostData: {
          extensionId: "report-table::dev-report-table-extension",
        },
        invokeCoreSdk,
        rendered: jest.fn(),
        updateTitle: jest.fn(),
        tileSDK: {
          openDrillMenu: jest.fn(),
          clearErrors: jest.fn(),
          updateFilters,
          runDashboard,
          tileHostData: {
            isDashboardEditing: false,
            isExploring: false,
            dashboardId: 5,
            elementId: 52,
            dashboardFilters,
          },
        },
        visualizationSDK: {
          configureVisualization: jest.fn(),
          setVisConfig: jest.fn(),
          visualizationData: {
            visConfig: {
              theme: "traditional",
              allowUserFilters: true,
            },
            queryResponse: makeBaseQueryResponse(),
          },
        },
      }) as any;

    // Dashboard initially loads with defaults: Status="Active", Region="West" (already matches saved), Priority="Low"
    await act(async () => {
      root.render(
        <TileExtension
          host={makeHost({
            Status: "Active",
            Region: "West",
            Priority: "Low",
          })}
        />,
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    // Only the 2 differing filters (Status and Priority) should be updated; Region="West" is skipped because it already matches
    expect(updateFilters).toHaveBeenCalledTimes(1);
    expect(updateFilters).toHaveBeenCalledWith(
      { Status: "Cancelled", Priority: "High" },
      false,
    );
    expect(runDashboard).toHaveBeenCalledTimes(1);

    // Simulate Looker echoing the updated dashboardFilters back via tileSDK
    await act(async () => {
      root.render(
        <TileExtension
          host={makeHost({
            Status: "Cancelled",
            Region: "West",
            Priority: "High",
          })}
        />,
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should NOT trigger a PUT on the echo
    expect(
      invokeCoreSdk.mock.calls.filter((c: any) => c[0] === "PUT"),
    ).toHaveLength(0);

    // Now simulate the user changing Status to "Shipped" and Priority back to "Low" (the default) in Looker's filter bar
    await act(async () => {
      root.render(
        <TileExtension
          host={makeHost({
            Status: "Shipped",
            Region: "West",
            Priority: "Low",
          })}
        />,
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should save only { Status: "Shipped" } (since Region="West" and Priority="Low" match the initial dashboard defaults)
    expect(storedFilterArtifact).not.toBeNull();
    expect(JSON.parse(storedFilterArtifact.value)).toEqual({
      Status: "Shipped",
    });

    // Reset Edits button should be visible because Status="Shipped" differs from initial default Status="Active"
    const resetBtn = container.querySelector(
      "#resetEditsBtn",
    ) as HTMLButtonElement;
    expect(resetBtn).not.toBeNull();

    updateFilters.mockClear();
    runDashboard.mockClear();

    // Click Reset Edits -> restores Status="Active" (1 filter -> updateFilters with run=true) and deletes the filter artifact
    await act(async () => {
      resetBtn.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(updateFilters).toHaveBeenCalledTimes(1);
    expect(updateFilters).toHaveBeenCalledWith({ Status: "Active" }, true);
    expect(runDashboard).not.toHaveBeenCalled();
    expect(storedFilterArtifact).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("allowUserFilters does not call updateFilters or runDashboard when saved filters already match active filters", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const invokeCoreSdk = jest.fn(async (method: string, path: string) => {
      if (method === "GET" && path === "/user") {
        return { ok: true, value: { id: "99" } };
      }
      if (
        method === "GET" &&
        path === "/artifact/report-table%3A%3Adev-report-table-extension"
      ) {
        return {
          ok: true,
          value: [
            {
              key: "user_99_dashboard_5_filters",
              value: JSON.stringify({ Status: "Active", Region: "West" }),
              content_type: "application/json",
              version: 1,
            },
          ],
        };
      }
      return { ok: true, value: null };
    });

    const updateFilters = jest.fn();
    const runDashboard = jest.fn();

    const host = {
      lookerHostData: {
        extensionId: "report-table::dev-report-table-extension",
      },
      invokeCoreSdk,
      rendered: jest.fn(),
      updateTitle: jest.fn(),
      tileSDK: {
        openDrillMenu: jest.fn(),
        clearErrors: jest.fn(),
        updateFilters,
        runDashboard,
        tileHostData: {
          isDashboardEditing: false,
          isExploring: false,
          dashboardId: 5,
          elementId: 52,
          dashboardFilters: { Status: "Active", Region: "West" },
        },
      },
      visualizationSDK: {
        configureVisualization: jest.fn(),
        setVisConfig: jest.fn(),
        visualizationData: {
          visConfig: {
            theme: "traditional",
            allowUserFilters: true,
          },
          queryResponse: makeBaseQueryResponse(),
        },
      },
    } as any;

    await act(async () => {
      root.render(<TileExtension host={host} />);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(updateFilters).not.toHaveBeenCalled();
    expect(runDashboard).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("allowUserFilters applies saved filter when active filter is empty or matches dashboard default, but preserves explicit non-default URL filter", async () => {
    const runScenario = async (activeCreatedYear: string) => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      const invokeCoreSdk = jest.fn(
        async (method: string, path: string, params?: any) => {
          if (method === "GET" && path === "/user") {
            return { ok: true, value: { id: "99" } };
          }
          if (
            method === "GET" &&
            path === "/dashboards/5/dashboard_filters"
          ) {
            // Dashboard defaults: Created Date = "before 0 months ago", Created Year = "4 year"
            return {
              ok: true,
              value: [
                {
                  name: "Created Date",
                  default_value: "before 0 months ago",
                },
                {
                  name: "Created Year",
                  default_value: "4 year",
                },
              ],
            };
          }
          if (
            method === "GET" &&
            path === "/artifact/report-table%3A%3Adev-report-table-extension" &&
            params?.key === "user_99_dashboard_5_filters"
          ) {
            // Saved artifact: Created Date = "before 0 months ago", Created Year = "5 year"
            return {
              ok: true,
              value: [
                {
                  key: "user_99_dashboard_5_filters",
                  value: JSON.stringify({
                    "Created Date": "before 0 months ago",
                    "Created Year": "5 year",
                  }),
                  content_type: "application/json",
                  version: 1,
                },
              ],
            };
          }
          return { ok: true, value: [] };
        },
      );

      const updateFilters = jest.fn();
      const runDashboard = jest.fn();

      const host = {
        lookerHostData: {
          extensionId: "report-table::dev-report-table-extension",
        },
        invokeCoreSdk,
        rendered: jest.fn(),
        updateTitle: jest.fn(),
        tileSDK: {
          openDrillMenu: jest.fn(),
          clearErrors: jest.fn(),
          updateFilters,
          runDashboard,
          tileHostData: {
            isDashboardEditing: false,
            isExploring: false,
            dashboardId: 5,
            elementId: 52,
            dashboardFilters: {
              "Created Date": "before 0 months ago",
              "Created Year": activeCreatedYear,
            },
          },
        },
        visualizationSDK: {
          configureVisualization: jest.fn(),
          setVisConfig: jest.fn(),
          visualizationData: {
            visConfig: {
              theme: "traditional",
              allowUserFilters: true,
            },
            queryResponse: makeBaseQueryResponse(),
          },
        },
      } as any;

      await act(async () => {
        root.render(<TileExtension host={host} />);
        await new Promise((r) => setTimeout(r, 0));
      });

      act(() => {
        root.unmount();
      });
      container.remove();

      return { updateFilters, runDashboard };
    };

    // Case 1: No filter ("") -> applies saved "5 year"
    const emptyCase = await runScenario("");
    expect(emptyCase.updateFilters).toHaveBeenCalledWith(
      { "Created Year": "5 year" },
      true,
    );

    // Case 2: Filter matches dashboard default ("4 year") -> applies saved "5 year"
    const defaultCase = await runScenario("4 year");
    expect(defaultCase.updateFilters).toHaveBeenCalledWith(
      { "Created Year": "5 year" },
      true,
    );

    // Case 3: Filter explicitly set in URL ("6 year", not matching default "4 year") -> keeps "6 year", does NOT overwrite with saved "5 year"
    const explicitUrlCase = await runScenario("6 year");
    expect(explicitUrlCase.updateFilters).not.toHaveBeenCalled();
    expect(explicitUrlCase.runDashboard).not.toHaveBeenCalled();
  });

  test("skips visConfig and filter artifact loading, updating, and saving when lookerHostData.isRendering is true", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const invokeCoreSdk = jest.fn();
    const updateFilters = jest.fn();
    const runDashboard = jest.fn();

    const host = {
      lookerHostData: {
        extensionId: "report-table::dev-report-table-extension",
        isRendering: true,
      },
      invokeCoreSdk,
      rendered: jest.fn(),
      updateTitle: jest.fn(),
      tileSDK: {
        openDrillMenu: jest.fn(),
        clearErrors: jest.fn(),
        updateFilters,
        runDashboard,
        tileHostData: {
          isDashboardEditing: false,
          isExploring: false,
          dashboardId: 5,
          elementId: 52,
          dashboardFilters: { Status: "Active" },
        },
      },
      visualizationSDK: {
        configureVisualization: jest.fn(),
        setVisConfig: jest.fn(),
        visualizationData: {
          visConfig: {
            theme: "traditional",
            allowUserEdits: true,
            allowUserFilters: true,
          },
          queryResponse: makeBaseQueryResponse(),
        },
      },
    } as any;

    await act(async () => {
      root.render(<TileExtension host={host} />);
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(invokeCoreSdk).not.toHaveBeenCalled();
    expect(updateFilters).not.toHaveBeenCalled();
    expect(runDashboard).not.toHaveBeenCalled();
    expect(host.rendered).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});




