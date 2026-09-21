import { ExtensionSDK, LookerExtensionSDK } from "@looker/extension-sdk";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { QueryResponse, VisConfig } from "report-table-react";
import {
  applyFiltersToHost,
  areFilterValuesEqual,
  computeConfigDiff,
  computeFilterDiff,
  normalizeFilterValue,
  parseArtifactRecord,
  serializeFilters,
} from "./artifactUtils";

interface UseUserArtifactsParams {
  activeHost?: ExtensionSDK;
  tileSDK?: any;
  visualizationSDK?: any;
  tileHostData?: Record<string, any>;
  baseVisConfig: VisConfig;
  queryResponse?: QueryResponse;
}

export function useUserArtifacts({
  activeHost,
  tileSDK,
  visualizationSDK,
  tileHostData,
  baseVisConfig,
  queryResponse,
}: UseUserArtifactsParams) {
  const invokeCoreSdk = (activeHost as any)?.invokeCoreSdk;
  const core40SDK = useMemo(
    () =>
      activeHost && typeof invokeCoreSdk === "function"
        ? LookerExtensionSDK.createClient(activeHost as any)
        : undefined,
    [invokeCoreSdk],
  );

  const [artifactKey, setArtifactKey] = useState<string | null>(null);
  const [userOverrides, setUserOverrides] = useState<Partial<VisConfig>>({});
  const [filterArtifactKey, setFilterArtifactKey] = useState<string | null>(
    null,
  );
  const [filterOverrides, setFilterOverrides] = useState<Record<string, any>>(
    {},
  );
  const [artifactLoaded, setArtifactLoaded] = useState(false);

  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestPromiseRef = useRef<Promise<void> | null>(null);
  const filterSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestFilterPromiseRef = useRef<Promise<void> | null>(null);
  const initialFiltersRef = useRef<Record<string, any> | null>(null);
  const loadedSavedFiltersRef = useRef<Record<string, any>>({});
  const filtersRestoredRef = useRef(false);
  const lastAppliedFiltersJsonRef = useRef<string | null>(null);
  const pendingAppliedFiltersJsonRef = useRef<string | null>(null);

  const thd = tileHostData ?? (tileSDK as any)?.tileHostData;
  const lookerHostData =
    activeHost?.lookerHostData ?? (tileSDK as any)?.hostApi?._lookerHostData;
  const namespace = lookerHostData?.extensionId || "report-table-extension";
  const queryId =
    (queryResponse as any)?.id ?? (queryResponse as any)?.server_id;

  const isDashboardView = Boolean(
    thd?.elementId != null && !thd?.isDashboardEditing,
  );
  const isLookView = Boolean(
    !isDashboardView && !thd?.isDashboardEditing && queryId != null,
  );
  const contentKey = isDashboardView
    ? `dashboard_${thd?.dashboardId ?? ""}_element_${thd?.elementId ?? ""}`
    : isLookView
      ? `query_${queryId}`
      : "";

  const isRendering = Boolean(lookerHostData?.isRendering || thd?.isRendering);
  const allowUserEdits = Boolean(baseVisConfig.allowUserEdits) && !isRendering;
  const canPersistUserEdits =
    allowUserEdits && (isDashboardView || isLookView);
  const allowUserFilters =
    Boolean(baseVisConfig.allowUserFilters) && !isRendering;
  const canPersistUserFilters =
    allowUserFilters && (isDashboardView || isLookView);

  const currentFilters: Record<string, any> | undefined =
    thd?.dashboardFilters ?? thd?.filteredQuery?.filters;

  const enqueueArtifactSave = (
    key: string,
    computeMergedDiff: (serverObj: Record<string, any>) => Record<string, any>,
    setState: (diff: any) => void,
    queueRef: React.MutableRefObject<Promise<void>>,
    latestRef: React.MutableRefObject<Promise<void> | null>,
  ) => {
    if (!core40SDK) return;
    const promise = queueRef.current.then(async () => {
      const existingList = await core40SDK.ok(
        core40SDK.artifact({ namespace, key }),
      );
      const existing = existingList?.[0];
      const mergedDiff = computeMergedDiff(parseArtifactRecord(existing));

      if (latestRef.current === promise) {
        setState(mergedDiff);
      }

      if (Object.keys(mergedDiff).length === 0) {
        if (existing?.key) {
          await core40SDK.ok(core40SDK.delete_artifact(namespace, key));
        }
        return;
      }

      await core40SDK.ok(
        core40SDK.update_artifacts(namespace, [
          {
            key,
            value: JSON.stringify(mergedDiff),
            content_type: "application/json",
            ...(existing?.version != null
              ? { version: existing.version }
              : {}),
          },
        ]),
      );
    });
    latestRef.current = promise;
    queueRef.current = promise.catch(() => {});
  };

  const enqueueArtifactDelete = (
    key: string,
    queueRef: React.MutableRefObject<Promise<void>>,
    latestRef: React.MutableRefObject<Promise<void> | null>,
  ) => {
    if (!core40SDK) return;
    const promise = queueRef.current.then(async () => {
      const existingList = await core40SDK.ok(
        core40SDK.artifact({ namespace, key }),
      );
      if (existingList?.[0]?.key) {
        await core40SDK.ok(core40SDK.delete_artifact(namespace, key));
      }
    });
    latestRef.current = promise;
    queueRef.current = promise.catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;
    initialFiltersRef.current =
      currentFilters && typeof currentFilters === "object"
        ? { ...currentFilters }
        : null;
    loadedSavedFiltersRef.current = {};
    filtersRestoredRef.current = false;
    lastAppliedFiltersJsonRef.current = null;
    pendingAppliedFiltersJsonRef.current = null;

    if (
      !core40SDK ||
      !contentKey ||
      (!canPersistUserEdits && !canPersistUserFilters)
    ) {
      setArtifactKey(null);
      setUserOverrides({});
      setFilterArtifactKey(null);
      setFilterOverrides({});
      setArtifactLoaded(true);
      return;
    }

    setArtifactLoaded(false);
    (async () => {
      try {
        const user = await core40SDK.ok(core40SDK.me("id"));
        const userId = user?.id;
        if (!userId || cancelled) return;

        if (canPersistUserEdits) {
          // TODO: Switch `query_${queryId}` to `look_${lookId}` once Looker passes Look ID in extension host data.
          const key = isDashboardView
            ? `user_${userId}_element_${thd.elementId}`
            : `user_${userId}_query_${queryId}`;

          setArtifactKey(key);
          const artifacts = await core40SDK.ok(
            core40SDK.artifact({ namespace, key }),
          );
          if (cancelled) return;
          setUserOverrides(parseArtifactRecord(artifacts?.[0]));
        } else {
          setArtifactKey(null);
          setUserOverrides({});
        }

        if (canPersistUserFilters) {
          if (isDashboardView && thd?.dashboardId != null) {
            try {
              const dashFilters = await core40SDK.ok(
                core40SDK.dashboard_dashboard_filters(
                  String(thd.dashboardId),
                  "name,title,default_value",
                ),
              );
              if (!cancelled && Array.isArray(dashFilters)) {
                for (const df of dashFilters) {
                  const fName = df?.name || df?.title;
                  if (fName) {
                    initialFiltersRef.current = {
                      ...(initialFiltersRef.current || {}),
                      [fName]: df.default_value ?? "",
                    };
                  }
                }
              }
            } catch {
              // Fallback to initial active filters if dashboard_dashboard_filters is unavailable
            }
          }

          const fKey = isDashboardView
            ? `user_${userId}_dashboard_${thd.dashboardId ?? thd.elementId}_filters`
            : `user_${userId}_query_${queryId}_filters`;

          setFilterArtifactKey(fKey);
          const filterArtifacts = await core40SDK.ok(
            core40SDK.artifact({ namespace, key: fKey }),
          );
          if (cancelled) return;
          const validFilters = parseArtifactRecord(filterArtifacts?.[0]);
          loadedSavedFiltersRef.current = validFilters;
          setFilterOverrides(validFilters);
        } else {
          setFilterArtifactKey(null);
          loadedSavedFiltersRef.current = {};
          setFilterOverrides({});
        }
      } catch {
        if (!cancelled) {
          setUserOverrides({});
          loadedSavedFiltersRef.current = {};
          setFilterOverrides({});
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
    canPersistUserFilters,
    contentKey,
    namespace,
  ]);

  // Restore saved filters once on load after artifact fetch settles
  useEffect(() => {
    if (
      !canPersistUserFilters ||
      !artifactLoaded ||
      filtersRestoredRef.current ||
      !currentFilters ||
      typeof currentFilters !== "object"
    ) {
      return;
    }

    if (initialFiltersRef.current === null) {
      initialFiltersRef.current = { ...currentFilters };
    }

    const baseDefaults = initialFiltersRef.current;
    const saved = loadedSavedFiltersRef.current || {};
    const toApply: Record<string, any> = {};
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) continue;
      if (isDashboardView && !(k in currentFilters)) continue;
      const currentVal = currentFilters[k];
      // Only apply saved filter if the active filter is unset ("") or matches the dashboard's default filter.
      // If the URL explicitly passed a non-default filter value, preserve the URL value.
      const isUnsetOrDefault =
        normalizeFilterValue(currentVal) === "" ||
        areFilterValuesEqual(currentVal, baseDefaults[k]);
      if (isUnsetOrDefault && !areFilterValuesEqual(currentVal, v)) {
        toApply[k] = v;
      }
    }

    const mergedCurrent = { ...currentFilters, ...toApply };
    lastAppliedFiltersJsonRef.current = serializeFilters(currentFilters);
    pendingAppliedFiltersJsonRef.current =
      Object.keys(toApply).length > 0 ? serializeFilters(mergedCurrent) : null;
    filtersRestoredRef.current = true;
    setFilterOverrides(computeFilterDiff(baseDefaults, mergedCurrent));

    if (Object.keys(toApply).length > 0) {
      applyFiltersToHost(tileSDK, toApply, currentFilters, isDashboardView);
    }
  }, [
    canPersistUserFilters,
    artifactLoaded,
    currentFilters,
    isDashboardView,
    tileSDK,
  ]);

  // Persist subsequent user filter changes to Looker Artifacts
  useEffect(() => {
    if (
      !canPersistUserFilters ||
      !artifactLoaded ||
      !filtersRestoredRef.current ||
      !filterArtifactKey ||
      !core40SDK ||
      !currentFilters ||
      typeof currentFilters !== "object"
    ) {
      return;
    }

    const currentJson = serializeFilters(currentFilters);
    if (currentJson === lastAppliedFiltersJsonRef.current) {
      return;
    }
    if (
      pendingAppliedFiltersJsonRef.current !== null &&
      currentJson === pendingAppliedFiltersJsonRef.current
    ) {
      lastAppliedFiltersJsonRef.current = currentJson;
      pendingAppliedFiltersJsonRef.current = null;
      return;
    }
    lastAppliedFiltersJsonRef.current = currentJson;
    pendingAppliedFiltersJsonRef.current = null;

    const baseFilters = initialFiltersRef.current || {};
    setFilterOverrides(computeFilterDiff(baseFilters, currentFilters));

    const snapshotFilters = { ...currentFilters };
    enqueueArtifactSave(
      filterArtifactKey,
      (serverFilters) =>
        computeFilterDiff(baseFilters, {
          ...serverFilters,
          ...snapshotFilters,
        }),
      setFilterOverrides,
      filterSaveQueueRef,
      latestFilterPromiseRef,
    );
  }, [
    canPersistUserFilters,
    artifactLoaded,
    filterArtifactKey,
    core40SDK,
    currentFilters,
    namespace,
  ]);

  const effectiveVisConfig = useMemo(() => {
    const canEditVis = Boolean(artifactKey && allowUserEdits);
    const canEditFilters = Boolean(filterArtifactKey && allowUserFilters);
    if (!canEditVis && !canEditFilters) return baseVisConfig;
    const merged: VisConfig = { ...baseVisConfig };
    if (canEditVis) {
      for (const [k, v] of Object.entries(userOverrides)) {
        if (v !== undefined) {
          merged[k] = v;
        }
      }
    }
    const hasVisEdits = canEditVis && Object.keys(userOverrides).length > 0;
    const hasFilterEdits =
      canEditFilters && Object.keys(filterOverrides).length > 0;
    merged.hasUserEdits = hasVisEdits || hasFilterEdits;
    return merged;
  }, [
    artifactKey,
    allowUserEdits,
    filterArtifactKey,
    allowUserFilters,
    baseVisConfig,
    userOverrides,
    filterOverrides,
  ]);

  const handleUpdateConfig = (partial: Partial<VisConfig>) => {
    if (isRendering) return;
    if (isDashboardView || isLookView) {
      if ((partial as any).resetUserEdits) {
        if (canPersistUserEdits && artifactKey) {
          setUserOverrides({});
          enqueueArtifactDelete(artifactKey, saveQueueRef, latestPromiseRef);
        }

        if (canPersistUserFilters && filterArtifactKey) {
          setFilterOverrides({});
          loadedSavedFiltersRef.current = {};
          if (
            initialFiltersRef.current &&
            currentFilters &&
            typeof currentFilters === "object"
          ) {
            lastAppliedFiltersJsonRef.current =
              serializeFilters(currentFilters);
            pendingAppliedFiltersJsonRef.current = serializeFilters(
              initialFiltersRef.current,
            );
            applyFiltersToHost(
              tileSDK,
              initialFiltersRef.current,
              currentFilters,
              isDashboardView,
            );
          }
          enqueueArtifactDelete(
            filterArtifactKey,
            filterSaveQueueRef,
            latestFilterPromiseRef,
          );
        }
        return;
      }

      if (!allowUserEdits || !artifactKey || !core40SDK) {
        return;
      }
    } else {
      visualizationSDK?.setVisConfig({ ...baseVisConfig, ...partial });
      return;
    }

    // Optimistic local update for immediate UI responsiveness
    setUserOverrides((prev) =>
      computeConfigDiff(baseVisConfig, { ...prev, ...partial }),
    );

    enqueueArtifactSave(
      artifactKey,
      (serverOverrides) =>
        computeConfigDiff(baseVisConfig, {
          ...serverOverrides,
          ...partial,
        }),
      setUserOverrides,
      saveQueueRef,
      latestPromiseRef,
    );
  };

  return {
    artifactLoaded,
    effectiveVisConfig,
    handleUpdateConfig,
  };
}
