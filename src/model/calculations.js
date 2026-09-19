import SSF from "ssf"
import { INDEX_COLUMN } from '../constants'
import {
  Column,
  DataCell,
  HeaderCell,
  Row
} from '../vis_primitives'

const clone = x => x === undefined ? undefined : (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)))

/**
 * Update the VisPluginTableModel instance
 * - this.variances
 * 
 * option is either 'no_variance' or a measure.name
 */
export function checkVarianceCalculations() {
  Object.keys(this.config).forEach(option => {
    if (option.startsWith('comparison')) {
      var baseline = option.split('|')[1]
      var comparison = this.config[option]

      var baseline_in_measures = false
      this.measures.forEach(measure => {
        if (baseline === measure.name) {
          baseline_in_measures = true
        }
      })

      var comparison_available = false

      var comparison_options = [...this.measures.map(measure => measure.name), ...this.pivot_fields.map(pivot_field => pivot_field.name)]
      comparison_options.forEach(comparitor => {
        if (comparison === comparitor) {
          comparison_available = true
        }
      })

      if (baseline_in_measures && comparison_available) {
        if (this.pivot_fields.map(pivot_field => pivot_field.name).includes(this.config[option])) {
          var type = 'by_pivot'
        } else {
          var type = this.config[option] === 'no_variance' ? 'no_variance' : 'vs_measure'
        }

        if (typeof this.config['switch|' + baseline] !== 'undefined') {
          if (this.config['switch|' + baseline]) {
            var reverse = true
          } else {
            var reverse = false
          }
        }

        this.variances.push({
          baseline: baseline,
          comparison: this.config[option],
          type: type,
          reverse: reverse
        })
      } else if (baseline_in_measures) {
        this.config[option] = 'no_variance'
      } else {
        delete this.config[option]
      }
    }
  })
}

/**
 * this.subtotals_data
 * @param {*} queryResponse 
 */
export function checkSubtotalsData(queryResponse) {
  const subtotalsMap = queryResponse && (queryResponse.subtotals_data || queryResponse.subtotalsData)
  if (!subtotalsMap) { return }
  const subtotalSets = queryResponse.subtotal_sets || queryResponse.subtotalSets

  var depthsToProcess = (this.addSubtotalDepth === '(all)' || !this.addSubtotalDepth)
    ? Object.keys(subtotalsMap)
    : [this.addSubtotalDepth.toString()]

  depthsToProcess.forEach(depthKey => {
    var subtotalRows = subtotalsMap[depthKey]
    if (!Array.isArray(subtotalRows)) { return }

    subtotalRows.forEach(lookerSubtotal => {
      var visSubtotal = new Row('subtotal')

      visSubtotal['$$$__grouping__$$$'] = lookerSubtotal['$$$__grouping__$$$']
        || (subtotalSets && subtotalSets[parseInt(depthKey, 10) - 1])
        || this.dimensions.slice(0, parseInt(depthKey, 10)).map(d => d.name)

      var dims = visSubtotal['$$$__grouping__$$$'].map(group => lookerSubtotal[group]?.value).join('|')
      visSubtotal.id = ['Subtotal', dims || 'Others'].join('|')

      this.columns.forEach(column => {
        visSubtotal.data[column.id] = (column.pivoted || column.isRowTotal)
          ? (column.modelField?.name ? lookerSubtotal[column.modelField.name]?.[column.pivot_key] : undefined)
          : lookerSubtotal[column.id]
        var cell = visSubtotal.data[column.id]

        if (typeof cell !== 'undefined') {
          if (typeof cell.cell_style === 'undefined') {
            cell.cell_style = ['total', 'subtotal']
          } else {
            cell.cell_style = cell.cell_style.concat(['total', 'subtotal'])
          }
          if (typeof column.modelField?.style !== 'undefined') {
            cell.cell_style = cell.cell_style.concat(column.modelField.style)
          }
          if (cell.value === null) {
            cell.rendered = ''
          }

          var reportInSetting = this.config['reportIn|' + column.modelField?.name]
          if (typeof reportInSetting !== 'undefined' && reportInSetting !== '1') {
            var unit = this.config.useUnit && column.modelField?.unit !== '#' ? (column.modelField?.unit || '') : ''
            cell.html = null
            cell.value = Math.round(cell.value / parseInt(reportInSetting, 10))
            cell.rendered = column.modelField?.value_format === '' ? cell.value.toString() : unit + SSF.format(column.modelField?.value_format || '', cell.value)
          }
        }            
      })
      this.subtotals_data[visSubtotal.id] = visSubtotal
    })
  })
}

