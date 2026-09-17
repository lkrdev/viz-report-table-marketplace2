import { INDEX_COLUMN } from '../constants'
import {
  Column,
  DataCell,
  HeaderCell,
  Row
} from '../vis_primitives'

export function compareSortArrays (dataTable) {
  return function(a, b) {
    var active = dataTable.getActiveSorts ? dataTable.getActiveSorts() : (dataTable.clientSorts && dataTable.clientSorts.length > 0 ? dataTable.clientSorts : (dataTable.sorts || []))
    var depth = Math.max(a.sort.length, b.sort.length)
    for (var i = 0; i < depth; i++) {
        var aSortItem = a.sort[i]
        var field = (aSortItem && typeof aSortItem.name !== 'undefined') ? aSortItem.name : ''
        var sort = field ? active.find(item => item.name === field) : undefined
        var desc = typeof sort !== 'undefined' ? sort.desc : false

        var a_value = typeof a.sort[i] !== 'undefined' ? a.sort[i].value : 0
        var b_value = typeof b.sort[i] !== 'undefined' ? b.sort[i].value : 0

        if (desc) {
          if (a_value < b_value) { return 1 }
          if (a_value > b_value) { return -1 }
        } else {
          if (a_value > b_value) { return 1 }
          if (a_value < b_value) { return -1 }
        }
    }
    return -1
  }
}

/**
 * Sorts the rows of data, then updates vertical cell merge 
 * 
 * Rows are sorted by three values:
 * 1. Section
 * 2. Subtotal Group
 * 3. Row Value (currently based only on original row index from the Looker data object)
 */
export function sortData () {
  this.data.sort(this.compareRows(this))
  if (this.spanRows) { this.setRowSpans() }
}

export function compareRowsByClientSorts (a, b) {
  const monthOrder = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
  }
  const activeSorts = this.getActiveSorts ? this.getActiveSorts() : (this.clientSorts || [])
  if (activeSorts && activeSorts.length > 0) {
    for (var c = 0; c < activeSorts.length; c++) {
      var sortObj = activeSorts[c]
      var cellA = a.data[sortObj.name]
      var cellB = b.data[sortObj.name]

      var valA = cellA ? (cellA.sort_value !== undefined ? cellA.sort_value : (cellA.value && cellA.value.sort_value !== undefined ? cellA.value.sort_value : cellA.value)) : null
      var valB = cellB ? (cellB.sort_value !== undefined ? cellB.sort_value : (cellB.value && cellB.value.sort_value !== undefined ? cellB.value.sort_value : cellB.value)) : null

      if (valA === null || valA === undefined) valA = ''
      if (valB === null || valB === undefined) valB = ''

      if (valA === '' && valB !== '') return 1
      if (valA !== '' && valB === '') return -1

      if (valA !== valB) {
        if (sortObj.name && sortObj.name.endsWith('_month_name')) {
          var m1 = monthOrder[String(valA).trim().toLowerCase().substring(0, 3)] ?? 999
          var m2 = monthOrder[String(valB).trim().toLowerCase().substring(0, 3)] ?? 999
          if (m1 !== m2) {
            return sortObj.desc ? m2 - m1 : m1 - m2
          }
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          var cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
          if (cmp !== 0) {
            return sortObj.desc ? -cmp : cmp
          }
        } else {
          if (valA < valB) return sortObj.desc ? 1 : -1
          if (valA > valB) return sortObj.desc ? -1 : 1
        }
      }
    }
  }
  return 0
}

