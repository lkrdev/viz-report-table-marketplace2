import * as d3Selection from 'd3-selection'
import { ACTION_BUTTON_SIZE, ACTION_BUTTON_SPACING, RIGHT_OFFSET_BASE } from '../constants'
import { downloadTableAsExcel } from '../download_link'

const d3 = { select: d3Selection.select }

export function applyStickyStyles(element, config, dataTable) {
  const X = dataTable.getEffectiveFreezeColumns();
  const freezeHeaders = config.freezeTableHeaders;

  const visContainer = element.querySelector('#visContainer');
  if (!visContainer) return;

  if (X > 0 || freezeHeaders) {
    visContainer.style.position = 'absolute';
    visContainer.style.top = '0';
    visContainer.style.left = '0';
    visContainer.style.width = '100%';
    visContainer.style.height = '100%';
    visContainer.style.overflowX = X > 0 ? 'auto' : '';
    visContainer.style.overflowY = freezeHeaders ? 'auto' : '';
  } else {
    visContainer.style.position = '';
    visContainer.style.top = '';
    visContainer.style.left = '';
    visContainer.style.width = '';
    visContainer.style.height = '';
    visContainer.style.overflowX = '';
    visContainer.style.overflowY = '';
  }
}

export function applyStickyHeaders(element, config, dataTable) {
  applyStickyStyles(element, config, dataTable);
  if (config.freezeTableHeaders) {
    let stickyHeaderStyle = element.querySelector('#reportTableStickyHeaderStyle');
    if (!stickyHeaderStyle) {
      stickyHeaderStyle = document.createElement('style');
      stickyHeaderStyle.id = 'reportTableStickyHeaderStyle';
      stickyHeaderStyle.textContent = `
        #reportTable thead th {
          position: sticky !important;
          top: 0;
          z-index: 15;
          background-color: #ffffff;
        }
        #reportTable thead th.sticky-col {
          z-index: 25 !important;
        }
      `;
      element.appendChild(stickyHeaderStyle);
    }
  } else {
    const stickyHeaderStyle = element.querySelector('#reportTableStickyHeaderStyle');
    if (stickyHeaderStyle) {
      stickyHeaderStyle.remove();
    }
  }
}

export function applyStickyColumns(element, config, dataTable) {
  const X = dataTable.getEffectiveFreezeColumns();
  if (X > 0) {
    const visContainer = element.querySelector('#visContainer');
    if (!visContainer) return;

    const visibleCols = dataTable.getTableColumnGroups().flat();
    const numColsToFreeze = Math.min(X, visibleCols.length);

    if (numColsToFreeze > 0) {
      element.querySelectorAll('#reportTable .sticky-col').forEach(el => {
        el.style.position = '';
        el.style.left = '';
        el.classList.remove('sticky-col');
      });

      const trs = element.querySelectorAll('#reportTable tr');
      const containerLeft = visContainer.getBoundingClientRect().left;
      const scrollLeft = visContainer.scrollLeft;
      const colLefts = {};
      let rowSpans = {};

      // Pass 1: Read column left offsets without dirtying the DOM to avoid layout thrashing
      trs.forEach(tr => {
        if (tr.style.display === 'none') return;
        let c = 0;
        Array.from(tr.children).forEach(cell => {
          while (rowSpans[c] > 0) {
            rowSpans[c]--;
            c++;
          }

          const colSpan = cell.colSpan || 1;
          const rowSpan = cell.rowSpan || 1;

          if (rowSpan > 1) {
            for (let s = 0; s < colSpan; s++) {
              rowSpans[c + s] = rowSpan - 1;
            }
          }

          if (c < numColsToFreeze && colLefts[c] === undefined) {
            colLefts[c] = cell.getBoundingClientRect().left - containerLeft + scrollLeft;
          }

          c += colSpan;
        });
      });

      // Reset rowSpans for Pass 2
      rowSpans = {};

      // Pass 2: Write styles and classes in a single batch
      trs.forEach(tr => {
        if (tr.style.display === 'none') return;
        let c = 0;
        Array.from(tr.children).forEach(cell => {
          while (rowSpans[c] > 0) {
            rowSpans[c]--;
            c++;
          }

          const colSpan = cell.colSpan || 1;
          const rowSpan = cell.rowSpan || 1;

          if (rowSpan > 1) {
            for (let s = 0; s < colSpan; s++) {
              rowSpans[c + s] = rowSpan - 1;
            }
          }

          if (c < numColsToFreeze) {
            const left = colLefts[c];
            if (left !== undefined) {
              cell.style.left = left + 'px';
              cell.classList.add('sticky-col');
            }
          }

          c += colSpan;
        });
      });

      let stickyStyle = document.getElementById('reportTableStickyStyle');
      if (!stickyStyle) {
        stickyStyle = document.createElement('style');
        stickyStyle.id = 'reportTableStickyStyle';
        stickyStyle.textContent = `
          #reportTable {
            border-collapse: separate !important;
            border-spacing: 0 !important;
          }
          #reportTable .sticky-col {
            position: sticky !important;
          }
          #reportTable thead .sticky-col {
            z-index: 20;
          }
          #reportTable tbody .sticky-col {
            z-index: 10;
          }
          th.sticky-col, td.sticky-col {
            background-color: #ffffff;
          }
          #reportTable tr.hover > td.sticky-col:not(.subtotal):not(.total) {
            background-color: #ffffbb;
          }
        `;
        document.head.appendChild(stickyStyle);
      }
    }
  }
}