export function buildTotals(queryResponse) {
  var totals_ = queryResponse.totals_data
  if (!totals_) return;
  var totalsRow = new Row('total')
  const dimColspans = this.getDimensionColspans();

  this.columns.forEach(column => {
    totalsRow.id = 'Total'

    if (column.modelField.type === 'dimension') {
      const { colspan, rowspan } = dimColspans[column.id] || { colspan: -1, rowspan: -1 };
      totalsRow.data[column.id] = new DataCell({ 
        value: '', 
        cell_style: ['total', 'dimension'],
        rowspan: rowspan, 
        colspan: colspan,
        colid: column.id,
        align: column.modelField.is_numeric ? 'right' : 'left',
        rowid: 'Total' 
      })
    } else {
      var rowspan = 1
      var colspan = 1
    }
    
    
    if (column.modelField.type === 'measure') {
      var cell_style = column.modelField.is_numeric ? ['total', 'numeric', 'measure'] : ['total', 'nonNumeric', 'measure']
      var cellValue = (column.pivoted || column.isRowTotal) ? totals_[column.modelField.name][column.pivot_key] : totals_[column.id]

      cellValue = new DataCell({ 
        ...cellValue, 
        ...{ 
          cell_style: cell_style,
          rowspan: rowspan, 
          colspan: colspan, 
          colid: column.id, 
          align: column.modelField.is_numeric ? 'right' : 'left',
          rowid: 'Total'} 
      })

      if (typeof cellValue.rendered === 'undefined' && typeof cellValue.html !== 'undefined' ) { // totals data may include html but not rendered value
        cellValue.rendered = this.getRenderedFromHtml(cellValue)
      }

      var reportInSetting = this.config['reportIn|' + column.modelField.name]
      if (typeof reportInSetting !== 'undefined'  && reportInSetting !== '1') {
        var unit = this.config.useUnit && column.modelField.unit !== '#'  ? column.modelField.unit : ''
        cellValue.html = undefined
        cellValue.value = Math.round(cellValue.value / parseInt(reportInSetting))
        cellValue.rendered = column.modelField.value_format === '' ? cellValue.value.toString() : unit + SSF.format(column.modelField.value_format, cellValue.value)
      }
      
      totalsRow.data[column.id] = cellValue
      if (typeof totalsRow.data[column.id].links !== 'undefined') {
        totalsRow.data[column.id].links.forEach(link => {
          link.type = "measure_default"
        })
      }       
    }
  })

  if (this.useIndexColumn) {
    totalsRow.data[INDEX_COLUMN].value = 'TOTAL'
    totalsRow.data[INDEX_COLUMN].align = 'left'
  } else {
    if (this.firstVisibleDimension) {
      totalsRow.data[this.firstVisibleDimension].value = 'TOTAL'
      totalsRow.data[this.firstVisibleDimension].align = 'left'
    }
  }
  totalsRow.sort = [
    {name: 'section', value: 1},
    {name: 'subtotal', value: 0},
    {name: 'original_row', value: 0}
  ]
  this.data.push(totalsRow)

  // Including an Others row: note the huge assumption in calculating a very simple average!
  // This will prevent a data gap distracting users, and may indicate whether the Others data
  // is "higher or lower" than the top x items. But it is not an accurate number.
  if (this.calculateOthers) {
    var othersRow = new Row('line_item')
    othersRow.id = 'Others'
    this.columns.forEach(column => {
      var othersValue = null
      var othersStyle = column.modelField.is_numeric ? ['numeric'] : ['nonNumeric']
      var totalValue = totalsRow.data[column.id]
      
      if (column.modelField.type === 'measure') {
        if (othersValue = ['sum', 'count'].includes(column.modelField.calculation_type)) {
          othersValue = totalValue.value - column.series.series.sum
          othersStyle.push('measure')
        } else {
          othersValue = (totalValue.value + column.series.series.avg) / 2
          othersStyle = othersStyle.concat(['estimate', 'measure'])
          if (['count', 'count_distinct'].includes(column.modelField.calculation_type)) {
            othersValue = Math.round(othersValue)
          }
        }
      } else {
        othersStyle.push('dimension')
      }

      if (othersValue) {
        var formatted_value = column.modelField.value_format === '' 
              ? othersValue.toString() 
              : SSF.format(column.modelField.value_format, othersValue)
        othersRow.data[column.id] = new DataCell({ 
          value: othersValue, 
          rendered: formatted_value, 
          cell_style: othersStyle,
          align: column.modelField.is_numeric ? 'right' : 'left',
          colid: column.id,
          rowid: 'Others'
        })
      } else {
        othersRow.data[column.id] = new DataCell({ 
          rendered: '',
          cell_style: othersStyle, 
          colid: column.id, 
          rowid: 'Others'
        })
      }
    })

    if (this.useIndexColumn) {
      othersRow.data[INDEX_COLUMN].value = 'Others'
      othersRow.data[INDEX_COLUMN].rendered = 'Others'
      othersRow.data[INDEX_COLUMN].align = 'left'
      othersRow.data[INDEX_COLUMN].cell_style.push('singleIndex')
    } else {
      if (this.firstVisibleDimension) {
        othersRow.data[this.firstVisibleDimension].value = 'Others'
        othersRow.data[this.firstVisibleDimension].rendered = 'Others'
        othersRow.data[this.firstVisibleDimension].align = 'left'
      }
    }
    othersRow.sort = [
      {name: 'section', value: 1},
      {name: 'subtotal', value: -1},
      {name: 'original_row', value: -1}
    ] 
    this.data.push(othersRow)
  }
  
  this.sortData()
}

