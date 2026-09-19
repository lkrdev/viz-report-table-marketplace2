import { INDEX_COLUMN } from '../constants'
import * as d3Selection from 'd3-selection'
import { drag as d3Drag } from 'd3-drag'
import {
  applyStickyHeaders,
  applyStickyColumns,
  syncRowVisibility,
  updateRowIcon,
  renderFloatingActionBar,
  handleCellHoverAndTooltip
} from './dom_features'

const d3 = { select: d3Selection.select, drag: d3Drag, get event() { return d3Selection.event } }

export const getHeaderCellSortInfo = (d, dataTable) => {
  if (!d) return { sortId: '', sortIndex: -1, sortObj: null, points: null };
  const isPivotRow = d.type && d.type.startsWith('pivot');
  const isTopLeftPivot = isPivotRow && d.modelField && Boolean(d.modelField.name);
  const sortByMeasures = dataTable && dataTable.sortColsBy === 'measures';

  let sortId = '';
  if (isTopLeftPivot) {
    sortId = d.modelField.name;
  } else if (d.colspan === 1 && d.column) {
    if (d.column.isDimension && d.type === 'field') {
      sortId = d.column.id;
    } else if (!d.column.isDimension && (sortByMeasures ? isPivotRow : !isPivotRow)) {
      sortId = d.column.id;
    }
  }

  const activeSorts = dataTable
    ? (typeof dataTable.getActiveSorts === 'function'
        ? dataTable.getActiveSorts()
        : ((dataTable.clientSorts && dataTable.clientSorts.length > 0) ? dataTable.clientSorts : (dataTable.sorts || [])))
    : [];
  const sortIndex = sortId && activeSorts ? activeSorts.findIndex(s => s.name === sortId) : -1;
  const sortObj = sortIndex !== -1 ? activeSorts[sortIndex] : null;

  const points = sortObj 
    ? (isTopLeftPivot 
        ? (sortObj.desc ? "15 6 9 12 15 18" : "9 6 15 12 9 18") 
        : (sortObj.desc ? "6 9 12 15 18 9" : "6 15 12 9 18 15")) 
    : null;

  return { sortId, sortIndex, sortObj, points };
};

export const getTextWidth = function(text, font = '', defaultFontSize = 12) {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) {
    return String(text || '').length * 8;
  }
  var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement('canvas'));
  var context = canvas.getContext('2d');
  if (!context) return String(text || '').length * 8;
  context.font = font || defaultFontSize + 'px arial';
  var metrics = context.measureText(text);
  return metrics.width;
};