export function updateRowIcon(rowEl, config) {
  const isCollapsed = rowEl.classList.contains('collapsed')
  const arrowStyle = config.arrowStyle || config.arrow_style || 'arrows'
  if (arrowStyle === 'plus_minus') {
    const iconEl = rowEl.querySelector('.row-collapse-icon')
    if (iconEl) {
      iconEl.textContent = isCollapsed ? '[+]' : '[-]'
    }
  } else {
    const points = isCollapsed ? '6 9 12 15 18 9' : '6 15 12 9 18 15'
    d3.select(rowEl).select('.row-collapse-icon polyline').attr('points', points)
  }
}

export function syncRowVisibility(element, config, dataTable, callbacks = {}, skipUpdateConfig = false) {
  const { updateConfig } = callbacks;
  const rows = Array.from(element.querySelectorAll('#reportTable tbody tr'))
  const subtotalRows = rows.filter(r => r.classList.contains('subtotal'))
  const collapsedPaths = subtotalRows.filter(r => r.classList.contains('collapsed')).map(r => r.getAttribute('data-subtotal-path'))
  const unfoldedPaths = subtotalRows.filter(r => !r.classList.contains('collapsed')).map(r => r.getAttribute('data-subtotal-path'))
  
  rows.forEach(tr => {
      const trPath = tr.getAttribute('data-subtotal-path');
      const isHidden = trPath && collapsedPaths.some(cp => 
          trPath.startsWith(cp + '|') || (trPath === cp && tr.classList.contains('line_item'))
      );
      tr.style.display = isHidden ? 'none' : '';
  })
  
  if (updateConfig && !skipUpdateConfig) {
      if (config.startFolded) {
          updateConfig({ expandSubtotals: unfoldedPaths.join(',') })
      } else {
          updateConfig({ collapsedSubtotals: collapsedPaths.join(',') })
      }
  }
  applyStickyColumns(element, config, dataTable);
  applyStickyHeaders(element, config, dataTable);
}

export function applyCollapsedConfigToRows(element, config, dataTable) {
  const savedCollapsed = config.collapsedSubtotals ? config.collapsedSubtotals.split(',').filter(Boolean) : [];
  const savedUnfolded = config.expandSubtotals ? config.expandSubtotals.split(',').filter(Boolean) : [];
  element.querySelectorAll('#reportTable tbody tr.subtotal').forEach(rowEl => {
    const rowPath = rowEl.getAttribute('data-subtotal-path') || '';
    const shouldCollapse = config.startFolded
      ? !savedUnfolded.includes(rowPath)
      : savedCollapsed.includes(rowPath);
    rowEl.classList.toggle('collapsed', shouldCollapse);
    updateRowIcon(rowEl, config);
  });
  syncRowVisibility(element, config, dataTable, {}, true);
}

