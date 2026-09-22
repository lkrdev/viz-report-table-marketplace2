import SSF from "ssf"
import { INDEX_COLUMN } from '../constants'

import {
  CellSeries,
  Column,
  ColumnSeries,
  DataCell,
  HeaderCell,
  ModelDimension,
  ModelMeasure,
  ModelPivot,
  Row
} from '../vis_primitives'

import {
  tableModelCoreOptions,
  getConfigOptions,
  validateConfig
} from './config_options'

import {
  checkVarianceCalculations,
  checkSubtotalsData,
  buildTotals,
  addSubTotals,
  addColumnSubTotals,
  calculateVariance,
  createVarianceColumn,
  addVarianceColumns
} from './calculations'

import {
  compareSortArrays,
  sortData,
  compareRowsByClientSorts,
  compareRows,
  getActiveSorts,
  clientSort,
  sortColumns,
  transposeDimensionsIntoHeaders,
  transposeRowsIntoColumns,
  transposeColumnsIntoRows,
  getCellToolTip
} from './transforms'

/**
 * Represents an "enriched data object" with additional methods and properties for data vis
 * Takes the data, config and queryResponse objects as inputs to the constructor
 */
class VisPluginTableModel {
  /**
   * Build the LookerData object
   * @constructor
   * 
   * @param {*} lookerData 
   * @param {*} queryResponse 
   * @param {*} config 
   */
  constructor(lookerData, queryResponse, config) {
    this.visId = 'report_table'
    this.config = config

    this.headers = []
    this.dimensions = []
    this.measures = []
    this.columns = []
    this.data = []
    this.subtotals_data = {}
    this.subtotalRows = {}

    this.transposed_headers = []
    this.transposed_columns = []
    this.transposed_data = []

    this.pivot_fields = []
    this.pivot_values = typeof queryResponse.pivots !== 'undefined' ? queryResponse.pivots : []
    this.variances = []
    this.column_series = []

    this.firstVisibleDimension = ''

    this.useIndexColumn = config.indexColumn || false
    this.useHeadings = config.useHeadings || false
    this.useShortName = config.useShortName || false
    this.useViewName = config.useViewName || false
    this.addRowSubtotals = Boolean(config.rowSubtotals && !(config.allowSubtotalToggle && config.hideSubtotals))
    this.subtotalsOnTop = config.subtotalsOnTop || config.subtotalOnTop || false
    this.subtotalDepth = config.subtotalDepth || config.subtotal_depth || '(all)'
    this.addSubtotalDepth = this.subtotalDepth
    this.addColSubtotals = config.colSubtotals || false
    this.spanRows = false || config.spanRows
    this.spanCols = false || config.spanCols
    this.sortColsBy = config.sortColumnsBy || 'pivots' // matches to Column methods: pivots(), measures)
    this.fieldLevel = 0 // set in addPivotsAndHeaders()
    this.groupVarianceColumns = config.groupVarianceColumns || false
    this.minWidthForIndexColumns = config.minWidthForIndexColumns || false
    this.showTooltip = config.showTooltip || false
    this.showHighlight = config.showHighlight || false
    this.genericLabelForSubtotals = config.genericLabelForSubtotals || false
    this.subtotalStyle = this.addRowSubtotals ? (config.subtotalStyle || config.subtotal_style || 'simple') : 'simple'
    this.arrowStyle = config.arrowStyle || config.arrow_style || 'arrows'
    this.hideZeroCols = config.hideZeroCols || false
    this.hideNullDimensionCols = config.hideNullDimensionCols || config.hideNullDimensions || config.hideNullDimensionColumns || config.hideNullDims || false

    this.allowDimensionOrder = Boolean(config.allowUserEdits && config.allowDimensionOrder)
    this.allowMeasureOrder = Boolean(config.allowUserEdits && config.allowMeasureOrder)
    this.clientSorts = config.clientSorts || []
    this.sorts = queryResponse.sorts
    this.hasTotals = typeof queryResponse.totals_data !== 'undefined' ? true : false
    this.calculateOthers = typeof queryResponse.truncated !== 'undefined' ? queryResponse.truncated && config.calculateOthers : false 
    this.hasSubtotals = false
    this.hasRowTotals = queryResponse.has_row_totals || false
    this.hasPivots = Array.isArray(queryResponse.pivots) ? queryResponse.pivots.length > 0 : Boolean(queryResponse.pivots)
    this.hasSupers = typeof queryResponse.fields.supermeasure_like !== 'undefined' ? Boolean(queryResponse.fields.supermeasure_like.length) : false

    this.transposeTable = config.transposeTable || false

    var col_idx = 0
    this.addPivotsAndHeaders(queryResponse)
    this.addDimensions(queryResponse, col_idx)
    this.addMeasures(queryResponse, col_idx)

    this.checkVarianceCalculations()
    if (this.useIndexColumn) { this.addIndexColumn(queryResponse) }

    this.addRows(lookerData)
    this.hideNullDimensionColumns()
    this.addColumnSeries()

    var activeDims = this.dimensions.filter(d => !d.isNull && !this.config['hide|' + d.name] && this.config['style|' + d.name] !== 'hide');
    const parsedDepth = parseInt(this.addSubtotalDepth, 10);
    this.addSubtotalDepth = this.addSubtotalDepth === '(all)'
      ? '(all)'
      : Math.min(Math.max(1, isNaN(parsedDepth) ? activeDims.length - 1 : parsedDepth), Math.max(1, activeDims.length - 1));

    if (typeof queryResponse.subtotals_data !== 'undefined' || typeof queryResponse.subtotalsData !== 'undefined') { this.checkSubtotalsData(queryResponse) }
    if (this.hasTotals) { this.buildTotals(queryResponse) }
    if (this.spanRows) { this.setRowSpans() }
    if (this.addRowSubtotals) { this.addSubTotals() }
    if (this.addColSubtotals && this.pivot_fields.length === 2) { this.addColumnSubTotals() }
    if (this.variances) { this.addVarianceColumns() }

    this.hideZeroColumns()

    this.sortData()
    this.sortColumns()
    this.columns.forEach(column => column.setHeaderCellLabels())
    if (this.spanCols) { this.setColSpans() }
    this.applyFormatting()

    if (this.transposeTable) { 
      this.transposeDimensionsIntoHeaders()
      this.transposeRowsIntoColumns() 
      this.transposeColumnsIntoRows()
    }

    this.validateConfig()
    this.getTableColumnGroups() 
  }