export function compareRows (dataTable) {
  return function(a, b) {
    var sectionA = a.sort && a.sort.find(s => s.name === 'section') ? a.sort.find(s => s.name === 'section').value : 0
    var sectionB = b.sort && b.sort.find(s => s.name === 'section') ? b.sort.find(s => s.name === 'section').value : 0
    if (sectionA !== sectionB) {
      return sectionA - sectionB
    }

    var subProps = a.sort ? a.sort.filter(s => s.name && s.name.startsWith('subtotal')) : []
    for (var k = 0; k < subProps.length; k++) {
      var pName = subProps[k].name
      var subA = a.sort.find(s => s.name === pName) ? a.sort.find(s => s.name === pName).value : 0
      var subB = b.sort && b.sort.find(s => s.name === pName) ? b.sort.find(s => s.name === pName).value : 0
      if (subA !== subB) {
        const activeSorts = dataTable.getActiveSorts ? dataTable.getActiveSorts() : (dataTable.clientSorts || []);
        if (activeSorts && activeSorts.length > 0) {
          const subRowA = dataTable.subtotalRows && dataTable.subtotalRows[k] ? dataTable.subtotalRows[k][subA] : null
          const subRowB = dataTable.subtotalRows && dataTable.subtotalRows[k] ? dataTable.subtotalRows[k][subB] : null
          if (subRowA && subRowB) {
            const cmp = dataTable.compareRowsByClientSorts(subRowA, subRowB)
            if (cmp !== 0) {
              return cmp
            }
          }
        }
        return subA - subB
      }
    }

    if (a.type !== 'line_item' || b.type !== 'line_item') {
      var origA = a.sort && a.sort.find(s => s.name === 'original_row') ? a.sort.find(s => s.name === 'original_row').value : 0
      var origB = b.sort && b.sort.find(s => s.name === 'original_row') ? b.sort.find(s => s.name === 'original_row').value : 0
      return origA - origB
    }

    const activeSorts = dataTable.getActiveSorts ? dataTable.getActiveSorts() : (dataTable.clientSorts || []);
    if (activeSorts && activeSorts.length > 0) {
      const cmp = dataTable.compareRowsByClientSorts(a, b)
      if (cmp !== 0) {
        return cmp
      }
    }

    var origA = a.sort && a.sort.find(s => s.name === 'original_row') ? a.sort.find(s => s.name === 'original_row').value : 0
    var origB = b.sort && b.sort.find(s => s.name === 'original_row') ? b.sort.find(s => s.name === 'original_row').value : 0
    return origA - origB
  }
}

export function getActiveSorts () {
  return (this.clientSorts && this.clientSorts.length > 0) 
    ? this.clientSorts 
    : (this.sorts || []);
}

export function clientSort (colId, shiftKey) {
  var column = this.columns.find(c => c.id === colId)
  var pivot = this.pivot_fields.find(p => p.name === colId)
  if (!column && !pivot) return

  var defaultDesc = column ? Boolean(column.modelField.is_numeric) : false
  var active = this.getActiveSorts()

  if (!shiftKey) {
    if (active.length === 1 && active[0].name === colId) {
      this.clientSorts = [{ name: colId, desc: !active[0].desc }]
    } else {
      var existing = active.find(s => s.name === colId)
      this.clientSorts = [{ name: colId, desc: existing ? !existing.desc : defaultDesc }]
    }
  } else {
    var current = active.map(s => ({ ...s }))
    var existing = current.find(s => s.name === colId)
    if (existing) {
      existing.desc = !existing.desc
    } else {
      current.push({ name: colId, desc: defaultDesc })
    }
    this.clientSorts = current
  }

  this.sortData()
  this.sortColumns()
}

/**
 * Sorts columns by config option
 */
export function sortColumns () {
  this.columns.sort(this.compareSortArrays(this))
}

export function transposeDimensionsIntoHeaders () {
  this.transposed_headers = this.columns
    .filter(c => c.modelField.type === 'dimension')
    .filter(c => !c.hide)
    .map(c => { return { type: 'field', modelField: c.modelField } })
}

/**
 * For rendering a transposed table i.e. with the list of measures on the left hand side
 * 1. Add an index column per header
 * 2. Add a transposed column for every data row
 */
