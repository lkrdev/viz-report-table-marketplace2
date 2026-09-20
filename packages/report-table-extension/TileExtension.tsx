import {
  connectExtensionHost,
  ExtensionSDK,
  LookerExtensionSDK,
  RawVisualizationData,
} from "@looker/extension-sdk";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { QueryResponse, ReportTable, VisConfig } from "report-table-react";

const DEFAULT_CONFIG_VALUES: Record<string, any> = {
  hideSubtotals: false,
  collapsedSubtotals: "",
  expandSubtotals: "",
  clientSorts: [],
  columnOrder: {},
};

const TRANSIENT_OVERRIDE_KEYS = new Set(["hasUserEdits", "resetUserEdits"]);

export function computeConfigDiff(
  base: VisConfig,
  overrides: Partial<VisConfig>,
): Partial<VisConfig> {
  const diff: Partial<VisConfig> = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (TRANSIENT_OVERRIDE_KEYS.has(k) || v === undefined) continue;
    const baseVal = base[k] !== undefined ? base[k] : DEFAULT_CONFIG_VALUES[k];
    if (JSON.stringify(v) !== JSON.stringify(baseVal)) {
      diff[k] = v;
    }
  }
  return diff;
}

const useCore40SDK = (extensionSDK?: ExtensionSDK) =>
  useMemo(
    () =>
      extensionSDK && typeof (extensionSDK as any).invokeCoreSdk === "function"
        ? LookerExtensionSDK.createClient(extensionSDK as any)
        : undefined,
    [extensionSDK],
  );