  static getCoreConfigOptions() {
    return tableModelCoreOptions
  }

  /**
   * - this.pivot_fields
   * - this.headers
   * @param {*} queryResponse 
   */
  addPivotsAndHeaders(queryResponse) {
    queryResponse.fields.pivots.forEach((pivot, i) => {
      var pivot_field = new ModelPivot({ vis: this, queryResponseField: pivot })
      this.pivot_fields.push(pivot_field)
      this.headers.push({ type: 'pivot' + i, modelField: pivot_field })
    })

    var measureHeaders = this.useHeadings 
      ? [{ type: 'heading', modelField: { label: '(will be replaced by header for column)s' } }] 
      : []
    
    measureHeaders.push({ type: 'field', modelField: { label: '(will be replaced by field for column)' } })

    if (this.sortColsBy === 'pivots') {
      this.headers.push(...measureHeaders)
    } else {
      this.headers.unshift(...measureHeaders)
    }

    for (var i = 0; i < this.headers.length; i++) {
      if (!this.headers[i] === 'field') {
        this.fieldLevel = i
        break
      }
    }
  }

  /**
   * - this.dimensions
   * - this.columns
   * @param {*} queryResponse 
   * @param {*} col_idx 
   */
  addDimensions(queryResponse, col_idx) {
    const canReorderDims = Boolean(this.allowDimensionOrder && !this.addRowSubtotals && !this.useIndexColumn)
    queryResponse.fields.dimension_like.forEach(dimension => {
      var newDimension = new ModelDimension({
        vis: this,
        queryResponseField: dimension
      })
      newDimension.hide = this.useIndexColumn ? true : newDimension.hide
      this.dimensions.push(newDimension)

      var column = new Column(newDimension.name, this, newDimension) 
      column.isDimension = true
      column.idx = col_idx
      column.pos = (canReorderDims && this.config.columnOrder && typeof this.config.columnOrder[column.id] !== 'undefined')
        ? this.config.columnOrder[column.id]
        : col_idx
      column.sort.push({name: 'section', value: 0})
      this.headers.forEach(header => {
        switch (header.type) {
          case 'pivot0':
          case 'pivot1':
            var pivotField = new ModelPivot({ vis: this, queryResponseField: header.modelField })
            var headerCell = new HeaderCell({ column: column, type: header.type, modelField: pivotField })
            headerCell.label = ''
            column.levels.push(headerCell)
            column.sort.push({name: header.type, value: 0})
            break
          case 'heading':
            column.levels.push(new HeaderCell({ column: column, type: 'heading', modelField: newDimension }))
            break
          case 'field':
            column.levels.push(new HeaderCell({ column: column, type: 'field', modelField: newDimension }))
            column.sort.push({name: 'column.pos', value: column.pos})
            break
        }
      })

      this.columns.push(column)
      col_idx += 10
    })

    if (canReorderDims) {
      this.dimensions.sort((a, b) => (this.getColumnById(a.name).pos ?? 0) - (this.getColumnById(b.name).pos ?? 0))
    }

    for (var i = 0; i < this.dimensions.length; i++) {
      var dimension = this.dimensions[i]
      if (!dimension.hide) {
        this.firstVisibleDimension = dimension.name
        break
      }
    }

    if (this.subtotalStyle === 'collapsed') {
      var visibleDims = this.dimensions.filter(d => !d.hide)
      var depthLimit = (!this.subtotalDepth || this.subtotalDepth === '(all)')
        ? visibleDims.length
        : (parseInt(this.subtotalDepth, 10) || visibleDims.length);

      visibleDims.forEach((dim, idx) => {
        if (idx > 0 && idx < depthLimit) {
          dim.hide = true
          var col = this.columns.find(c => c.id === dim.name)
          if (col) col.hide = true
        } else if (idx >= depthLimit) {
          dim.hide = false
          var col = this.columns.find(c => c.id === dim.name)
          if (col) col.hide = false
        }
      })
    }
  }