export function transposeRowsIntoColumns () {
  // TODO: review logic for cell.align
  var index_parent = {
    align: 'left',
    type: 'transposed_table_index',
    is_table_calculation: false
  }

  // One "index column" per header row from original table
  this.headers.forEach((indexColumn, i) => {
    var transposedColumn = new Column(indexColumn.type, this, index_parent)

    this.transposed_headers.forEach((header, h) => {
      var sourceCell = this.columns[h].levels[i]
      var headerCell = new HeaderCell({
        column: transposedColumn,
        type: sourceCell.type,
        label: sourceCell.label,
        cell_style: sourceCell.cell_style,
        align: sourceCell.align,
        modelField: sourceCell.modelField
      })
      headerCell.rowspan = sourceCell.colspan
      headerCell.colspan = sourceCell.rowspan
      headerCell.id = [sourceCell.modelField.name, sourceCell.type].join('.')
      headerCell.cell_style.push('transposed')

      if (headerCell.colspan > 0) {
        headerCell.cell_style.push('merged')
      }

      transposedColumn.levels.push(headerCell)
    })

    this.transposed_columns.push(transposedColumn)
  })
  
  var measure_parent = {
    align: 'right',
    type: 'transposed_table_measure',
    is_table_calculation: false
  }

  // One column per data row (line items, subtotals, totals)
  this.data.forEach(sourceRow => {
    var transposedColumn = new Column(sourceRow.id, this, measure_parent)

    this.transposed_headers.forEach(header => {
      var cellRef = this.useIndexColumn && ['subtotal', 'total'].includes(sourceRow.type) ? INDEX_COLUMN : header.modelField.name
      var sourceCell = sourceRow.data[cellRef]
      var headerCell = new HeaderCell({ 
        column: transposedColumn, 
        type: header.type, 
        label: sourceCell.rendered === '' ? sourceCell.rendered : sourceCell.rendered || sourceCell.value, 
        align: 'center',
        cell_style: sourceCell.cell_style,
      })
      headerCell.colspan = sourceCell.rowspan
      headerCell.rowspan = sourceCell.colspan
      headerCell.id = [sourceCell.colid, sourceCell.rowid].join('.')
      headerCell.cell_style.push('transposed')

      transposedColumn.levels.push(headerCell)
    })

    this.transposed_columns.push(transposedColumn)
  })
}

export function transposeColumnsIntoRows () { 
  this.columns.filter(c => c.modelField.type === 'measure').forEach(column => {
    var transposedData = {}

    // INDEX FIELDS // every index/dimension column in original table must be represented as a data cell in the new transposed rows
    column.levels.forEach((level, i) => {        
      var cell = new DataCell({
        value: level.label,
        rendered: level.label,
        rowspan: level.colspan,
        colspan: level.rowspan,
        cell_style: ['indexCell', 'transposed'],
        align: 'left',
        colid: column.id,
        rowid: level.type
      })

      switch (level.type) {
        case 'pivot0':
        case 'pivot1':
          cell.cell_style.push('pivot')
          break
        case 'heading':
        case 'field':
          var style = column.modelField.is_table_calculation ? 'calculation' : 'measure'
          cell.cell_style.push(style)
          break
      }

      if (cell.rowspan > 1) {
        cell.cell_style.push('merged')
      }

      transposedData[level.type] = cell
    })

    // MEASURE FIELDS // every measure column in original table is converted to a data row
    this.data.forEach(row => {
      if (typeof row.data[column.id] !== 'undefined') {
        var sourceCell = row.data[column.id]
        transposedData[row.id] = row.data[column.id]
        transposedData[row.id].id = [sourceCell.colid, sourceCell.rowid].join('.')
        transposedData[row.id]['cell_style'].push('transposed')
      } else {
        // console.log('row data does not exist for', column.id)
      }
    })

    var transposed_row = new Row('line_item')
    transposed_row.id = column.id
    transposed_row.modelField = column.modelField
    transposed_row.hide = column.hide
    transposed_row.data = transposedData

    this.transposed_data.push(transposed_row)

  })
}