/**
 * Generates subtotals values
 */
export function addSubTotals () { 
  const dimColspans = this.getDimensionColspans();
  var activeDims = this.dimensions.filter(d => !d.isNull && !this.config['hide|' + d.name] && this.config['style|' + d.name] !== 'hide');
  var depths = this.addSubtotalDepth === '(all)'
               ? Array.from({length: Math.max(0, activeDims.length - 1)}, (_, i) => i + 1)
               : (activeDims.length > 1 ? [Math.min(parseInt(this.addSubtotalDepth, 10) || 1, activeDims.length - 1)] : []);

  // Initialize row.sort to handle multiple subtotal depths
  this.data.forEach((row, i) => {
    if (row.type !== 'total' && row.type !== 'subtotal') {
      var sectionVal = row.sort && row.sort.find(s => s.name === 'section') ? row.sort.find(s => s.name === 'section').value : 0;
      var originalRowVal = row.sort && row.sort.find(s => s.name === 'original_row') ? row.sort.find(s => s.name === 'original_row').value : i;
      row.sort = [{name: 'section', value: sectionVal}];
      for (let d = 0; d < depths.length; d++) {
        row.sort.push({name: 'subtotal_' + d, value: 0});
      }
      row.sort.push({name: 'original_row', value: originalRowVal});
    }
  });

  depths.forEach((depth, depthIndex) => {
    this.subtotalRows[depthIndex] = []
    // BUILD GROUPINGS / SORT VALUES
    // groupMap ensures non-contiguous rows (e.g. sorted by measure) share a single subtotal group
    var subTotalGroups = []
    var groupMap = new Map()
    this.data.forEach((row, i) => {
      if (row.type === 'line_item') {
        var group = []
        for (var g = 0; g < depth; g++) {
          var dim = activeDims[g].name
          var dimVal = (row.originalDimensionValues && row.originalDimensionValues[dim] !== undefined)
            ? row.originalDimensionValues[dim]
            : row.data[dim]?.value
          group.push(dimVal)
        }
        var groupKey = group.join('|')
        var groupIdx = groupMap.get(groupKey)
        if (groupIdx === undefined) {
          groupIdx = subTotalGroups.length
          subTotalGroups.push(group)
          groupMap.set(groupKey, groupIdx)
        }
        var subSortObj = row.sort.find(s => s.name === 'subtotal_' + depthIndex);
        if (subSortObj) {
          subSortObj.value = groupIdx;
        }
      }

      if (row.id === 'Others' && row.type === 'line_item') {
        row.hide = true
      }
    })

    // GENERATE DATA ROWS FOR SUBTOTALS
    subTotalGroups.forEach((subTotalGroup, s) => {
      var subtotalRow = new Row('subtotal')
      var dims = subTotalGroup.join('|') ? subTotalGroup.join('|') : 'Others'
      subtotalRow.id = ['Subtotal', dims].join('|')
      subtotalRow.depthIndex = depthIndex;

      this.columns.forEach(column => {
        if (column.modelField.type === 'dimension') {
          const { colspan, rowspan } = dimColspans[column.id] || { colspan: -1, rowspan: -1 };
          var cell_style = column.modelField.is_numeric ? ['total', 'subtotal', 'numeric', 'dimension'] : ['total', 'subtotal', 'nonNumeric', 'dimension']
          if (this.subtotalsOnTop) { cell_style.push('subtotal-top', 'subtotals-on-top') }
          var existingSubCell = this.subtotals_data[subtotalRow.id]?.data[column.id]
          var cell = new DataCell({ 
            value: '',
            links: existingSubCell?.links || [],
            'cell_style': cell_style, 
            align: column.modelField.is_numeric ? 'right' : 'left', 
            rowspan: rowspan, 
            colspan: colspan,
            colid: column.id,
            rowid: subtotalRow.id
          })
          if (column.id === INDEX_COLUMN || column.id === this.firstVisibleDimension ) {
            if (this.genericLabelForSubtotals) {
              cell.value = 'Subtotal'
              cell.rendered = 'Subtotal'
            } else if (this.subtotalStyle === 'collapsed') {
              cell.value = subTotalGroup[subTotalGroup.length - 1] || 'Others'
              cell.rendered = cell.value
            } else {
              cell.value = subTotalGroup.join(' | ') ? subTotalGroup.join(' | ') : 'Others'
              cell.rendered = cell.value
            }
          }
          subtotalRow.data[column.id] = cell
        }

        if (column.modelField.type === 'measure') {
          var cell_style = column.modelField.is_numeric ? ['total', 'subtotal', 'numeric', 'measure'] : ['total', 'subtotal', 'nonNumeric', 'measure']
          if (this.subtotalsOnTop) { cell_style.push('subtotal-top', 'subtotals-on-top') }
          var align = column.modelField.is_numeric ? 'right' : 'left'
          if (this.subtotals_data[subtotalRow.id]?.data[column.id]) { // if subtotals already provided in Looker's queryResponse
            var cell = new DataCell({ 
              ...subtotalRow.data[column.id], 
              ...this.subtotals_data[subtotalRow.id].data[column.id],
              ...{ cell_style: cell_style, align: align, colid: column.id, rowid: subtotalRow.id }
            })
            subtotalRow.data[column.id] = cell
          } else {
            var subtotal_value = 0
            var subtotal_items = 0
            var rendered = ''
            this.data.forEach(data_row => {
              if (data_row.type === 'line_item') {
                var sortObj = data_row.sort.find(st => st.name === 'subtotal_' + depthIndex);
                if (sortObj && sortObj.value === s) {
                  var value = data_row.data[column.id].value
                  if (Number.isFinite(value)) {
                    subtotal_value += value
                    subtotal_items++
                  }
                }
              } 
            })
            
            if (column.modelField.calculation_type === 'average' && subtotal_items > 0) {
              subtotal_value = subtotal_value / subtotal_items
            }
            if (subtotal_items > 0) {
              var unit = this.config.useUnit && column.modelField.unit !== '#'  ? column.modelField.unit : ''
              rendered = column.modelField.value_format === '' ? subtotal_value.toString() : unit + SSF.format(column.modelField.value_format, subtotal_value)
            }
            if (column.modelField.calculation_type === 'string') {
              subtotal_value = ''
              rendered = ''
            } 

            // suppress summing percentages/ratios in client fallback to avoid misleading aggregates
            var isPercentageOrRatio = (
              column.modelField?.value_format?.includes('%') ||
              column.modelField?.unit === '%' ||
              column.unit === '%' ||
              ['percent', 'ratio', 'percent_of_total'].includes(column.modelField?.calculation_type)
            )

            var cell = new DataCell({
              value: subtotal_value,
              rendered: rendered,
              cell_style: cell_style,
              align: align,
              colid: column.id,
              rowid: subtotalRow.id
            })
            if (isPercentageOrRatio && column.modelField?.calculation_type !== 'average') {
              cell.value = null
              cell.rendered = ''
            }
            subtotalRow.data[column.id] = cell
          }
        }
      })
      subtotalRow.sort = [{name: 'section', value: 0}];
      for (let d = 0; d < depths.length; d++) {
        if (d < depthIndex) {
          // Find the parent group index
          const parentLineItem = this.data.find(r => r.type === 'line_item' &&
            r.sort.find(st => st.name === 'subtotal_' + depthIndex)?.value === s);
          const parentVal = parentLineItem ?
            parentLineItem.sort.find(st => st.name === 'subtotal_' + d)?.value : 0;
          subtotalRow.sort.push({name: 'subtotal_' + d, value: parentVal});
        } else if (d === depthIndex) {
          subtotalRow.sort.push({name: 'subtotal_' + d, value: s});
        } else {
          subtotalRow.sort.push({name: 'subtotal_' + d, value: this.subtotalsOnTop ? -1 : 9999});
        }
      }
      subtotalRow.sort.push({name: 'original_row', value: this.subtotalsOnTop ? -1 : 9999});
      this.data.push(subtotalRow)
      this.subtotalRows[depthIndex][s] = subtotalRow
    })
  })
  this.sortData()
  this.hasSubtotals = true
}