  /**
   * Registers measures with the VisPluginTableModel
   * - this.measures
   * - this.columns
   * 
   * @param {*} queryResponse 
   * @param {*} col_idx 
   */
  addMeasures(queryResponse, col_idx) {
    queryResponse.fields.measure_like.forEach(measure => {
      var newMeasure = new ModelMeasure({
        vis: this,
        queryResponseField: measure,
        can_pivot: true
      })

      var reportInSetting = this.config['reportIn|' + measure.name]
      var unitSetting = this.config['unit|' + measure.name]
      if (typeof reportInSetting !== 'undefined'  && reportInSetting !== '1') {
        newMeasure.value_format = '#,##0'
        if (typeof unitSetting !== 'undefined' && unitSetting !== '') {
           newMeasure.unit = unitSetting
        }
      }
      this.measures.push(newMeasure) 
    })
    
    const getMeasurePos = (measureName, mIdx) => {
      if (this.allowMeasureOrder && this.config.columnOrder && typeof this.config.columnOrder[measureName] !== 'undefined') {
        return this.config.columnOrder[measureName]
      }
      return mIdx * 10
    }

    if (this.hasPivots) {
      this.pivot_values.forEach((pivot_value, p_idx) => {
        var isRowTotal = pivot_value.key === '$$$_row_total_$$$'
        this.measures.forEach((measure, m) => {
          var include_measure = !isRowTotal || ( isRowTotal && !measure.is_table_calculation )
          
          if (include_measure) {
            var measurePos = getMeasurePos(measure.name, m)
            var column = new Column([pivot_value.key, measure.name].join('.'), this, measure)
            column.pivoted = isRowTotal ? false : true
            column.isRowTotal = isRowTotal
            column.pivot_key = pivot_value.key
            column.pivot_index = isRowTotal ? undefined : p_idx
            column.idx = m * 10
            column.pos = measurePos

            var tempSort = []
            var level_sort_values = []
            this.headers.forEach(header => {
              switch (header.type) {
                case 'pivot0':
                case 'pivot1':
                  var label = isRowTotal ? '' : (pivot_value.metadata?.[header.modelField.name]?.rendered || pivot_value.metadata?.[header.modelField.name]?.value || '')
                  if (isRowTotal && header.type.startsWith('pivot') && header.type === 'pivot' + (this.pivot_fields.length - 1)) {
                    label = 'Row Total'
                  }
                  column.levels.push(new HeaderCell({ 
                    column: column, 
                    type: header.type, 
                    modelField: { label: label },
                    pivotData: pivot_value
                  }))
                  level_sort_values.push(pivot_value.sort_values[header.modelField.name])
                  if (column.pivoted) {
                    tempSort.push({ name: header.modelField.name, value: pivot_value.sort_values[header.modelField.name] })
                  } else {
                    tempSort.push({ name: header.modelField.name, value: 0 })
                  }
                  break

                case 'heading':
                  column.levels.push(new HeaderCell({ column: column, type: 'heading', modelField: measure}))
                  break

                case 'field':
                  column.levels.push(new HeaderCell({ column: column, type: 'field', modelField: measure}))
                  break;
              }
            })

            var sort = []
            sort.push({ name: 'section', value: isRowTotal ? 2 : 1 })
            if (this.sortColsBy === 'measures') {
              sort.push({ name: 'measure_idx', value: measurePos })
            }
            if (this.pivot_fields.length === 2) {
              if (this.addColSubtotals) {
                sort = sort.concat(tempSort)
              } else {
                var sortTracker = []
                this.sorts.forEach(s => {
                  this.pivot_fields.forEach(p => {
                    if (p.name === s.name) {
                      tempSort.forEach(t => {
                        if (t.name === p.name) {
                          sortTracker.push(t.name)
                        }
                      })
                    }
                  })
                })
                if (sortTracker[0] === this.pivot_fields[0].name) {
                  sort = sort.concat(tempSort)
                } else {
                  sort = sort.concat(tempSort.reverse())
                }
              }
            } else {
              sort.push(tempSort[0])
            }
            
            if (this.sortColsBy === 'pivots') {
              sort.push({ name: 'measure_idx', value: measurePos })
            }
            column.sort = sort

            this.columns.push(column)
            col_idx += 10
          }
        })
      })
    } else {
      this.measures.forEach((measure, m) => {
        var column = new Column(measure.name, this, measure)
        column.sort.push({name: 'section', value: 1})
        column.idx = col_idx
        column.pos = getMeasurePos(measure.name, m)

        this.headers.forEach(header => {
          switch (header.type) {
            case 'heading':
              column.levels.push(new HeaderCell({ column: column, type: 'heading', modelField: measure}))
              break

            case 'field':
              column.levels.push(new HeaderCell({ column: column, type: 'field', modelField: measure}))
              column.sort.push({name: 'column.pos', value: column.pos})
              break;
          }
        })

        this.columns.push(column)
        col_idx += 10
      })
    }
    
    if (typeof queryResponse.fields.supermeasure_like !== 'undefined') {
      queryResponse.fields.supermeasure_like.forEach(supermeasure => {
        var meas = new ModelMeasure({
          vis: this,
          queryResponseField: supermeasure,
          can_pivot: false,
        })
        var reportInSetting = this.config['reportIn|' + supermeasure.name]
        var unitSetting = this.config['unit|' + supermeasure.name]
        if (typeof reportInSetting !== 'undefined'  && reportInSetting !== '1') {
          meas.value_format = '#,##0'
          if (typeof unitSetting !== 'undefined' && unitSetting !== '') {
            meas.unit = unitSetting
          }
        }
        this.measures.push(meas) 

        var column = new Column(meas.name, this, meas)
        column.sort.push({ name: 'section', value: 2 })
        this.headers.forEach(header => {
          switch (header.type) {
            case 'pivot0':
            case 'pivot1':
              column.levels.push(new HeaderCell({ column: column, type: header.type, modelField: { label: '' } }))
              column.sort.push({name: header.type, value: 0})
              break
            case 'heading':
              column.levels.push(new HeaderCell({ column: column, type: 'heading', modelField: meas }))
              break
            case 'field':
              column.levels.push(new HeaderCell({ column: column, type: 'field', modelField: meas }))
              column.sort.push({name: 'col_idx', value: col_idx})
              break
          }
        })
        column.idx = col_idx
        column.super = true

        this.columns.push(column)
        col_idx += 10
      })
    }
  }