export function getCellToolTip (rowid, colid) {
  var tipHTML = '<table><tbody>'

  var row = this.getRowById(rowid)
  var focusColumn = this.getColumnById(colid) 
  var field = focusColumn.modelField 

  if (row.type === 'total') {
    var label = 'TOTAL'
    var value = ''
    var rowClass = 'focus'
    tipHTML += ['<tr class="', rowClass, '"><td><span style="float:left"><em>', label, ':</em></td><td></span><span style="float:left"> ', value, '</span></td></tr>'].join('')
  } else if (row.id.startsWith('Others')) {
    var label = 'Others'
    var value = ''
    var rowClass = 'focus'
    tipHTML += ['<tr class="', rowClass, '"><td><span style="float:left"><em>', label, ':</em></td><td></span><span style="float:left"> ', value, '</span></td></tr>'].join('')      
  } else if (row.type === 'subtotal') {
    var label = 'SUBTOTAL'
    var rowClass = 'focus'
    var subtotalColumn = this.columns.filter(c => !c.hide).filter(c => c.modelField.type === 'dimension')[0]
    var value = row.data[subtotalColumn.id].render || row.data[subtotalColumn.id].value
    tipHTML += ['<tr class="', rowClass, '"><td><span style="float:left"><em>', label, ':</em></td><td></span><span style="float:left"> ', value, '</span></td></tr>'].join('')
  } else {
    var dimensionColumns = this.columns
    .filter(c => c.id !== INDEX_COLUMN)
    .filter(c => c.modelField.type === 'dimension')

    dimensionColumns.forEach(column => {
      var label = column.getHeaderCellLabelByType('field')
      var value = row.data[column.id].rendered || row.data[column.id].value
      var rowClass = column.id === focusColumn.id ? 'focus' : ''
      tipHTML += ['<tr class="', rowClass, '"><td><span style="float:left"><em>', label, ':</em></td><td></span><span style="float:left"> ', value, '</span></td></tr>'].join('')
    })
  }

  tipHTML += '<tr style="height:10px"></tr>' // spacer row

  var isEstimate = false
  var measureLabel = ''
  var measureColumns = this.columns
    .filter(c => c.modelField.type === 'measure')
    .filter(c => c.modelField === field)
  
  measureColumns.forEach(column => {
    if (!column.isVariance) {
      measureLabel = column.getHeaderCellLabelByType('field')
    }

    if ((!column.pivoted && !column.isRowTotal) || (column.pivot_key === focusColumn.pivot_key)) {
      var label = column.getHeaderCellLabelByType('field')
      var rowClass = column.id === focusColumn.id ? 'focus' : ''
      
      var cell = row.data[column.id]
      var value = cell.rendered || cell.value
      if (cell.html) { 
        var parser = new DOMParser()
        var parsed_html = parser.parseFromString(cell.html, 'text/html')
        value = parsed_html.documentElement.textContent
      }

      if (cell.cell_style.includes('estimate')) {
        isEstimate = true
      }

      tipHTML += ['<tr class="', rowClass, '"><td><span style="float:left"><em>', label, ':</em></td><td></span><span style="float:right"> ', value, '</span></td></tr>'].join('')
    }
  })

  var isReportedIn = null
  var reportInSetting = this.config['reportIn|' + focusColumn.modelField.name]
  var reportInLabels = {
    1000: '000s',
    1000000: 'Millions',
    1000000000: 'Billions'
  }
  if (typeof reportInSetting !== 'undefined'  && reportInSetting !== '1') {
    isReportedIn = measureLabel + ' reported in ' + reportInLabels[reportInSetting]
  }

  if (isReportedIn || isEstimate) {
    tipHTML += '<tr style="height:10px"></tr>' // spacer row
  }

  if (isReportedIn) {
    tipHTML += '<tr><td colspan=2><span style="color:darkgrey">' + isReportedIn + '.</span></td></tr>'
  }

  if (isEstimate) {
    tipHTML += '<tr><td colspan=2><span style="color:red">Estimated figure due to query exceeding row limit.</span></td></tr>'
    tipHTML += '<tr><td colspan=2><span style="color:red">Consider increasing the row limit or using an alternative measure.</span></td></tr>'
  }

  tipHTML += '</tbody><table>'

  return tipHTML
}
