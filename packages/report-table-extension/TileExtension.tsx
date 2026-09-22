import {
  connectExtensionHost,
  ExtensionSDK,
  RawVisualizationData,
} from "@looker/extension-sdk";
import React, { useEffect, useMemo, useState } from "react";
import { QueryResponse, ReportTable, VisConfig } from "report-table-react";
import { useUserArtifacts } from "./useUserArtifacts";

export {
  areFilterValuesEqual,
  computeConfigDiff,
  computeFilterDiff,
} from "./artifactUtils";

export const TileExtension: React.FC<{ host?: ExtensionSDK }> = ({ host }) => {
  const [extensionSDK, setExtensionSDK] = useState<ExtensionSDK | undefined>(
    host,
  );
  const [visData, setVisData] = useState<RawVisualizationData | undefined>(
    undefined,
  );
  const [tileHostData, setTileHostData] = useState<
    Record<string, any> | undefined
  >(undefined);

  useEffect(() => {
    if (host) return;
    connectExtensionHost({
      visualizationDataReceivedCallback: setVisData,
      tileHostDataChangedCallback: (newHostData: Record<string, any>) =>
        setTileHostData((prev) => ({ ...(prev || {}), ...(newHostData || {}) })),
    }).then((sdk) => {
      setExtensionSDK(sdk);
      if (sdk.visualizationSDK.visualizationData) {
        setVisData(sdk.visualizationSDK.visualizationData);
      }
      if ((sdk.tileSDK as any)?.tileHostData) {
        setTileHostData((sdk.tileSDK as any).tileHostData);
      }
    });
  }, [host]);

  const activeHost = host ?? extensionSDK;
  const tileSDK = activeHost?.tileSDK;
  const visualizationSDK = activeHost?.visualizationSDK;
  const activeVisData = visData ?? visualizationSDK?.visualizationData;
  const baseVisConfig = useMemo(
    () => (activeVisData?.visConfig as VisConfig) || {},
    [activeVisData?.visConfig],
  );
  const queryResponse = activeVisData?.queryResponse as unknown as
    | QueryResponse
    | undefined;

  const { artifactLoaded, effectiveVisConfig, handleUpdateConfig } =
    useUserArtifacts({
      extensionSDK,
      activeHost,
      tileSDK,
      visualizationSDK,
      tileHostData,
      baseVisConfig,
      queryResponse,
    });

  const handleRegisterOptions = (opts: Record<string, any>) => {
    if (!visualizationSDK) return;
    const withSavedDefaults: Record<string, any> = {};
    for (const [k, opt] of Object.entries(opts)) {
      const reason =
        typeof opt?.disabledReason === "function"
          ? opt.disabledReason(baseVisConfig, queryResponse)
          : opt?.disabledReason;
      withSavedDefaults[k] =
        opt && typeof opt === "object"
          ? {
              ...opt,
              ...(baseVisConfig[k] !== undefined ? { default: baseVisConfig[k] } : {}),
              ...(reason !== undefined || opt.disabled !== undefined
                ? { disabled: Boolean(reason ?? opt.disabled), disabledReason: reason }
                : {}),
            }
          : opt;
    }
    visualizationSDK.configureVisualization(withSavedDefaults);
  };

  useEffect(() => {
    // TODO: Remove once Looker fixes the dashboard visualization title override bug (present in Looker 26.14.12).
    // Calling updateTitle('') on mount prevents the extension application label from overwriting the dashboard/tile title.
    extensionSDK?.updateTitle?.("");
  }, [extensionSDK]);

  useEffect(() => {
    if (typeof window !== "undefined" && tileSDK) {
      (window as any).LookerCharts = {
        Utils: {
          openDrillMenu: ({ links, event }: any) =>
            tileSDK.openDrillMenu({ links }, event),
        },
      };
    }
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).LookerCharts;
      }
    };
  }, [tileSDK]);

  useEffect(() => {
    const pivotCount = queryResponse?.fields?.pivots?.length ?? 0;
    if (pivotCount > 2) {
      tileSDK?.addErrors?.({
        title: "Max Two Pivots",
        message: "This visualization accepts no more than 2 pivot fields.",
        group: "pivots",
      });
      extensionSDK?.rendered?.();
    } else {
      tileSDK?.clearErrors?.();
    }
  }, [queryResponse, tileSDK, extensionSDK]);

  if (
    !queryResponse ||
    !artifactLoaded ||
    (queryResponse?.fields?.pivots?.length ?? 0) > 2
  ) {
    return <div style={{ width: "100%", height: "100%" }} />;
  }

  return (
    <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
      <ReportTable
        data={queryResponse.data || []}
        queryResponse={queryResponse}
        config={effectiveVisConfig}
        updateConfig={handleUpdateConfig}
        registerOptions={handleRegisterOptions}
        onDone={() => extensionSDK?.rendered?.()}
      />
    </div>
  );
};