  hideZeroColumns() {
    if (!this.hideZeroCols) {
      return
    }

    this.columns.forEach(column => {
      if (column.isDimension) {
        return
      }

      var hasLineItems = false
      var allZero = true
      for (var i = 0; i < this.data.length; i++) {
        var row = this.data[i]
        if (row.type === 'line_item') {
          hasLineItems = true
          var cell = row.data[column.id]
          if (cell) {
            var val = cell.value
            if (val !== null && val !== undefined && val !== '') {
              var isNumericZero = false
              if (typeof val === 'number' && val === 0) {
                isNumericZero = true
              } else if (typeof val === 'string' && val.trim() !== '') {
                var numVal = Number(val)
                if (!isNaN(numVal) && numVal === 0) {
                  isNumericZero = true
                }
              }
              if (!isNumericZero) {
                allZero = false
                break
              }
            }
          }
        }
      }

      if (hasLineItems && allZero) {
        column.hide = true
      }
    })
  }

  hideNullDimensionColumns() {
    if (!this.hideNullDimensionCols) {
      return
    }

    this.dimensions.forEach(dimension => {
      var hasLineItems = false
      var allNull = true
      for (var i = 0; i < this.data.length; i++) {
        var row = this.data[i]
        if (row.type === 'line_item') {
          hasLineItems = true
          var cell = row.data[dimension.name]
          if (cell) {
            var val = cell.value
            if (val !== null && val !== undefined) {
              if (typeof val === 'string' && val.trim() === '') {
                // whitespace or empty string is considered null
              } else {
                allNull = false
                break
              }
            }
          }
        }
      }

      if (hasLineItems && allNull) {
        dimension.isNull = true
        dimension.hide = true
        var col = this.columns.find(c => c.id === dimension.name)
        if (col) {
          col.hide = true
        }
      }
    })

    for (var i = 0; i < this.dimensions.length; i++) {
      var dimension = this.dimensions[i]
      if (!dimension.hide) {
        this.firstVisibleDimension = dimension.name
        break
      }
    }

    if (this.subtotalStyle === 'collapsed') {
      var nonNullDims = this.dimensions.filter(d => !d.isNull && !this.config['hide|' + d.name] && this.config['style|' + d.name] !== 'hide')
      var depthLimit = (!this.subtotalDepth || this.subtotalDepth === '(all)')
        ? nonNullDims.length
        : (parseInt(this.subtotalDepth, 10) || nonNullDims.length);

      nonNullDims.forEach((dim, idx) => {
        if (idx > 0 && idx < depthLimit) {
          dim.hide = true
          var col = this.columns.find(c => c.id === dim.name)
          if (col) col.hide = true
        } else if (idx >= depthLimit) {
          dim.hide = false
          var col = this.columns.find(c => c.id === dim.name)
          if (col) col.hide = false
        }
      })
    }

    if (this.useIndexColumn) {
      var nonNullDims = this.dimensions.filter(d => !d.isNull && !this.config['hide|' + d.name] && this.config['style|' + d.name] !== 'hide' && d.name !== INDEX_COLUMN)
      var last_dim = nonNullDims.length > 0 ? nonNullDims[nonNullDims.length - 1].name : this.dimensions[this.dimensions.length - 1].name
      for (var i = 0; i < this.data.length; i++) {
        var row = this.data[i]
        if (row.type === 'line_item' && row.data[last_dim] && row.data[INDEX_COLUMN]) {
          var sourceCell = row.data[last_dim]
          row.data[INDEX_COLUMN].value = sourceCell.value
          row.data[INDEX_COLUMN].rendered = sourceCell.rendered
          row.data[INDEX_COLUMN].html = sourceCell.html
        }
      }
    }
  }

