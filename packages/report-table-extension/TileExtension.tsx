import React, { useEffect, useState } from "react";
import {
  connectExtensionHost,
  ExtensionSDK,
  RawVisualizationData,
} from "@looker/extension-sdk";
import { QueryResponse, ReportTable, VisConfig } from "report-table-react";

export const TileExtension: React.FC<{ host?: ExtensionSDK }> = ({ host }) => {
  const [extensionSDK, setExtensionSDK] = useState<ExtensionSDK | undefined>(
    host,
  );
  const [visData, setVisData] = useState<RawVisualizationData | undefined>(
    host?.visualizationSDK?.visualizationData,
  );

  useEffect(() => {
    if (host) return;
    connectExtensionHost({
      visualizationDataReceivedCallback: setVisData,
    }).then((sdk) => {
      setExtensionSDK(sdk);
      if (sdk.visualizationSDK.visualizationData) {
        setVisData(sdk.visualizationSDK.visualizationData);
      }
    });
  }, [host]);

  const tileSDK = extensionSDK?.tileSDK;
  const visualizationSDK = extensionSDK?.visualizationSDK;
  const visConfig = (visData?.visConfig as VisConfig) || {};
  const queryResponse = visData?.queryResponse as unknown as
    | QueryResponse
    | undefined;

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

  if (!queryResponse || (queryResponse?.fields?.pivots?.length ?? 0) > 2) {
    return <div style={{ width: "100%", height: "100%" }} />;
  }

  return (
    <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
      <ReportTable
        data={queryResponse.data || []}
        queryResponse={queryResponse}
        config={visConfig}
        updateConfig={(c) =>
          visualizationSDK?.setVisConfig({ ...visConfig, ...c })
        }
        registerOptions={(o) => visualizationSDK?.configureVisualization(o)}
        onDone={() => extensionSDK?.rendered?.()}
      />
    </div>
  );
};