export const computeColumnTextWidths = function(dataTable, config) {
  var columnTextWidths = {};
  if (!dataTable || !dataTable.minWidthForIndexColumns) return columnTextWidths;

  const bodyFontSize = config.bodyFontSize || 12;
  const headerFontSize = config.headerFontSize || 12;
  const measureText = (text, font = '') => getTextWidth(text, font, bodyFontSize);

  if (!dataTable.transposeTable) {
    dataTable.column_series.filter(cs => !cs.column.hide).filter(cs => cs.column.modelField.type === 'dimension').forEach(cs => {
      var columnId = cs.column.modelField.name;
      if (dataTable.useIndexColumn) {
        columnId = INDEX_COLUMN;
      }

      if (dataTable.subtotalStyle === 'collapsed') {
        const headerLabel = cs.column.getHeaderCellLabelByType('field') || '';
        const fontHeader = 'bold ' + headerFontSize + 'px arial';
        const fontBody = bodyFontSize + 'px arial';
        let maxW = measureText(headerLabel, fontHeader) + 30;

        const activeDims = dataTable.dimensions ? dataTable.dimensions.filter(d => !d.isNull && !config['hide|' + d.name] && config['style|' + d.name] !== 'hide') : [];
        const depthLimit = (!dataTable.subtotalDepth || dataTable.subtotalDepth === '(all)')
          ? (activeDims.length || 1)
          : (parseInt(dataTable.subtotalDepth, 10) || (activeDims.length || 1));
        const maxDepth = Math.max(depthLimit - 1, 0);

        dataTable.data.forEach(row => {
          if (row.type === 'subtotal') {
            const text = row.data[cs.column.id]?.rendered || row.data[cs.column.id]?.value || '';
            const depth = row.depthIndex !== undefined ? row.depthIndex : 0;
            const w = measureText(String(text), fontBody) + (depth * 16) + 40;
            if (w > maxW) maxW = w;
          } else if (row.type === 'line_item') {
            const text = row.data[cs.column.id]?.rendered || row.data[cs.column.id]?.value || '';
            const w = measureText(String(text), fontBody) + (maxDepth * 16) + 30;
            if (w > maxW) maxW = w;
          }
        });
        columnTextWidths[columnId] = Math.ceil(maxW);
      } else {
        var values = cs.series.values || [];
        var headerLabel = cs.column.getHeaderCellLabelByType('field') || '';
        var maxValW = values.length > 0 ? values.reduce((a, b) => Math.max(measureText(a), measureText(b)), 0) : 0;
        var headerW = measureText(headerLabel, 'bold ' + headerFontSize + 'pt arial') + 20;
        var maxLength = Math.max(maxValW, headerW);
        if (dataTable.useIndexColumn) {
          maxLength += 15;
        }
        columnTextWidths[columnId] = Math.ceil(maxLength);
      }
    });
  } else {
    dataTable.headers.forEach(header => {
      var fontSize = 'bold ' + bodyFontSize + 'pt arial';
      var maxLength = dataTable.transposed_data
        .map(row => row.data[header.type].rendered)
        .reduce((a, b) => Math.max(measureText(a, fontSize), measureText(b, fontSize)));
      columnTextWidths[header.type] = Math.ceil(maxLength);
    });
  }
  return columnTextWidths;
};