  /**
   * Creates the index column, a "for display only" column when the set of dimensions is reduced to
   * a single column for reporting purposes.
   */
  addIndexColumn() {
    var dimension = this.dimensions[this.dimensions.length - 1]
    var dim_config_setting = this.config['hide|' + dimension.name]
    var column = new Column(INDEX_COLUMN, this, dimension)
    column.isDimension = true
    column.sort.push({name: 'section', value: -1})
    column.hide = dim_config_setting === true ? dim_config_setting : false

    this.headers.forEach(header => {
      switch (header.type) {
        case 'pivot0':
        case 'pivot1':
          var pivotField = new ModelPivot({ vis: this, queryResponseField: header.modelField })
          var headerCell = new HeaderCell({ column: column, type: header.type, modelField: pivotField })
          headerCell.label = ''
          column.levels.push(headerCell)
          column.sort.push({name: header.type, value: 0})
          break
        case 'heading':
          column.levels.push(new HeaderCell({ column: column, type: 'heading', modelField: dimension }))
          break
        case 'field':
          column.levels.push(new HeaderCell({ column: column, type: 'field', modelField: dimension }))
          column.sort.push({name: column.id, value: 0})
          break
      }
    })
    
    this.columns.push(column)
  }

  /**
   * Populates this.data with Rows of data
   * @param {*} lookerData 
   */
  addRows(lookerData) {
    lookerData.forEach((lookerRow, i) => {
      var row = new Row('line_item')
      row.id = this.dimensions.map(dimension => lookerRow[dimension.name].value).join('|')

      this.columns.forEach(column => {
        var cellValue = (column.pivoted || column.isRowTotal) ? lookerRow[column.modelField.name]?.[column.pivot_key] : lookerRow[column.id]
        var cell = new DataCell({ 
          ...cellValue, 
          ...{ 
            cell_style: [column.modelField.type], 
            colid: column.id, 
            rowid: row.id } 
        })

        if (column.modelField.is_numeric) {
          cell.cell_style.push('numeric')
          cell.align = 'right'
        } else {
          cell.cell_style.push('nonNumeric')
          cell.align = 'left'
        }

        if (typeof column.modelField.style !== 'undefined') {
          cell.cell_style = cell.cell_style.concat(column.modelField.style)
        }

        var reportInSetting = this.config['reportIn|' + column.modelField.name]
        if (typeof reportInSetting !== 'undefined'  && reportInSetting !== '1') {
          var unit = this.config.useUnit && column.modelField.unit !== '#'  ? column.modelField.unit : ''
          cell.html = null
          cell.value = Math.round(cell.value / parseInt(reportInSetting))
          cell.rendered = column.modelField.value_format === '' ? cell.value.toString() : unit + SSF.format(column.modelField.value_format, cell.value)
        }

        if (column.modelField.is_turtle) {
          var cell_series = new CellSeries({
            column: column,
            row: row,
            sort_value: cell.sort_value,
            series: {
              keys: row.data[column.id]._parsed.keys,
              values: row.data[column.id]._parsed.values
            }
          })
          cell.value = cell_series
          cell.rendered = cell_series.toString()
        }

        row.data[column.id] = cell
      })

      if (this.subtotalStyle === 'collapsed') {
        row.dimensionValues = this.dimensions.map(dimension => row.data[dimension.name]?.value)
        row.originalDimensionValues = {}
        this.dimensions.forEach(dim => {
          row.originalDimensionValues[dim.name] = row.data[dim.name]?.value
        })
        const nonNullDims = this.dimensions.filter(d => !d.isNull && !this.config['hide|' + d.name] && this.config['style|' + d.name] !== 'hide')
        const depthLimit = (!this.subtotalDepth || this.subtotalDepth === '(all)')
          ? nonNullDims.length
          : (parseInt(this.subtotalDepth, 10) || nonNullDims.length);
        const lastCollapsedDim = nonNullDims[depthLimit - 1]
        if (lastCollapsedDim && row.data[lastCollapsedDim.name]) {
          const leafValue = row.data[lastCollapsedDim.name].value
          const leafRendered = row.data[lastCollapsedDim.name].rendered
          const leafHtml = row.data[lastCollapsedDim.name].html
          if (row.data[this.firstVisibleDimension]) {
            row.data[this.firstVisibleDimension].value = leafValue
            row.data[this.firstVisibleDimension].rendered = leafRendered
            row.data[this.firstVisibleDimension].html = leafHtml
          }
        }
      }

      if (this.useIndexColumn) {
        var last_dim = this.dimensions[this.dimensions.length - 1].name
        var sourceCell = row.data[last_dim]

        row.data[INDEX_COLUMN] = new DataCell({
          value: sourceCell.value,
          rendered: sourceCell.rendered,
          html: sourceCell.html,
          cell_style: ['singleIndex', 'dimension'],
          align: this.dimensions[this.dimensions.length - 1].is_numeric ? 'right' : 'left',
          colid: INDEX_COLUMN,
          rowid: sourceCell.rowid
        })
      }

      row.sort = [
        {name: 'section', value: 0}, 
        {name: 'subtotal', value: 0},
        {name: 'original_row', value: i}
      ]
      this.data.push(row)
    })
  }