export function renderFloatingActionBar(element, config, dataTable, callbacks = {}) {
  const { updateConfig, redraw } = callbacks;

  const baseActionBtnStyle = {
    "position": "fixed",
    "z-index": "1001",
    "background": "white",
    "padding": "0px",
    "border": "none",
    "cursor": "pointer",
    "visibility": "hidden",
    "border-radius": "50%",
    "width": ACTION_BUTTON_SIZE + "px",
    "height": ACTION_BUTTON_SIZE + "px",
    "display": "flex",
    "align-items": "center",
    "justify-content": "center",
    "box-shadow": "0 2px 4px rgba(0, 0, 0, 0.1)"
  }

  const visContainerSelection = d3.select(element).select("#visContainer");
  const activeBtnIds = new Set();
  const step = ACTION_BUTTON_SIZE + ACTION_BUTTON_SPACING;
  let buttonCount = 0;
  const nextRightOffset = () => (RIGHT_OFFSET_BASE + (buttonCount++) * step) + "px";
  const addBtn = (id, title, onClick) => {
    activeBtnIds.add(id);
    let btn = visContainerSelection.select("#" + id);
    if (btn.empty()) {
      btn = visContainerSelection.append("button");
    }
    btn.attr("class", "vis-action-btn").attr("id", id).attr("title", title).text("");
    Object.entries(baseActionBtnStyle).forEach(([k, v]) => btn.style(k, v));
    btn.style("top", "10px").style("right", nextRightOffset());
    btn.on("click", () => onClick(btn));
    return btn;
  };
  const addStrokeSvg = (btn, elements) => {
    const svg = btn
      .append("svg")
      .attr("width", "16")
      .attr("height", "16")
      .attr("viewBox", "0 0 24 24")
      .style("fill", "none")
      .style("stroke", "#666")
      .style("stroke-width", "2")
      .style("stroke-linecap", "round")
      .style("stroke-linejoin", "round");
    elements.forEach(([tag, attrs]) => {
      const child = svg.append(tag);
      Object.entries(attrs).forEach(([k, v]) => child.attr(k, v));
    });
    return svg;
  };

  // Add download button only if exposeDownloadLink is true
  if (config.exposeDownloadLink) {
    const downloadButton = addBtn("downloadButton", "Download xls", (btn) => {
      btn.attr("class", "vis-action-btn loading");
      setTimeout(async () => {
        try {
          await downloadTableAsExcel(element, {
            excludeHiddenRows: Boolean(
              config.excludeHiddenRowsOnDownload || config.isExtension,
            ),
          });
        } finally {
          btn.attr("class", "vis-action-btn");
        }
      }, 250);
    });
    addStrokeSvg(downloadButton, [
      ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
      ["polyline", { points: "7 10 12 15 17 10" }],
      ["line", { x1: "12", y1: "15", x2: "12", y2: "3" }],
    ]);
  }

  if (config.rowSubtotals && config.allowSubtotalToggle) {
    const toggleSubtotalsBtn = addBtn("toggleSubtotalsBtn", config.hideSubtotals ? "Show Subtotals" : "Hide Subtotals", () => {
      if (updateConfig) updateConfig({ hideSubtotals: !config.hideSubtotals });
      if (redraw && !element._isReactManaged) redraw();
    });
    addStrokeSvg(
      toggleSubtotalsBtn,
      config.hideSubtotals
        ? [
            ["path", { d: "M18 4H6l6 8-6 8h12", opacity: "0.45" }],
            ["line", { x1: "3", y1: "3", x2: "21", y2: "21" }],
          ]
        : [["path", { d: "M18 4H6l6 8-6 8h12" }]],
    );
  }
      
  if (dataTable.hasSubtotals) {
    if (config.collapsedSubtotals || config.startFolded) {
      syncRowVisibility(element, config, dataTable, { updateConfig }, true)
      element.querySelectorAll('#reportTable tbody tr').forEach(rowEl => updateRowIcon(rowEl, config))
    }

    const expandAllBtn = addBtn("expandAllBtn", "Expand All", () => {
      element.querySelectorAll('#reportTable tbody tr').forEach(rowEl => {
        if (rowEl.classList.contains('collapsed')) {
          rowEl.classList.remove('collapsed')
          updateRowIcon(rowEl, config)
        }
      })
      syncRowVisibility(element, config, dataTable, { updateConfig })
    });
    addStrokeSvg(expandAllBtn, [["polyline", { points: "6 9 12 15 18 9" }]]);

    const collapseAllBtn = addBtn("collapseAllBtn", "Collapse All", () => {
      element.querySelectorAll('#reportTable tbody tr.subtotal').forEach(rowEl => {
        if (!rowEl.classList.contains('collapsed')) {
          rowEl.classList.add('collapsed')
          updateRowIcon(rowEl, config)
        }
      })
      syncRowVisibility(element, config, dataTable, { updateConfig })
    });
    addStrokeSvg(collapseAllBtn, [["polyline", { points: "6 15 12 9 18 15" }]]);
  }

  if (dataTable.clientSorts && dataTable.clientSorts.length > 0) {
    const clearSortsBtn = addBtn("clearSortsBtn", "Clear Client Sorts", () => {
      dataTable.clientSorts = []
      element._clientSorts = []
      element._skipNextUpdate = true
      if (element._skipNextUpdateTimeout) clearTimeout(element._skipNextUpdateTimeout)
      element._skipNextUpdateTimeout = setTimeout(() => { element._skipNextUpdate = false }, 500)
      if (updateConfig) updateConfig({ clientSorts: [] })
      if (redraw) redraw()
    });
    addStrokeSvg(clearSortsBtn, [
      ["line", { x1: "18", y1: "6", x2: "6", y2: "18" }],
      ["line", { x1: "6", y1: "6", x2: "18", y2: "18" }],
    ]);
  }

  const hasColumnOrderEdits = Boolean(
    (dataTable.allowDimensionOrder || dataTable.allowMeasureOrder) &&
    Object.keys(config.columnOrder || {}).length
  );
  if ((config.allowUserEdits || config.allowUserFilters) && (config.hasUserEdits || hasColumnOrderEdits)) {
    const resetEditsBtn = addBtn("resetEditsBtn", "Reset Edits", () => {
      if (updateConfig) updateConfig({ resetUserEdits: true, columnOrder: {} });
      if (redraw && !element._isReactManaged) redraw();
    });
    addStrokeSvg(resetEditsBtn, [
      ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
      ["path", { d: "M3 3v5h5" }],
    ]);
  }

  visContainerSelection.selectAll(".vis-action-btn").each(function() {
    if (!activeBtnIds.has(this.id)) d3.select(this).remove();
  });

  if (buttonCount > 0) {
    visContainerSelection
      .style("position", "relative")
      .style("cursor", "default")
      .on("mouseenter", () => {
        visContainerSelection.style("cursor", "default");
      });

    if (!document.getElementById("reportTableActionBtnStyle")) {
      const style = document.createElement("style");
      style.id = "reportTableActionBtnStyle";
      style.textContent = `
        #visContainer:hover .vis-action-btn {
          visibility: visible !important;
        }
        
        .vis-action-btn.loading {
          pointer-events: none;
        }
        
        .vis-action-btn.loading::after {
          content: '';
          position: absolute;
          top: 0px;
          left: 0px;
          width: 100%;
          height: 100%;
          border: 2px solid #e0e0e0;
          border-top: 2px solid #666;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          box-sizing: border-box;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }
}

export function handleCellHoverAndTooltip(action, d, event, rootEl, tooltipEl, dataTable) {
  if (!rootEl) return;
  const colId = (!dataTable.transposeTable ? `col${d.colid}` : `col${d.rowid}`).replace('.', '');
  const isMeasure = Boolean(d.cell_style && d.cell_style.includes('measure'));

  if (action === 'enter' || action === 'leave') {
    if (dataTable.showHighlight) {
      const colEl = rootEl.querySelector(`[id="${colId}"]`);
      if (colEl) colEl.classList.toggle('hover', action === 'enter');
    }
    if (dataTable.showTooltip && isMeasure && tooltipEl) {
      if (action === 'enter' && event) {
        tooltipEl.innerHTML = dataTable.getCellToolTip(d.rowid, d.colid);
        tooltipEl.style.left = `${(event.pageX ?? event.clientX) + 10}px`;
        tooltipEl.style.top = `${(event.pageY ?? event.clientY) + 10}px`;
        tooltipEl.classList.remove('hidden');
      } else {
        tooltipEl.classList.add('hidden');
      }
    }
  } else if (action === 'move' && dataTable.showTooltip && isMeasure && tooltipEl && event) {
    const bounds = rootEl.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    const clientX = event.clientX ?? event.pageX ?? 0;
    const clientY = event.clientY ?? event.pageY ?? 0;
    const pageX = event.pageX ?? event.clientX ?? 0;
    const pageY = event.pageY ?? event.clientY ?? 0;
    const x = clientX < bounds.x + bounds.width / 2 ? pageX + 10 : pageX - tipRect.width - 10;
    const y = clientY < bounds.y + bounds.height / 2 ? pageY + 10 : pageY - tipRect.height - 10;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }
}