/**
 * Generates new column subtotals, where 2 pivot levels have been used
 */
export function addColumnSubTotals () {
  var subtotalColumns = []

  // Get a list of unique top-level pivot values in the pivot_values object
  var pivots = []
  var pivot_dimension = this.pivot_fields[0].name
  this.pivot_values.forEach(pivot_value => {
    var p_value = pivot_value['data'][pivot_dimension]
    if (p_value !== null) { pivots.push(p_value) }
  })
  pivots = [...new Set(pivots)]


  // DERIVE THE NEW COLUMN DEFINITIONS
  pivots.forEach(pivot => {
    this.measures.forEach((measure, m) => {
      if (measure.can_pivot) {
        var subtotalColumn = new Column(['$$$_subtotal_$$$', pivot, measure.name].join('.'), this, measure)
        subtotalColumn.pivoted = true
        subtotalColumn.subtotal = true
        subtotalColumn.pivot_key = [pivot, '$$$_subtotal_$$$'].join('|')
        const matchPivotIndex = this.pivot_values.findIndex(pv => pv.data[pivot_dimension] === pivot)
        if (matchPivotIndex !== -1) {
          subtotalColumn.pivot_index = matchPivotIndex
        }
        subtotalColumn.subtotal_data = {
          pivot: pivot,
          measure_idx: m,
          columns: [],
        }

        this.columns.forEach((column, i) => { 
          var columnPivotValue = null
          for (var i = 0; i < column.levels.length; i++) {
            if (column.levels[i].type.startsWith('pivot')) {
              var pivotIdx = parseInt(column.levels[i].type.slice(-1))
              var pivotDimension = this.pivot_fields[pivotIdx].name
              if (typeof column.levels[i].pivotData.data !== 'undefined') {
                columnPivotValue = column.levels[i].pivotData.data[pivotDimension]
              }
              break
            }
          }
          if (column.pivoted && columnPivotValue === pivot) {
            if (column.modelField.name === measure.name) {
              subtotalColumn.subtotal_data.columns.push(column)
            }
          }
        })
        subtotalColumns.push(subtotalColumn)
      }
    })
  })

  // USE THE NEW DEFINITIONS TO ADD SUBTOTAL COLUMNS TO TABLE.COLUMNS
  subtotalColumns.forEach((subtotalColumn, s) => { 
    subtotalColumn.sort.push({name: 'section', value: 1})

    this.headers.forEach((header, i) => {
      switch (header.type) {
        case 'pivot0': 
          var sortValueFromColumn = subtotalColumn.subtotal_data.columns[0].levels[i].pivotData.sort_values[header.modelField.name]
          subtotalColumn.levels.push(new HeaderCell({ 
            column: subtotalColumn, 
            type: header.type, 
            modelField: {
              name: header.modelField.name,
              label: subtotalColumn.subtotal_data.pivot,
            }
          }))
          subtotalColumn.sort.push({name: header.modelField.name, value: sortValueFromColumn})
          break

        case 'pivot1': console.log('line1453')
          subtotalColumn.levels.push(new HeaderCell({ column: subtotalColumn, type: header.type, modelField: {
            name: 'subtotal',
            label: 'Subtotal',
          }}))

          var sortOption = this.sorts.find(sort => sort.name === header.modelField.name)
          if (typeof sortOption === 'undefined' || typeof sortOption.desc === 'undefined') {
            var sortDescending = false
          } else {
            var sortDescending = Boolean(sortOption.desc)
          }
          if (sortDescending) {
            var subtotalSortValue = typeof this.pivot_values[0].sort_values[header.modelField.name] === 'string' ? 'aaaaaaaa' : Number.NEGATIVE_INFINITY
          } else {
            var subtotalSortValue = typeof this.pivot_values[0].sort_values[header.modelField.name] === 'string' ? 'ZZZZZZZZ' : Number.POSITIVE_INFINITY
          }
          subtotalColumn.sort.push({name: header.modelField.name, value: subtotalSortValue})
          break

        case 'heading':
          subtotalColumn.levels.push(new HeaderCell({ column: subtotalColumn, type: 'heading', modelField: subtotalColumn.modelField}))
          break

        case 'field':
          subtotalColumn.levels.push(new HeaderCell({ column: subtotalColumn, type: 'field', modelField: subtotalColumn.modelField}))
          subtotalColumn.sort.push({name: 'measure_idx', value: subtotalColumn.subtotal_data.measure_idx})
          break
      }
    })
    this.columns.push(subtotalColumn)
  })

  // CALCULATE COLUMN SUB TOTAL VALUES
  this.data.forEach(row => {
    subtotalColumns.forEach(subtotalColumn => {
      var cell_style = subtotalColumn.modelField.is_numeric ? ['subtotal', 'numeric', 'measure'] : ['subtotal', 'nonNumeric', 'measure']
      var subtotal_value = 0
      subtotalColumn.subtotal_data.columns.forEach(column => { // subtotalColumn.columns i.e. the individual columns that are aggregated into a single subtotal columns
        subtotal_value += row.data[column.id].value
      })
      row.data[subtotalColumn.id] = new DataCell({
        value: subtotal_value,
        rendered: subtotalColumn.modelField.value_format === '' ? subtotal_value.toString() : SSF.format(subtotalColumn.modelField.value_format, subtotal_value),
        cell_style: cell_style,
        colid: subtotalColumn.id,
        rowid: row.id
      })
      if (['subtotal', 'total'].includes(row.type)) { 
        row.data[subtotalColumn.id].cell_style.push('total') 
      }
    })
  })
}