  /**
   * Generate data series to support transposition
   */
  addColumnSeries() {
    this.columns.forEach(column => {
      var keys = []
      var values = []
      var types = []

      this.data.forEach(row => {
        keys.push(row.id)
        values.push(row.data[column.id].value)
        types.push(row.type)
      })

      var new_series = new ColumnSeries({
        column: column,
        is_numeric: column.modelField.is_numeric,
        series: {
          keys: keys,
          values: values,
          types: types
        }
      })
      
      column.series = new_series
      this.column_series.push(new_series)
    })
  }

  getEffectiveFreezeColumns(forceOriginal = false) {
    const X = Number(this.config.freezeFirstColumns) || 0;
    if (X <= 0) return 0;
    const allCols = (!forceOriginal && this.transposeTable) ? this.transposed_columns : this.columns;
    if (!allCols || allCols.length === 0) return X;
    return allCols.slice(0, X).filter(c => !c.hide).length;
  }

  getDimensionColspans() {
    const X = this.getEffectiveFreezeColumns(true);
    const visibleDimIds = [];
    if (this.useIndexColumn) {
      visibleDimIds.push(INDEX_COLUMN);
    }
    this.dimensions.forEach(d => {
      if (!d.hide) {
        visibleDimIds.push(d.name);
      }
    });
    const N_dim = visibleDimIds.length;
    
    const colspans = {};
    visibleDimIds.forEach(id => {
      colspans[id] = { colspan: -1, rowspan: -1 };
    });

    if (N_dim === 0) return colspans;

    if (X > 0 && X < N_dim) {
      colspans[visibleDimIds[0]] = { colspan: X, rowspan: 1 };
      colspans[visibleDimIds[X]] = { colspan: N_dim - X, rowspan: 1 };
    } else {
      colspans[visibleDimIds[0]] = { colspan: N_dim, rowspan: 1 };
    }
    return colspans;
  }

