import * as d3 from './d3loader'
import { downloadTableAsExcel } from './download_link'
import { VisPluginTableModel } from './vis_table_plugin'

const themes = {
  traditional: require('./theme_traditional.css'),
  looker: require('./theme_looker.css'),
  contemporary: require('./theme_contemporary.css'),

  fixed: require('./layout_fixed.css'),
  auto: require('./layout_auto.css')
}

const BBOX_X_ADJUST = 10
const BBOX_Y_ADJUST = 10

const use_minicharts = false

const removeStyles = async function() {
  const links = document.getElementsByTagName('link')
  while (links[0]) links[0].parentNode.removeChild(links[0])

  Object.keys(themes).forEach(async (theme) => await themes[theme].unuse() )
}

const loadStylesheet = function(link) {
  const linkElement = document.createElement('link');

  linkElement.setAttribute('rel', 'stylesheet');
  linkElement.setAttribute('href', link);

  document.getElementsByTagName('head')[0].appendChild(linkElement);
};


const buildReportTable = function(config, dataTable, updateColumnOrder, updateConfig, element) {
  var dropTarget = null;
  const bounds = element.getBoundingClientRect()
  const chartCentreX = bounds.x + (bounds.width / 2);
  const chartCentreY = bounds.y + (bounds.height / 2);

  removeStyles().then(() => {
    if (typeof config.customTheme !== 'undefined' && config.customTheme && config.theme === 'custom') {
      loadStylesheet(config.customTheme)
    } else if (typeof themes[config.theme] !== 'undefined') {
      themes[config.theme].use()
    }
    if (typeof themes[config.layout] !== 'undefined') {
      themes[config.layout].use()
    }
  })

  const syncRowVisibility = function(skipUpdateConfig = false) {
    var rows = Array.from(document.querySelectorAll('#reportTable tbody tr'))
    var subtotalRows = rows.filter(r => r.classList.contains('subtotal'))
    var collapsedPaths = subtotalRows.filter(r => r.classList.contains('collapsed')).map(r => r.getAttribute('data-subtotal-path'))
    var unfoldedPaths = subtotalRows.filter(r => !r.classList.contains('collapsed')).map(r => r.getAttribute('data-subtotal-path'))
    
    rows.forEach(tr => {
        var trPath = tr.getAttribute('data-subtotal-path')
        var isHidden = false
        for (var cp of collapsedPaths) {
            if (trPath && trPath.startsWith(cp + '|')) {
                isHidden = true;
                break;
            }
            if (trPath && trPath === cp && tr.classList.contains('line_item')) {
                isHidden = true;
                break;
            }
        }
        if (isHidden) {
            tr.style.display = 'none'
        } else {
            tr.style.display = ''
        }
    })
    
    if (updateConfig && !skipUpdateConfig) {
        if (config.startFolded) {
            updateConfig({ expandSubtotals: unfoldedPaths.join(',') })
        } else {
            updateConfig({ collapsedSubtotals: collapsedPaths.join(',') })
        }
    }
  }

  const renderTable = async function() {
    const getTextWidth = function(text, font = '') {
      // re-use canvas object for better performance
      var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement('canvas'));
      var context = canvas.getContext('2d');
      context.font = font || config.bodyFontSize + 'pt arial';
      var metrics = context.measureText(text);
      return metrics.width;
    }

    var table = d3.select('#visContainer')
      .append('table')
        .attr('id', 'reportTable')
        .attr('class', 'reportTable')
        .style('opacity', 0)

    var drag = d3.drag()
      .on('start', (source, idx) => {
        if (!dataTable.has_pivots && source.colspan === 1) { // if a headercell is a merged cell, can't tell which column its associated with
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
        // console.log('drag event', source, idx, d3.event.x, d3.event.y)
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
          // console.log('DRAG FROM', movingColumn, movingIdx, 'TO', targetColumn, targetIdx)
          dataTable.moveColumns(movingIdx, targetIdx, updateColumnOrder)
        }
      })
    
    if (dataTable.minWidthForIndexColumns) {
      var columnTextWidths = {}

      if (!dataTable.transposeTable) {
        dataTable.column_series.filter(cs => !cs.column.hide).filter(cs => cs.column.modelField.type === 'dimension').forEach(cs => {
          var maxLength = cs.series.values.reduce((a, b) => Math.max(getTextWidth(a), getTextWidth(b)))
          var columnId = cs.column.modelField.name
          if (dataTable.useIndexColumn) {
            columnId = '$$$_index_$$$'
            maxLength += 15
          }
          columnTextWidths[columnId] = Math.ceil(maxLength)
        })
      } else {
        dataTable.headers.forEach(header => {
          var fontSize = 'bold ' + config.bodyFontSize + 'pt arial'
          var maxLength = dataTable.transposed_data
            .map(row => row.data[header.type].rendered)
            .reduce((a, b) => Math.max(getTextWidth(a, fontSize), getTextWidth(b, fontSize)))
          columnTextWidths[header.type] = Math.ceil(maxLength)
        })
      }
    }
    
    var column_groups = table.selectAll('colgroup')
      .data(dataTable.getTableColumnGroups()).enter()  
        .append('colgroup')

    column_groups.selectAll('col')
      .data(d => d).enter()
        .append('col')
        .attr('id', d => ['col',d.id].join('').replace('.', '') )
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
      .text(d => d.label)
      .attr('id', d => d.id)
      .attr('colspan', d => d.colspan)
      .attr('rowspan', d => d.rowspan)
      .attr('class', d => {
        var classes = ['reportTable']
        if (typeof d.cell_style !== 'undefined') { classes = classes.concat(d.cell_style) }
        return classes.join(' ')
      })
      .style('text-align', d => d.align)
      .style('font-size', config.headerFontSize + 'px')
      .attr('draggable', true)
      .call(drag)
      .on('mouseover', cell => dropTarget = cell)
      .on('mouseout', () => dropTarget = null)

    var table_rows = table.append('tbody')
      .selectAll('tr')
      .data(dataTable.getDataRows()).enter()
        .append('tr')
        .attr('class', row => {
            let classes = row.type;
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

    table_cells.html(d => {
        var text = ''
        if (Array.isArray(d.value)) {                     // cell is a list or number_list
          text = !(d.rendered === null) ? d.rendered : d.value.join(' ')
        } else if (typeof d.value === 'object' && d.value !== null && typeof d.value.series !== 'undefined') {  // cell is a turtle
          text = null
        } else if (d.html) {                              // cell has HTML defined
          var parser = new DOMParser()
          var parsed_html = parser.parseFromString(d.html, 'text/html')
          text = parsed_html.documentElement.textContent
        } else if (d.rendered || d.rendered === '') {     // could be deliberate choice to render empty string
          text = d.rendered
        } else {
          text = d.value   
        }
        text = String(text)
        text = text ? text.replace('-', '\u2011') : text  // prevents wrapping on minus sign / hyphen

        if (d.cell_style.includes('subtotal') && d.cell_style.includes('dimension') && String(d.value).indexOf('Subtotal|Others') === -1) {
            var isFirstCol = (d.colid === dataTable.firstVisibleDimension || d.colid === '$$$_index_$$$')
            if (isFirstCol) {
                var rowPath = d.rowid.substring(9);
                var isCollapsed = false;
                if (config.startFolded) {
                    isCollapsed = !(config.expandSubtotals && config.expandSubtotals.split(',').includes(rowPath))
                } else {
                    isCollapsed = config.collapsedSubtotals && config.collapsedSubtotals.split(',').includes(rowPath)
                }
                
                const points = isCollapsed ? '6 9 12 15 18 9' : '6 15 12 9 18 15'
                const collapseIcon = `<svg class="row-collapse-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor: pointer; margin-right: 4px; vertical-align: middle; flex-shrink: 0;"><polyline points="${points}"></polyline></svg>`;
                return `<div style="display:flex; align-items:center;">${collapseIcon}<span>${text}</span></div>`;
            }
        }
        return text
      })
      .attr('rowspan', d => d.rowspan)
      .attr('colspan', d => d.colspan)
      .style('text-align', d => d.align)
      .style('font-size', config.bodyFontSize + 'px')
      .attr('class', d => {
        var classes = ['reportTable']
        if (typeof d.value === 'object') { classes.push('cellSeries') }
        if (typeof d.align !== 'undefined') { classes.push(d.align) }
        if (typeof d.cell_style !== 'undefined') { classes = classes.concat(d.cell_style) }
        return classes.join(' ')
      })
      .on('mouseover', d => {
        if (dataTable.showHighlight) {
          if (!dataTable.transposeTable) {
            var id = ['col', d.colid].join('').replace('.', '')
          } else {
            var id = ['col', d.rowid].join('').replace('.', '')
          }
          
          var colElement = document.getElementById(id)
          colElement.classList.toggle('hover')
        }
        
        if (dataTable.showTooltip && d.cell_style.includes('measure')) {
          var x = d3.event.clientX
          var y = d3.event.clientY
          var html = dataTable.getCellToolTip(d.rowid, d.colid)
  
          d3.select("#tooltip")
            .style('left', x + 'px')
            .style('top', y + 'px')                   
            .html(html)
          
          d3.select("#tooltip").classed("hidden", false);
        }
      })
      .on('mousemove', d => {
        if (dataTable.showTooltip  && d.cell_style.includes('measure')) {
          var tooltip = d3.select('#tooltip')
          var x = d3.event.clientX < chartCentreX ? d3.event.pageX + 10 : d3.event.pageX - tooltip.node().getBoundingClientRect().width - 10
          var y = d3.event.clientY < chartCentreY ? d3.event.pageY + 10 : d3.event.pageY - tooltip.node().getBoundingClientRect().height - 10
  
          tooltip
              .style('left', x + 'px')
              .style('top', y + 'px')
        }
      })
      .on('mouseout', d => {
        if (dataTable.showHighlight) {
          if (!dataTable.transposeTable) {
            var id = ['col', d.colid].join('').replace('.', '')
          } else {
            var id = ['col', d.rowid].join('').replace('.', '')
          }
          var colElement = document.getElementById(id)
          colElement.classList.toggle('hover')
        }
        
        if (dataTable.showTooltip  && d.cell_style.includes('measure')) {
          d3.select("#tooltip").classed("hidden", true)
        }
      })
      .on('click', function(d) {
        if (d3.event.target.closest('.row-collapse-icon')) {
            d3.event.preventDefault()
            d3.event.stopPropagation()
            var rowEl = this.closest('tr')
            var isCollapsed = rowEl.classList.contains('collapsed')
            
            if (isCollapsed) {
                rowEl.classList.remove('collapsed')
                d3.select(rowEl).select('.row-collapse-icon polyline').attr('points', '6 15 12 9 18 15')
            } else {
                rowEl.classList.add('collapsed')
                d3.select(rowEl).select('.row-collapse-icon polyline').attr('points', '6 9 12 15 18 9')
            }

            syncRowVisibility()
            return;
        }

        // Looker applies padding based on the top of the viz when opening a drill field but
        // if part of the viz container is hidden underneath the iframe, the drill menu opens off screen
        // We make a simple copy of the d3.event and account for pageYOffser as MouseEvent attributes are read only.
        let event = {
          metaKey: d3.event.metaKey,
          pageX: d3.event.pageX,
          pageY: d3.event.pageY - window.pageYOffset
        }
        LookerCharts.Utils.openDrillMenu({
          links: d.links,
          event: event
        })
      })

    if (use_minicharts) {
      var barHeight = 16
      var minicharts = table.selectAll('.cellSeries')
            .append('svg')
              .attr('height', d => barHeight)
              .attr('width', '100%')
            .append('g')
              .attr('class', '.cellSeriesChart')
            .selectAll('rect')
            .data(d => {
              values = []
              for (var i = 0; i < d.value.series.keys.length; i++) {
                values.push({
                  idx: i,
                  max: 10000,
                  key: d.value.series.keys[i],
                  value: d.value.series.values[i],
                  type: d.value.series.types[i],
                })
              }
              return values.filter(value => value.type === 'line_item')
            }).enter()

      var cellWidth = table.selectAll('.cellSeries')._groups[0][0].clientWidth
      var barWidth = Math.floor( cellWidth / 10 )
      // console.log('cellWidth', cellWidth)
      // console.log('barHeight', barHeight)
      // console.log('barWidth', barWidth)

      minicharts.append('rect')
        .style('fill', 'steelblue')
        .attr('x', value => {
          return value.idx * barWidth
        })
        .attr('y', value => barHeight - Math.floor(value.value / value.max * barHeight))
        .attr('width', barWidth)
        .attr('height', value => Math.floor(value.value / value.max * barHeight))
    }
}

  const addOverlay = async function() {
    var viewbox_width = document.getElementById('reportTable').clientWidth
    var viewbox_height = document.getElementById('reportTable').clientHeight

    var allRects = []
    d3.selectAll('th')
      .select(function(d, i) {
        if (typeof d !== 'undefined') {
          var bbox = this.getBoundingClientRect()
        allRects.push({
          index: i,
          data: d,
          x: bbox.x - BBOX_X_ADJUST, 
          y: bbox.y - BBOX_Y_ADJUST, 
          width: bbox.width,
          height: bbox.height,
          html: this.innerHTML,
          class: this.className + ' rectElem animated',
          fontSize: config.headerFontSize,
          align: this.style.textAlign
        })
        }
      })

    d3.selectAll('td')
    .select(function(d, i) {
      if (typeof d !== 'undefined') {
        var bbox = this.getBoundingClientRect()
        allRects.push({
          index: i,
          data: d,
          x: bbox.x - BBOX_X_ADJUST,
          y: bbox.y - BBOX_Y_ADJUST,
          width: bbox.width,
          height: bbox.height,
          html: this.innerHTML,
          class: this.className + ' rectElem animated',
          fontSize: config.bodyFontSize,
          align: this.style.textAlign
        })
      }
    })

    var overlay = d3.select('#visSvg')
      .attr('width', viewbox_width)
      .attr('height', viewbox_height)
      .selectAll('.rectElem')
        .data(allRects, d => d.data.id)
        .join(
            enter => enter.append('div')
                .attr('class', d => d.class)
                .style('opacity', 0.2)
                .style('position', 'absolute')
                .style('left', d => d.x + 'px')
                .style('top', d => -2000)
                .style('width', d => d.width + 'px')
                .style('height', d => d.height + 'px')
                .style('font-size', d => d.fontSize + 'px')
                .style('text-align', d => d.align)
                .text(d => d.html)
              .call(
                enter => enter.transition().duration(1000)
                .style('opacity', 1)  
                .style('top', d => d.y + 'px')
                ),
            update => update
              .call(
                update => update.transition().duration(1000)
                .attr('class', d => d.class)
                .style('opacity', 1)
                .style('left', d => d.x + 'px')
                .style('top', d => d.y + 'px')
                .style('width', d => d.width + 'px')
                .style('height', d => d.height + 'px')
                .style('font-size', d => d.fontSize + 'px')
                .style('text-align', d => d.align)
                .text(d => d.html)
              ),
            exit => exit
              .call(
                exit => exit.transition().duration(500)
                  .style('opacity', 0)
                  .remove()
              )
        )
  }

  renderTable().then(() => {
    document.getElementById('reportTable').classList.add('reveal')

    const baseActionBtnStyle = {
        "position": "fixed",
        "z-index": "1001",
        "background": "white",
        "padding": "0px",
        "border": "none",
        "cursor": "pointer",
        "visibility": "hidden",
        "border-radius": "50%",
        "width": "32px",
        "height": "32px",
        "display": "flex",
        "align-items": "center",
        "justify-content": "center",
        "box-shadow": "0 2px 4px rgba(0, 0, 0, 0.1)"
    }

    // Add download button only if exposeDownloadLink is true
    if (config.exposeDownloadLink) {
      const downloadButton = d3
        .select("#visContainer")
        .append("button")
        .attr("class", "vis-action-btn")
        .attr("id", "downloadButton")
        .attr("title", "Download xls")
      
      Object.entries(baseActionBtnStyle).forEach(([k, v]) => downloadButton.style(k, v))
      downloadButton.style("top", "10px").style("right", "10px")

      downloadButton.on("click", () => {
          const el = d3.select('#downloadButton')
          el.attr("class", "vis-action-btn loading")
          // wait for the class to be registered
          setTimeout(async () => {
            try {
              await downloadTableAsExcel();
            } finally {
              el.attr("class", "vis-action-btn")
            }
          }, 250)
        });

      // Add SVG icon
      downloadButton
        .append("svg")
        .attr("width", "16")
        .attr("height", "16")
        .attr("viewBox", "0 0 640 640")
        .style("fill", "#666")
        .html(
          '<path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM303 505C312.4 514.4 327.6 514.4 336.9 505L400.9 441C410.3 431.6 410.3 416.4 400.9 407.1C391.5 397.8 376.3 397.7 367 407.1L344 430.1L344 344C344 330.7 333.3 320 320 320C306.7 320 296 330.7 296 344L296 430.1L273 407.1C263.6 397.7 248.4 397.7 239.1 407.1C229.8 416.5 229.7 431.7 239.1 441L303.1 505z"/>'
        );
    }
        
    if (dataTable.hasSubtotals) {
      if (config.collapsedSubtotals || config.startFolded) {
         syncRowVisibility(true)
         document.querySelectorAll('#reportTable tbody tr').forEach(rowEl => {
             if (rowEl.classList.contains('collapsed')) {
                 d3.select(rowEl).select('.row-collapse-icon polyline').attr('points', '6 9 12 15 18 9')
             } else {
                 d3.select(rowEl).select('.row-collapse-icon polyline').attr('points', '6 15 12 9 18 15')
             }
         })
      }

      let rightOffsetExpand = config.exposeDownloadLink ? "47px" : "10px";
      let rightOffsetCollapse = config.exposeDownloadLink ? "84px" : "47px";

      const expandAllBtn = d3.select("#visContainer").append("button").attr("class", "vis-action-btn").attr("id", "expandAllBtn").attr("title", "Expand All")
      Object.entries(baseActionBtnStyle).forEach(([k, v]) => expandAllBtn.style(k, v))
      expandAllBtn.style("top", "10px").style("right", rightOffsetExpand)
      expandAllBtn.on("click", () => {
          document.querySelectorAll('#reportTable tbody tr').forEach(rowEl => {
              if (rowEl.classList.contains('collapsed')) {
                  rowEl.classList.remove('collapsed')
                  d3.select(rowEl).select('.row-collapse-icon polyline').attr('points', '6 15 12 9 18 15')
              }
          })
          syncRowVisibility()
      });
      expandAllBtn.append("svg").attr("width", "16").attr("height", "16").attr("viewBox", "0 0 24 24").style("fill", "none").style("stroke", "#666").style("stroke-width", "2").style("stroke-linecap", "round").style("stroke-linejoin", "round").html('<polyline points="6 9 12 15 18 9"></polyline>');

      const collapseAllBtn = d3.select("#visContainer").append("button").attr("class", "vis-action-btn").attr("id", "collapseAllBtn").attr("title", "Collapse All")
      Object.entries(baseActionBtnStyle).forEach(([k, v]) => collapseAllBtn.style(k, v))
      collapseAllBtn.style("top", "10px").style("right", rightOffsetCollapse)
      collapseAllBtn.on("click", () => {
          document.querySelectorAll('#reportTable tbody tr.subtotal').forEach(rowEl => {
              if (!rowEl.classList.contains('collapsed')) {
                  rowEl.classList.add('collapsed')
                  d3.select(rowEl).select('.row-collapse-icon polyline').attr('points', '6 9 12 15 18 9')
              }
          })
          syncRowVisibility()
      });
      collapseAllBtn.append("svg").attr("width", "16").attr("height", "16").attr("viewBox", "0 0 24 24").style("fill", "none").style("stroke", "#666").style("stroke-width", "2").style("stroke-linecap", "round").style("stroke-linejoin", "round").html('<polyline points="6 15 12 9 18 15"></polyline>');
    }

    if (config.exposeDownloadLink || dataTable.hasSubtotals) {
      // Add CSS hover styles
      d3.select("#visContainer")
        .style("position", "relative")
        .style("cursor", "default")
        .on("mouseenter", () => {
          d3.select("#visContainer").style("cursor", "default");
        });

      // Add CSS rules for hover and loading
      const style = document.createElement("style");
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
    
    if (config.customTheme === 'animate') {
      document.getElementById('visSvg').classList.remove('hidden')
      addOverlay()
      // setTimeout(addOverlay(), 500)
    } else {
      document.getElementById('visSvg').classList.add('hidden')
      document.getElementById('reportTable').style.opacity = 1
    }
  })

}

looker.plugins.visualizations.add({
  //Removes custom CSS theme for now over supportability concerns
  options: (function() { 
    let ops = VisPluginTableModel.getCoreConfigOptions();
    ops.theme.values.pop()
    delete ops.customTheme
    return ops
  })(),
  
  create: function(element, config) {
    this.svgContainer = d3.select(element)
      .append("div")
      .attr("id", "visSvg")
      .attr("width", element.clientWidth)
      .attr("height", element.clientHeight);

    this.tooltip = d3.select(element)
      .append("div")
      .attr("id", "tooltip")
      .attr("class", "hidden")
    
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const updateColumnOrder = newOrder => {
      this.trigger('updateConfig', [{ columnOrder: newOrder }])
    }
    const updateConfig = newConfig => {
      this.trigger('updateConfig', [newConfig])
    }



    // ERROR HANDLING

    this.clearErrors();

    if (queryResponse.fields.pivots.length > 2) {
      this.addError({
        title: 'Max Two Pivots',
        message: 'This visualization accepts no more than 2 pivot fields.'
      });
      return
    }

    // console.log('queryResponse', queryResponse)
    // console.log('data', data)

    // INITIALISE THE VIS

    try {
      var elem = document.querySelector('#visContainer');
      elem.parentNode.removeChild(elem);  
    } catch(e) {}    

    this.container = d3.select(element)
      .append('div')
      .attr('id', 'visContainer')

    if (typeof config.columnOrder === 'undefined') {
      this.trigger('updateConfig', [{ columnOrder: {} }])
    }
  
    // Dashboard-next fails to register config if no one has touched it
    // Check to reapply default settings to the config object
    if (typeof config.theme === 'undefined') {
      config = Object.assign({
        bodyFontSize: 12,
        headerFontSize: 12,
        theme: "traditional",
        showHighlight: true,
        showTooltip: true
      }, config)
    }

    // BUILD THE VIS
    // 1. Create object
    // 2. Register options
    // 3. Build vis

    // console.log(config)
    var dataTable = new VisPluginTableModel(data, queryResponse, config)
    this.trigger('registerOptions', dataTable.getConfigOptions())
    buildReportTable(config, dataTable, updateColumnOrder, updateConfig, element)

    // DEBUG OUTPUT AND DONE
    // console.log('dataTable', dataTable)
    // console.log('container', document.getElementById('visContainer').parentNode)
    
    done();
  }
})