export const renderTable = async function(element, config, dataTable, callbacks = {}) {
  const { updateColumnOrder, updateConfig, redraw } = callbacks;
  var dropTarget = null;
  const bounds = element.getBoundingClientRect()
  const chartCentreX = bounds.x + (bounds.width / 2);
  const chartCentreY = bounds.y + (bounds.height / 2);

  var table = d3.select(element).select('#visContainer')
    .append('table')
      .attr('id', 'reportTable')
      .attr('class', dataTable.subtotalsOnTop ? 'reportTable subtotals-on-top' : 'reportTable')
      .style('opacity', 0)

  var drag = d3.drag()
    .on('start', (source, idx) => {
      if (!dataTable.has_pivots && source.colspan === 1) {
        var xPosition = parseFloat(d3.event.x);
        var yPosition = parseFloat(d3.event.y);
        var html = source.column.getHeaderCellLabelByType('field')

        d3.select("#tooltip")
            .style("left", xPosition + "px")
            .style("top", yPosition + "px")                     
            .html(html);
  
        d3.select("#tooltip").classed("hidden", false);     
      }
    })
    .on('drag', (source, idx) => {
      if (!dataTable.has_pivots) {
        d3.select("#tooltip") 
          .style("left", d3.event.x + "px")
          .style("top", d3.event.y + "px")  
      }
    })
    .on('end', (source, idx) => {
      if (!dataTable.has_pivots) {
        d3.select("#tooltip").classed("hidden", true);
        var movingColumn = source.column
        var targetColumn = dropTarget.column
        var movingIdx = Math.floor(movingColumn.pos/10) * 10
        var targetIdx = Math.floor(targetColumn.pos/10) * 10
        dataTable.moveColumns(movingIdx, targetIdx, updateColumnOrder)
      }
    })
  
  var columnTextWidths = computeColumnTextWidths(dataTable, config);
  
  var column_groups = table.selectAll('colgroup')
    .data(dataTable.getTableColumnGroups()).enter()  
      .append('colgroup')

  column_groups.selectAll('col')
    .data(d => d).enter()
      .append('col')
      .attr('id', d => ['col',d.id].join('').replace('.', '') )
      .attr('class', d => {
        const col = dataTable.columns.find(c => c.id === d.id)
        if (col && typeof col.pivot_index !== 'undefined') {
          return `pivot-group-${col.pivot_index} pivot-group-${col.pivot_index % 2 === 0 ? 'even' : 'odd'}`
        }
        return ''
      })
      .attr('span', 1)
      .style('width', d => {
        if (dataTable.minWidthForIndexColumns &&  d.type === 'index' && typeof columnTextWidths[d.id] !== 'undefined') {
          return columnTextWidths[d.id] + 'px'
        } else {
          return ''
        }
      })

  var header_rows = table.append('thead')
    .selectAll('tr')
    .data(dataTable.getHeaderTiers()).enter() 

  var header_cells = header_rows.append('tr')
    .selectAll('th')
    .data((level, i) => dataTable.getTableHeaderCells(i).map(column => column.levels[i]))
      .enter()    

  header_cells.append('th')
    .each(function(d) {
      const th = d3.select(this);
      const { sortIndex, sortObj, points } = getHeaderCellSortInfo(d, dataTable);

      if (sortIndex !== -1) {
        const container = th.append('div')
          .style('display', 'inline-flex')
          .style('align-items', 'center')
          .style('justify-content', d.align === 'right' ? 'flex-end' : d.align === 'center' ? 'center' : 'flex-start')
          .style('width', '100%');

        container.append('span').text(d.label);

        const svg = container.append('svg')
          .attr('class', 'sort-icon')
          .attr('width', 12)
          .attr('height', 12)
          .attr('viewBox', '0 0 24 24')
          .style('fill', 'none')
          .style('stroke', 'currentColor')
          .style('stroke-width', 2)
          .style('stroke-linecap', 'round')
          .style('stroke-linejoin', 'round')
          .style('margin-left', '4px')
          .style('vertical-align', 'middle')
          .style('display', 'inline-block')
          .style('flex-shrink', 0);

        svg.append('polyline').attr('points', points);

        const activeSorts = dataTable.getActiveSorts ? dataTable.getActiveSorts() : (dataTable.clientSorts || []);
        if (activeSorts.length > 1) {
          container.append('span')
            .attr('class', 'sort-num')
            .style('font-size', '75%')
            .style('margin-left', '2px')
            .style('opacity', 0.8)
            .text(sortIndex + 1);
        }
      } else {
        th.append('span').text(d.label);
      }
    })
    .attr('id', d => d.id)
    .attr('colspan', d => d.colspan)
    .attr('rowspan', d => d.rowspan)
    .attr('class', d => {
      var classes = ['reportTable']
      if (typeof d.cell_style !== 'undefined') { classes = classes.concat(d.cell_style) }
      if (d.column && typeof d.column.pivot_index !== 'undefined') {
        classes.push(`pivot-group-${d.column.pivot_index}`)
        classes.push(`pivot-group-${d.column.pivot_index % 2 === 0 ? 'even' : 'odd'}`)
      }
      return classes.join(' ')
    })
    .style('text-align', d => d.align)
    .style('font-size', config.headerFontSize + 'px')
    .style('cursor', d => getHeaderCellSortInfo(d, dataTable).sortId ? 'pointer' : 'default')
    .style('user-select', 'none')
    .attr('draggable', true)
    .call(drag)
    .on('mouseover', cell => dropTarget = cell)
    .on('mouseout', () => dropTarget = null)
    .on('click', function(d) {
      if (d3.event && d3.event.defaultPrevented) return
      const { sortId } = getHeaderCellSortInfo(d, dataTable);
      if (sortId) {
        if (d3.event) {
          d3.event.preventDefault()
          d3.event.stopPropagation()
        }
        var shiftKey = d3.event ? d3.event.shiftKey : false
        dataTable.clientSort(sortId, shiftKey)
        element._clientSorts = dataTable.clientSorts
        element._skipNextUpdate = true
        if (element._skipNextUpdateTimeout) clearTimeout(element._skipNextUpdateTimeout)
        element._skipNextUpdateTimeout = setTimeout(() => {
          element._skipNextUpdate = false
        }, 500)
        if (updateConfig) updateConfig({ clientSorts: dataTable.clientSorts })
        if (redraw) redraw()
      }
    })

  var table_rows = table.append('tbody')
    .selectAll('tr')
    .data(dataTable.getDataRows()).enter()
      .append('tr')
      .attr('class', row => {
          let classes = row.type;
          if (row.type === 'subtotal' && dataTable.subtotalsOnTop) {
              classes += ' subtotal-top subtotals-on-top';
          }
          const subtotalStyle = dataTable.subtotalStyle
          if (subtotalStyle === 'collapsed') {
              let depth = 0;
              if (row.type === 'subtotal') {
                  depth = row.depthIndex !== undefined ? row.depthIndex : 0;
              } else if (row.type === 'line_item') {
                  const activeDims = dataTable.dimensions ? dataTable.dimensions.filter(d => !d.isNull && !config['hide|' + d.name] && config['style|' + d.name] !== 'hide') : [];
                  depth = activeDims.length ? Math.max(activeDims.length - 1, 1) : 1;
              }
              classes += ` subtotal-collapsed-${depth}`;
          }

          const rowPath = row.type === 'subtotal' ? String(row.id).substring(9) : String(row.id);
          if (config.startFolded) {
              const savedUnfolded = config.expandSubtotals ? config.expandSubtotals.split(',') : [];
              if (!savedUnfolded.includes(rowPath) && row.type === 'subtotal') {
                  classes += ' collapsed'
              }
          } else {
              if (config.collapsedSubtotals) {
                  const savedCollapsed = config.collapsedSubtotals.split(',');
                  if (savedCollapsed.includes(rowPath) && row.type === 'subtotal') {
                      classes += ' collapsed'
                  }
              }
          }
          return classes
      })
      .attr('data-subtotal-path', row => {
          if (row.type === 'subtotal') {
              return String(row.id).substring(9);
          } else if (row.type === 'line_item') {
              return String(row.id);
          }
          return ''
      })
      .attr('data-subtotal-depth', row => row.depthIndex !== undefined ? row.depthIndex : '')
      .on('mouseover', function() { 
        if (dataTable.showHighlight) {
          this.classList.toggle('hover') 
        }
      })
      .on('mouseout', function() { 
        if (dataTable.showHighlight) {
          this.classList.toggle('hover') 
        }
      })

  var table_cells = table_rows.selectAll('td')
      .data(row => dataTable.getTableRowColumns(row).map(column => row.data[column.id]))
        .enter()
        .append('td')

  table_cells.html((d, i, nodes) => {
      var text = ''
      if (Array.isArray(d.value)) {
        text = !(d.rendered === null) ? d.rendered : d.value.join(' ')
      } else if (typeof d.value === 'object' && d.value !== null && typeof d.value.series !== 'undefined') {
        text = null
      } else if (d.html) {
        var parser = new DOMParser()
        var parsed_html = parser.parseFromString(d.html, 'text/html')
        text = parsed_html.documentElement.textContent
      } else if (d.rendered || d.rendered === '') {
        text = d.rendered
      } else {
        text = d.value   
      }
      text = String(text)
      text = text ? text.replace('-', '\u2011') : text

      if (d.cell_style && d.cell_style.includes('dimension')) {
          const isFirstCol = (d.colid === dataTable.firstVisibleDimension || d.colid === INDEX_COLUMN)
          if (isFirstCol) {
              const subtotalStyle = dataTable.subtotalStyle
              if (d.cell_style.includes('subtotal') && String(d.value).indexOf('Subtotal|Others') === -1) {
                  const rowPath = d.rowid.substring(9);
                  var isCollapsed = false;
                  if (config.startFolded) {
                      isCollapsed = !(config.expandSubtotals && config.expandSubtotals.split(',').includes(rowPath))
                  } else {
                      isCollapsed = config.collapsedSubtotals && config.collapsedSubtotals.split(',').includes(rowPath)
                  }
                  
                  const arrowStyle = config.arrowStyle || config.arrow_style || 'arrows'
                  let collapseIcon = ''
                  if (arrowStyle === 'plus_minus') {
                      const symbol = isCollapsed ? '[+]' : '[-]';
                      collapseIcon = `<span class="row-collapse-icon" style="cursor: pointer; margin-right: 4px; vertical-align: middle; flex-shrink: 0; font-family: monospace;">${symbol}</span>`;
                  } else {
                      const points = isCollapsed ? '6 9 12 15 18 9' : '6 15 12 9 18 15';
                      collapseIcon = `<svg class="row-collapse-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor: pointer; margin-right: 4px; vertical-align: middle; flex-shrink: 0;"><polyline points="${points}"></polyline></svg>`;
                  }

                  return `<div style="display:flex; align-items:center;">${collapseIcon}<span>${text}</span></div>`;
              } else if (subtotalStyle === 'collapsed' && !d.cell_style.includes('subtotal') && !d.cell_style.includes('total')) {
                  return `<div style="display:flex; align-items:center;"><span>${text}</span></div>`;
              }
          }
      }
      return text
    })
    .attr('rowspan', d => d.rowspan)
    .attr('colspan', d => d.colspan)
    .style('text-align', d => d.align)
    .style('font-size', config.bodyFontSize + 'px')
    .style('cursor', d => (d.links && d.links.length > 0) ? 'pointer' : 'default')
    .style('padding-left', (d, i, nodes) => {
      const subtotalStyle = dataTable.subtotalStyle
      if (subtotalStyle === 'collapsed' && d.cell_style && d.cell_style.includes('dimension')) {
        const isFirstCol = (d.colid === dataTable.firstVisibleDimension || d.colid === INDEX_COLUMN)
        if (isFirstCol) {
          let depth = 0
          if (d.cell_style.includes('subtotal')) {
            const cellEl = (nodes && nodes[i]) || null
            const trNode = cellEl && cellEl.closest ? cellEl.closest('tr') : null
            if (d.depthIndex !== undefined) {
              depth = d.depthIndex
            } else if (trNode && trNode.getAttribute('data-subtotal-depth') !== null && trNode.getAttribute('data-subtotal-depth') !== '') {
              depth = parseInt(trNode.getAttribute('data-subtotal-depth'), 10) || 0
            }
          } else if (!d.cell_style.includes('total')) {
            const activeDims = dataTable.dimensions ? dataTable.dimensions.filter(d => !d.isNull && !config['hide|' + d.name] && config['style|' + d.name] !== 'hide') : [];
            const depthLimit = (!dataTable.subtotalDepth || dataTable.subtotalDepth === '(all)')
              ? (activeDims.length || 1)
              : (parseInt(dataTable.subtotalDepth, 10) || (activeDims.length || 1));
            depth = Math.max(depthLimit - 1, 0);
          }
          return (depth * 16) + 'px'
        }
      }
      return null
    })
    .attr('class', (d, i, nodes) => {
      var classes = ['reportTable']
      if (typeof d.value === 'object') { classes.push('cellSeries') }
      if (typeof d.align !== 'undefined') { classes.push(d.align) }
      if (typeof d.cell_style !== 'undefined') { classes = classes.concat(d.cell_style) }
      if (d.cell_style && d.cell_style.includes('subtotal') && dataTable.subtotalsOnTop) {
        if (!classes.includes('subtotal-top')) classes.push('subtotal-top')
        if (!classes.includes('subtotals-on-top')) classes.push('subtotals-on-top')
      }

      const subtotalStyle = dataTable.subtotalStyle
      if (subtotalStyle === 'collapsed' && d.cell_style && d.cell_style.includes('dimension')) {
        const isFirstCol = (d.colid === dataTable.firstVisibleDimension || d.colid === INDEX_COLUMN)
        if (isFirstCol) {
          let depth = 0
          if (d.cell_style.includes('subtotal')) {
            const cellEl = (nodes && nodes[i]) || null
            const trNode = cellEl && cellEl.closest ? cellEl.closest('tr') : null
            if (d.depthIndex !== undefined) {
              depth = d.depthIndex
            } else if (trNode && trNode.getAttribute('data-subtotal-depth') !== null && trNode.getAttribute('data-subtotal-depth') !== '') {
              depth = parseInt(trNode.getAttribute('data-subtotal-depth'), 10) || 0
            }
          } else if (!d.cell_style.includes('total')) {
            const activeDims = dataTable.dimensions ? dataTable.dimensions.filter(d => !d.isNull && !config['hide|' + d.name] && config['style|' + d.name] !== 'hide') : [];
            const depthLimit = (!dataTable.subtotalDepth || dataTable.subtotalDepth === '(all)')
              ? (activeDims.length || 1)
              : (parseInt(dataTable.subtotalDepth, 10) || (activeDims.length || 1));
            depth = Math.max(depthLimit - 1, 0);
          }
          classes.push(`subtotal-collapsed-${depth}`)
        }
      }
      const col = dataTable.columns.find(c => c.id === d.colid)
      if (col && typeof col.pivot_index !== 'undefined') {
        classes.push(`pivot-group-${col.pivot_index}`)
        classes.push(`pivot-group-${col.pivot_index % 2 === 0 ? 'even' : 'odd'}`)
      }
      return classes.join(' ')
    })
    .on('mouseover', d => handleCellHoverAndTooltip('enter', d, d3.event, element, element.querySelector('#tooltip') || document.getElementById('tooltip'), dataTable))
    .on('mousemove', d => handleCellHoverAndTooltip('move', d, d3.event, element, element.querySelector('#tooltip') || document.getElementById('tooltip'), dataTable))
    .on('mouseout', d => handleCellHoverAndTooltip('leave', d, d3.event, element, element.querySelector('#tooltip') || document.getElementById('tooltip'), dataTable))
    .on('click', function(d) {
      if (d3.event.target.closest('.row-collapse-icon')) {
          d3.event.preventDefault()
          d3.event.stopPropagation()
          const rowEl = this.closest('tr')
          rowEl.classList.toggle('collapsed')
          updateRowIcon(rowEl, config)

          syncRowVisibility(element, config, dataTable, { updateConfig })
          return;
      }

      if (d.links && d.links.length > 0 && typeof LookerCharts !== 'undefined' && LookerCharts.Utils) {
        let event = {
          metaKey: d3.event.metaKey,
          pageX: d3.event.pageX,
          pageY: d3.event.pageY - window.pageYOffset
        }
        LookerCharts.Utils.openDrillMenu({
          links: d.links,
          event: event
        })
      }
    })
}

export const buildReportTable = function(config, dataTable, updateColumnOrder, updateConfig, element, stylesLoadedPromise = null) {
  const activeSorts = element._clientSorts || config.clientSorts || [];
  if (activeSorts && activeSorts.length > 0) {
    dataTable.clientSorts = activeSorts.filter(s => 
      dataTable.columns.some(c => c.id === s.name) ||
      dataTable.pivot_fields.some(p => p.name === s.name)
    );
    if (dataTable.clientSorts.length > 0) {
      dataTable.sortData();
      dataTable.sortColumns();
    }
  }

  const redraw = function() {
    d3.select(element).select('#reportTable').remove()

    return renderTable(element, config, dataTable, { updateColumnOrder, updateConfig, redraw }).then(() => {
      const reportTable = element.querySelector('#reportTable')
      if (reportTable) {
        reportTable.classList.add('reveal')
        reportTable.style.opacity = 1
      }
      renderFloatingActionBar(element, config, dataTable, { updateConfig, redraw })
      applyStickyColumns(element, config, dataTable)
      applyStickyHeaders(element, config, dataTable)
    })
  }

  if (stylesLoadedPromise) {
    return stylesLoadedPromise.then(() => {
      return redraw()
    })
  } else {
    return redraw()
  }
}