  setRowSpans () {
    var leaves = []
    var tiers = []
    var span_tracker = {}

    leaves = this.data
    tiers = this.dimensions.filter(d => !d.hide)
    tiers.forEach(tier => {
      span_tracker[tier.name] = 1
    })

    for (var l = leaves.length - 1; l >= 0 ; l--) {
      var leaf = leaves[l]

      if (leaf.type !== 'line_item' ) {
        tiers.forEach(tier => {
          span_tracker[tier.name] = 1
        })
        continue;
      }

      for (var t = 0; t < tiers.length; t++) {
        var tier = tiers[t]
        var this_tier_value = leaf.data[tier.name].value
        var neighbour_value = l > 0 ? leaves[l - 1].data[tier.name].value : null

        if (l > 0 && leaves[l - 1].type === 'line_item' && this_tier_value === neighbour_value) {
          leaf.data[tier.name].rowspan = -1
          leaf.data[tier.name].colspan = -1
          span_tracker[tier.name] += 1
        } else {
          for (var t_ = t; t_ < tiers.length; t_++) {
            var tier_ = tiers[t_]
            leaf.data[tier_.name].rowspan = span_tracker[tier_.name]
            if (leaf.data[tier_.name].rowspan > 1) {
              leaf.data[tier_.name].cell_style.push('merged')
            }
            span_tracker[tier_.name] = 1
          }
          break;
        }
      }
    }
  }

  setColSpans () {
    var leaves = []
    var tiers = []
    var span_tracker = {}
    
    var columns = this.columns.filter(c => !c.hide)

    columns.forEach(column => {
      column.levels.forEach(level => {
        level.colspan = 1
        level.rowspan = 1
        level.cell_style = level.cell_style.filter(s => s !== 'merged')
      })
      var leaf = {
        id: column.id,
        data: column.getHeaderData()
      }
      leaves.push(leaf)
    })

    tiers = this.headers
    tiers.forEach(tier => {
      span_tracker[tier.type] = 1
    })

    for (var l = leaves.length - 1; l >= 0; l--) {
      var leaf = leaves[l]

      for (var t = 0; t < tiers.length; t++) {
        var tier = tiers[t]
        var this_tier_value = leaf.data[tier.type].label
        var neighbour_value = l > 0 ? leaves[l - 1].data[tier.type].label : null

        if (l > 0 && this_tier_value === neighbour_value) {
          leaf.data[tier.type].colspan = -1
          leaf.data[tier.type].rowspan = -1
          span_tracker[tier.type] += 1;
        } else {
          for (var t_ = t; t_ < tiers.length; t_++) {
            var tier_ = tiers[t_]
            leaf.data[tier_.type].colspan = span_tracker[tier_.type]
            if (leaf.data[tier_.type].colspan > 1) {
              leaf.data[tier_.type].align = 'center'
              leaf.data[tier_.type].cell_style.push('merged')
            }
            span_tracker[tier_.type] = 1
          }
          break;
        }
      }
    }
  }

  /**
   * Applies conditional formatting (red if negative) to all measure columns set to use it 
   */
  applyFormatting() {
    this.columns.forEach(column => {
      var config_setting = this.config['style|' + column.modelField.name]
      if (typeof config_setting !== 'undefined') {
        switch (config_setting) {
          case 'black_red':
            this.data.forEach(row => {
              if (row.data[column.id].value < 0) {
                row.data[column.id].cell_style.push('negative')
              }
            })
            break
        }
      }
    })
  }

  /**
   * Returns column that matches ID provided
   * @param {*} id 
   */
  getColumnById (id) {
    return this.columns.find(c => c.id === id) || {}
  }

  /**
   * Returns row that matches ID provided
   * @param {*} id 
   */
  getRowById (id) {
    return this.data.find(r => r.id === id) || {}
  }

  /**
   * Extracts the formatted value of the field from the html: value
   * @param {*} cellValue 
   */
  getRenderedFromHtml (cellValue) {
    var parser = new DOMParser()
    if (typeof cellValue.html !== 'undefined' && !['undefined', ''].includes(cellValue.html)) {
      try {
        var parsed_html = parser.parseFromString(cellValue.html, 'text/html')
        var rendered = parsed_html.documentElement.textContent
      }
      catch(TypeError) {
        var rendered = cellValue.html
      }
    } else {
      var rendered = cellValue.value
    }

    return rendered
  }

  /**
   * Used to support rendering of table as vis. 
   * Returns an array of 0s, of length to match the required number of header rows
   */
  getHeaderTiers () {    
    if (!this.transposeTable) {
      return this.headers
    } else {
      return this.transposed_headers
    }
  }

  /**
   * Used to support rendering of data table as vis. 
   * Builds list of columns out of data set that should be displayed
   * @param {*} i 
   */
  getTableHeaderCells (i) {
    if (!this.transposeTable) {
      return this.columns
        .filter(c => !c.hide)
        .filter(c => c.levels[i].colspan > 0)
    } else {
      return this.transposed_columns
        .filter(c => c.levels[i].colspan > 0)
    }
  }

  getDataRows () {
    if (!this.transposeTable) {
      var dataRows = this.data.filter(row => !row.hide)
    } else {
      var dataRows = this.transposed_data.filter(row => !row.hide)
    }
    return dataRows
  }