export const TileExtension: React.FC<{ host?: ExtensionSDK }> = ({ host }) => {
  const [extensionSDK, setExtensionSDK] = useState<ExtensionSDK | undefined>(
    host,
  );
  const core40SDK = useCore40SDK(extensionSDK);
  const [visData, setVisData] = useState<RawVisualizationData | undefined>(
    host?.visualizationSDK?.visualizationData,
  );
  const [tileHostData, setTileHostData] = useState<
    Record<string, any> | undefined
  >(() => (host?.tileSDK as any)?.tileHostData);
  const [artifactKey, setArtifactKey] = useState<string | null>(null);
  const [userOverrides, setUserOverrides] = useState<Partial<VisConfig>>({});
  const [artifactLoaded, setArtifactLoaded] = useState(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (host) return;
    connectExtensionHost({
      visualizationDataReceivedCallback: setVisData,
      tileHostDataChangedCallback: setTileHostData,
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

  const tileSDK = extensionSDK?.tileSDK;
  const visualizationSDK = extensionSDK?.visualizationSDK;
  const baseVisConfig = (visData?.visConfig as VisConfig) || {};
  const queryResponse = visData?.queryResponse as unknown as
    | QueryResponse
    | undefined;

  const thd = tileHostData ?? (tileSDK as any)?.tileHostData;
  const lookerHostData =
    extensionSDK?.lookerHostData ?? (tileSDK as any)?.hostApi?._lookerHostData;
  const namespace = lookerHostData?.extensionId || "report-table-extension";
  const hostPath = `${lookerHostData?.hostUrl || ""} ${lookerHostData?.route || ""}`;
  const urlLookId = hostPath.match(/\/looks\/([^/?#\s]+)/)?.[1];
  const queryServerId = (queryResponse as any)?.server_id;

  const isDashboardView = Boolean(
    thd?.elementId != null && !thd?.isDashboardEditing,
  );
  const isCandidateLookView = Boolean(
    urlLookId || (thd?.isExploring && !lookerHostData?.route && queryServerId),
  );
  const allowUserEdits = Boolean(baseVisConfig.allowUserEdits);
  const canPersistUserEdits =
    allowUserEdits && (isDashboardView || isCandidateLookView);

  useEffect(() => {
    let cancelled = false;
    if (!core40SDK || !canPersistUserEdits) {
      setArtifactKey(null);
      setUserOverrides({});
      setArtifactLoaded(true);
      return;
    }

    setArtifactLoaded(false);
    (async () => {
      try {
        const user = await core40SDK.ok(core40SDK.me("id"));
        const userId = user?.id;
        if (!userId || cancelled) return;

        let resolvedLookId = urlLookId;
        if (!isDashboardView && !resolvedLookId && queryServerId) {
          const looks = await core40SDK.ok(
            core40SDK.search_looks({
              query_id: String(queryServerId),
              fields: "id",
            }),
          );
          resolvedLookId = looks?.[0]?.id ? String(looks[0].id) : undefined;
        }

        if (cancelled) return;
        if (!isDashboardView && !resolvedLookId) {
          setArtifactKey(null);
          setUserOverrides({});
          return;
        }

        const key = isDashboardView
          ? `user_${userId}_element_${thd.elementId}`
          : `user_${userId}_look_${resolvedLookId}`;

        if (cancelled) return;
        setArtifactKey(key);

        // Note: In @looker/sdk 4.0 (JS/TS), `artifact(request: IRequestArtifact)` takes a single
        // `{ namespace, key }` object, unlike `update_artifacts(namespace, body)` and
        // `delete_artifact(namespace, key)` which take positional arguments.
        const artifacts = await core40SDK.ok(
          core40SDK.artifact({ namespace, key }),
        );
        if (cancelled) return;
        const record = artifacts?.[0];
        if (record?.value) {
          const parsed =
            typeof record.value === "string"
              ? JSON.parse(record.value)
              : record.value;
          setUserOverrides(parsed && typeof parsed === "object" ? parsed : {});
        } else {
          setUserOverrides({});
        }
      } catch {
        if (!cancelled) {
          setUserOverrides({});
        }
      } finally {
        if (!cancelled) {
          setArtifactLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    core40SDK,
    canPersistUserEdits,
    isDashboardView,
    thd?.elementId,
    urlLookId,
    queryServerId,
    namespace,
  ]);

  const effectiveVisConfig = useMemo(() => {
    if (!artifactKey || !allowUserEdits) return baseVisConfig;
    const merged: VisConfig = { ...baseVisConfig };
    for (const [k, v] of Object.entries(userOverrides)) {
      if (v !== undefined) {
        merged[k] = v;
      }
    }
    merged.hasUserEdits = Object.keys(userOverrides).length > 0;
    return merged;
  }, [artifactKey, allowUserEdits, baseVisConfig, userOverrides]);

  const handleRegisterOptions = (opts: Record<string, any>) => {
    if (!visualizationSDK) return;
    const withSavedDefaults: Record<string, any> = {};
    for (const [k, opt] of Object.entries(opts)) {
      withSavedDefaults[k] =
        opt && typeof opt === "object" && baseVisConfig[k] !== undefined
          ? { ...opt, default: baseVisConfig[k] }
          : opt;
    }
    visualizationSDK.configureVisualization(withSavedDefaults);
  };

  const handleUpdateConfig = (partial: Partial<VisConfig>) => {
    if (isDashboardView || artifactKey) {
      if (!allowUserEdits || !artifactKey || !core40SDK) {
        return;
      }
    } else if (isCandidateLookView) {
      return;
    } else {
      visualizationSDK?.setVisConfig({ ...baseVisConfig, ...partial });
      return;
    }

    if ((partial as any).resetUserEdits) {
      setUserOverrides({});
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          const existingList = await core40SDK.ok(
            core40SDK.artifact({ namespace, key: artifactKey }),
          );
          if (existingList?.[0]?.key) {
            await core40SDK.ok(
              core40SDK.delete_artifact(namespace, artifactKey),
            );
          }
        })
        .catch(() => {});
      return;
    }

    // Optimistic local update for immediate UI responsiveness
    setUserOverrides((prev) =>
      computeConfigDiff(baseVisConfig, { ...prev, ...partial }),
    );

    saveQueueRef.current = saveQueueRef.current
      .then(async () => {
        const existingList = await core40SDK.ok(
          core40SDK.artifact({ namespace, key: artifactKey }),
        );
        const existing = existingList?.[0];

        const serverOverrides = existing?.value
          ? typeof existing.value === "string"
            ? JSON.parse(existing.value)
            : existing.value
          : {};

        // Merge incoming partial on top of latest server state so edits in another tab aren't clobbered.
        // Do NOT replace `...partial` with `...prev` here: `userOverrides` (`prev`) is a sparse diff
        // that omits keys matching `baseVisConfig`, so spreading `{ ...serverOverrides, ...prev }`
        // after a user reverts a key back to `baseVisConfig` would resurrect the stale key from `serverOverrides`.
        const mergedDiff = computeConfigDiff(baseVisConfig, {
          ...(serverOverrides && typeof serverOverrides === "object"
            ? serverOverrides
            : {}),
          ...partial,
        });
        setUserOverrides(mergedDiff);

        if (Object.keys(mergedDiff).length === 0) {
          if (existing?.key) {
            await core40SDK.ok(
              core40SDK.delete_artifact(namespace, artifactKey),
            );
          }
          return;
        }

        await core40SDK.ok(
          core40SDK.update_artifacts(namespace, [
            {
              key: artifactKey,
              value: JSON.stringify(mergedDiff),
              content_type: "application/json",
              ...(existing?.version != null
                ? { version: existing.version }
                : {}),
            },
          ]),
        );
      })
      .catch(() => {});
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