/**
 * Variance calculation function to enable addVariance()
 */
export function calculateVariance (value_format, id, calc, baseline, comparison) {
  this.data.forEach(row => {
    var baseline_value = row.data[baseline.id].value
    var comparison_value = row.data[comparison.id].value
    if (calc === 'absolute') {
      var cell = new DataCell({
        value: baseline_value - comparison_value,
        rendered: value_format === '' ? (baseline_value - comparison_value).toString() : SSF.format(value_format, (baseline_value - comparison_value)),
        cell_style: ['numeric', 'measure', 'variance', 'varianceAbsolute'],
        colid: id,
        rowid: row.id
      })
    } else {
      var value = (baseline_value - comparison_value) / Math.abs(comparison_value)
      if (!isFinite(value)) {
        var cell = new DataCell({
          value: null,
          rendered: '∞',
          cell_style: ['numeric', 'measure', 'variance', 'variancePercent'],
          colid: id,
          rowid: row.id
        })
      } else {
        var cell = new DataCell({
          value: value,
          rendered: SSF.format('#0.00%', value),
          cell_style: ['numeric', 'measure', 'variance', 'variancePercent'],
          colid: id,
          rowid: row.id
        })
      }
    }
    if (row.type === 'total' || row.type === 'subtotal') {
      cell.cell_style.push('total')
    }
    if (row.type === 'subtotal') {
      cell.cell_style.push('subtotal')
    }
    if (cell.value < 0) {
      cell.cell_style.push('negative')
    }
    row.data[id] = cell
  })
}