  /**
   * Used to support rendering of data table as vis.
   * For a given row of data, returns filtered array of cells – only those cells that are to be displayed.
   * @param {*} row 
   */
  getTableRowColumns (row) {
    if (!this.transposeTable) {
      var cells = this.columns
        .filter(column => !column.hide)
        .filter(column => row.data[column.id].rowspan > 0)
    } else {
      var cells = this.transposed_columns
      .filter(column => !column.hide)
      .filter(column => row.data[column.id].rowspan > 0)
    }
    return cells    
  }

  /**
   * Used to support column drag'n'drop when rendering data table as vis.
   * Updates the table.config with the new pos values.
   * Accepts a callback function for interaction with the vis.
   * @param {*} from 
   * @param {*} to 
   * @param {*} updateColumnOrder 
   */
  moveColumns(from, to, updateColumnOrder, groupType = 'measure') {
    if (from !== to) {
      var shift = to - from
      var col_order = { ...(this.config.columnOrder || {}) }
      this.columns.forEach(col => {
        var isTargetGroup = groupType === 'dimension'
          ? (col.isDimension && col.id !== INDEX_COLUMN)
          : (col.modelField.type === 'measure' && !col.super)
        if (isTargetGroup && typeof col.pos === 'number') {
          if (col.pos >= from && col.pos < from + 10) {
            col.pos += shift
          } else if (col.pos >= to && col.pos < from) {
            col.pos += 10
          } else if (col.pos >= from + 10 && col.pos < to + 10) {
            col.pos -= 10
          }
          var posSort = col.sort && col.sort.find(s => s.name === 'column.pos' || s.name === 'measure_idx')
          if (posSort) posSort.value = col.pos
          if (groupType === 'measure' && !col.isVariance && col.modelField && col.modelField.name) {
            col_order[col.modelField.name] = Math.floor(col.pos / 10) * 10
          }
          col_order[col.id] = col.pos
        } 
      })
      this.config.columnOrder = col_order
      if (groupType === 'dimension') {
        this.dimensions.sort((a, b) => (this.getColumnById(a.name).pos ?? 0) - (this.getColumnById(b.name).pos ?? 0))
        var firstVis = this.dimensions.find(d => !d.hide)
        this.firstVisibleDimension = firstVis ? firstVis.name : ''
      }
      this.sortColumns()
      if (this.spanCols) { this.setColSpans() }
      if (this.spanRows) { this.setRowSpans() }
      if (updateColumnOrder) updateColumnOrder(col_order)
    }
  }

  /**
   * Builds array of arrays, used at by table vis to build column groups
   */
  getTableColumnGroups () {
    var indexColumns = []
    var measureColumns = []
    var totalColumns = []

    if (!this.transposeTable) {
      this.columns.forEach(column => {
        if (column.modelField.type === 'dimension' && !column.hide) {
          indexColumns.push({ id: column.id, type: 'index' })
        } else if (column.modelField.type === 'measure' && !column.isRowTotal && !column.super && !column.hide) {
          measureColumns.push({ id: column.id, type: 'dataCell' })
        } else if (column.modelField.type === 'measure' && (column.isRowTotal || column.super) && !column.hide) {
          totalColumns.push({ id: column.id, type: 'dataCell' })
        }
      })
    } else {
      this.transposed_columns.forEach(column => {
        if (column.modelField.type === 'transposed_table_index') {
          indexColumns.push({ id: column.id, type: 'index' })
        } else if (column.modelField.type === 'transposed_table_measure' && column.id !== 'Total') {
          measureColumns.push({ id: column.id, type: 'dataCell' })
        } else if (column.modelField.type === 'transposed_table_measure' && column.id === 'Total') {
          totalColumns.push({ id: column.id, type: 'dataCell' })
        }
      })
    }

    var columnGroups = []
    if (indexColumns.length > 0) {
      columnGroups.push(indexColumns)
    }
    if (measureColumns.length > 0) {
      columnGroups.push(measureColumns)
    }
    if (totalColumns.length > 0) {
      columnGroups.push(totalColumns)
    }

    return columnGroups
  }
}

Object.assign(
  VisPluginTableModel.prototype,
  {
    getConfigOptions,
    validateConfig
  },
  {
    checkVarianceCalculations,
    checkSubtotalsData,
    buildTotals,
    addSubTotals,
    addColumnSubTotals,
    calculateVariance,
    createVarianceColumn,
    addVarianceColumns
  },
  {
    compareSortArrays,
    sortData,
    compareRowsByClientSorts,
    compareRows,
    getActiveSorts,
    clientSort,
    sortColumns,
    transposeDimensionsIntoHeaders,
    transposeRowsIntoColumns,
    transposeColumnsIntoRows,
    getCellToolTip
  }
)

export { VisPluginTableModel }