export function createVarianceColumn (colpair) {
  if (!this.config.colSubtotals && colpair.variance.baseline.startsWith('$$$_subtotal_$$$')) {
    console.log('Cannot calculate variance of column subtotals if subtotals disabled.')
    return
  }
  var id = ['$$$_variance_$$$', colpair.calc, colpair.variance.baseline, colpair.variance.comparison].join('|')
  var baseline = this.getColumnById(colpair.variance.baseline)
  var comparison = this.getColumnById(colpair.variance.comparison)
  if (!baseline.modelField || !comparison.modelField) return
  var column = new Column(id, this, baseline.modelField)
  column.isVariance = true

  if (colpair.calc === 'absolute') {
    column.variance_type = 'absolute'
    column.idx = baseline.idx + 1
    column.pos = baseline.pos + 1
    var sortCopy = clone(baseline.sort)
    column.sort = [...sortCopy, {name: 'variance_absolute', value: 1}]
    column.hide = !this.config['var_num|' + baseline.modelField.name]
  } else {
    column.variance_type = 'percentage'
    column.idx = baseline.idx + 2
    column.pos = baseline.pos + 2
    var sortCopy = clone(baseline.sort)
    column.sort = [...sortCopy, {name: 'variance_percentage', value: 2}]
    column.unit = '%'
    column.hide = !this.config['var_pct|' + baseline.modelField.name]
  }

  if (typeof this.config.columnOrder[column.id] !== 'undefined') {
    column.pos = this.config.columnOrder[column.id]
  } 

  column.pivoted = baseline.pivoted
  column.super = baseline.super
  column.pivot_key = baseline.pivot_key

  if (this.groupVarianceColumns) {
      column.sort[0].value = 1.5
  }

  this.headers.forEach((header, i) => {
    switch (header.type) {
      case 'pivot0':
      case 'pivot1':
        var label = baseline.getHeaderCellLabelByType(header.type)
        if (this.groupVarianceColumns && header.type === 'pivot0') {
          var label = this.pivot_values.length === 2 ? 'Variance' : 'Variance: ' + label
        }
        var headerCell = new HeaderCell({ column: column, type: header.type, modelField: { label: label } })
        column.levels[i] = headerCell
        break
      case 'heading':
        var headerCell = new HeaderCell({ column: column, type: 'heading', modelField: baseline.modelField })
        column.levels[i] = headerCell
        break
      case 'field':
        var headerCell = new HeaderCell({ column: column, type: 'field', modelField: baseline.modelField })
        column.levels[i] = headerCell
        break;
    }
  })

  this.columns.push(column)
  if (colpair.variance.reverse) {
    this.calculateVariance(baseline.modelField.value_format, id, colpair.calc, comparison, baseline)
  } else {
    this.calculateVariance(baseline.modelField.value_format, id, colpair.calc, baseline, comparison)
  }
}

/**
 * Function to add variance columns directly within table vis rather than requiring a table calc
 */
export function addVarianceColumns () {
  var variance_colpairs = []
  var calcs = ['absolute', 'percent']
  
  Object.keys(this.variances).forEach(v => {
    var variance = this.variances[v]
    if (variance.comparison !== 'no_variance') {          
      if (variance.type === 'vs_measure') {
        if (!this.hasPivots) {
          calcs.forEach(calc => {
            variance_colpairs.push({
              variance: variance,
              calc: calc
            })
          })
        } else {
          this.pivot_values.forEach(pivot_value => {
            if (!pivot_value.is_total) {
              calcs.forEach(calc => {
                variance_colpairs.push({
                  calc: calc,
                  variance: {
                    baseline: [pivot_value.key, variance.baseline].join('.'),
                    comparison: [pivot_value.key, variance.comparison].join('.'),
                    reverse: variance.reverse,
                    type: variance.type
                  }
                })
              })
            }
          })
        }
      } else if (variance.type === 'by_pivot') { 
        if (this.pivot_fields.length === 1 || this.pivot_fields[1].name === variance.comparison) {
          this.pivot_values.slice(1).forEach((pivot_value, index) => {
            calcs.forEach(calc => {
              if (!pivot_value.is_total) {
                variance_colpairs.push({
                  calc: calc,
                  variance: {
                    baseline: [pivot_value.key, variance.baseline].join('.'),
                    comparison: [this.pivot_values[index].key, variance.baseline].join('.'),
                    reverse: variance.reverse,
                    type: variance.type
                  }
                })
              }
            })
          })
        } else { // top pivot value - variance by subtotal
          var top_level_pivots = []
          this.pivot_values.forEach(pivot_value => {
            if (!pivot_value.is_total) {
              var value = pivot_value.data[this.pivot_fields[0].name]
              if (!top_level_pivots.includes(value)) {
                top_level_pivots.push(value)
              }
            }
          })
          top_level_pivots.slice(1).forEach((pivot_value, index) => {
            calcs.forEach(calc => {
              variance_colpairs.push({
                calc: calc,
                variance: {
                  baseline: ['$$$_subtotal_$$$', pivot_value, variance.baseline].join('.'),
                  comparison: ['$$$_subtotal_$$$', top_level_pivots[index], variance.baseline].join('.'),
                  reverse: variance.reverse,
                  type: variance.type
                }
              })
            })
          })
        } 
      }
    }
  })

  variance_colpairs.forEach(colpair => {
    this.createVarianceColumn(colpair)
  })
}
