const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x))

export const tableModelCoreOptions = {
  theme: {
    section: "Theme",
    type: "string",
    display: "select",
    label: "Theme",
    values: [
      { 'Traditional': 'traditional' },
      { 'Looker': 'looker' },
      { 'Contemporary': 'contemporary' },
      { 'Use custom theme': 'custom'}
    ],
    default: "traditional",
    order: 1,
  },
  customTheme: {
    section: "Theme",
    type: "string",
    label: "Load custom CSS from:",
    hidden: true,
    default: "",
    order: 2,
  },
  layout: {
    section: "Theme",
    type: "string",
    display: "select",
    label: "Layout",
    values: [
      { 'Even': 'fixed' },
      { 'Auto': 'auto' }
    ],
    default: "fixed",
    order: 3,
  },
  minWidthForIndexColumns: {
    section: 'Theme',
    type: 'boolean',
    label: "Automatic column width on index",
    default: true,
    order: 3.5
  },
  headerFontSize: {
    section: 'Theme',
    type: 'number',
    display_size: 'half',
    label: 'Header Size',
    default: 12,
    order: 4,
  },
  bodyFontSize: {
    section: 'Theme',
    type: 'number',
    display_size: 'half',
    label: 'Body Size',
    default: 12,
    order: 5,
  },
  showTooltip: {
    section: 'Theme',
    type: 'boolean',
    display_size: 'half',
    label: "Show tooltip",
    default: true,
    order: 6
  },
  showHighlight: {
    section: 'Theme',
    type: 'boolean',
    display_size: 'half',
    label: "Show highlight",
    default: true,
    order: 7
  },
  allowUserEdits: {
    section: 'Theme',
    type: 'boolean',
    label: "Allow User Edits",
    default: false,
    order: 8
  },
  allowDimensionOrder: {
    section: 'Theme',
    type: 'boolean',
    display_size: 'half',
    label: "Reorder Dimensions",
    hidden: true,
    default: false,
    order: 8.4
  },
  allowMeasureOrder: {
    section: 'Theme',
    type: 'boolean',
    display_size: 'half',
    label: "Reorder Measures",
    hidden: true,
    default: false,
    order: 8.5
  },
  allowUserFilters: {
    section: 'Theme',
    type: 'boolean',
    label: "Save and Apply User Filter State",
    default: false,
    order: 9
  },

  columnOrder: {},
  clientSorts: {},
  
  rowSubtotals: {
    section: "Table",
    type: "boolean",
    label: "Row Subtotals",
    display_size: 'half',
    default: false,
    order: 1,
  },
  colSubtotals: {
    section: "Table",
    type: "boolean",
    label: "Col Subtotals",
    display_size: 'half',
    default: false,
    order: 2,
  },
  allowSubtotalToggle: {
    section: "Table",
    type: "boolean",
    label: "Allow Subtotal Toggle",
    hidden: true,
    default: false,
    order: 2.1,
  },
  subtotalStyle: {
    section: "Table",
    type: "string",
    label: "Subtotal Style",
    display: "select",
    values: [
      { 'Simple': 'simple' },
      { 'Collapsed': 'collapsed' }
    ],
    hidden: true,
    default: "simple",
    order: 2.3,
  },
  subtotalsOnTop: {
    section: "Table",
    type: "boolean",
    label: "Subtotals on Top",
    hidden: true,
    default: false,
    order: 2.4,
  },
  genericLabelForSubtotals: {
    section: 'Table',
    type: 'boolean',
    label: "Label all subtotal rows as 'Subtotal'",
    hidden: true,
    default: false,
    order: 2.5
  },
  arrowStyle: {
    section: "Table",
    type: "string",
    label: "Arrow Style",
    display: "select",
    values: [
      { 'Arrows': 'arrows' },
      { '+/-': 'plus_minus' }
    ],
    hidden: true,
    default: "arrows",
    order: 2.6,
  },
  startFolded: {
    section: "Table",
    type: "boolean",
    label: "Start Collapsed",
    hidden: true,
    default: false,
    order: 2.7
  },
  spanRows: {
    section: "Table",
    type: "boolean",
    label: "Merge Dims",
    display_size: 'half',
    default: true,
    order: 3,
  },
  spanCols: {
    section: "Table",
    type: "boolean",
    label: "Merge Headers",
    display_size: 'half',
    default: true,
    order: 4,
  },
  calculateOthers: {
    section: "Table",
    type: "boolean",
    label: "Calculate Others Row",
    default: true,
    order: 4.5
  },
  sortColumnsBy: {
    section: "Table",
    type: "string",
    display: "select",
    label: "Sort Columns By",
    values: [
      { 'Pivots': 'pivots' },
      { 'Measures': 'measures' }
    ],
    default: "pivots",
    order: 6,
  },
  useViewName: {
    section: "Table",
    type: "boolean",
    label: "Include View Name",
    default: false,
    order: 7,
  },
  useHeadings: {
    section: "Table",
    type: "boolean",
    label: "Use Headings",
    default: false,
    order: 8,
  },
  useShortName: {
    section: "Table",
    type: "boolean",
    label: "Use Short Name (from model tags)",
    default: false,
    order: 9,
  },
  useUnit: {
    section: "Table",
    type: "boolean",
    label: "Use Unit (when reporting in 000s)",
    default: false,
    order: 9.5,
  },
  groupVarianceColumns: {
    section: "Table",
    type: "boolean",
    label: "Group Variance Columns",
    default: false,
    order: 10,
  },
  hideZeroCols: {
    section: "Table",
    type: "boolean",
    label: "Hide Zero Columns",
    default: false,
    order: 13,
  },
  hideNullDimensionCols: {
    section: "Table",
    type: "boolean",
    label: "Hide Null Dimension Columns",
    default: false,
    order: 13.1,
  },
  indexColumn: {
    section: "Dimensions",
    type: "boolean",
    label: "Use Last Field Only",
    default: false,
    order: 0,
  },
  transposeTable: {
    section: "Table",
    type: "boolean",
    label: "Transpose Table",
    default: false,
    order: 100,
  }, 
  exposeDownloadLink: {
    section: "Table",
    type: "boolean",
    label: "Expose Download Link",
    default: false,
    order: 101
  },
  freezeFirstColumns: {
    section: "Table",
    type: "number",
    label: "Freeze first X columns",
    default: 0,
    order: 101.5,
  },
  freezeTableHeaders: {
    section: "Table",
    type: "boolean",
    label: "Freeze table headers",
    default: false,
    order: 101.6,
  },
  collapsedSubtotals: {
    section: "Table",
    type: "string",
    label: "Collapsed Subtotals",
    hidden: true,
    default: "",
    order: 102
  },
  expandSubtotals: {
    section: "Table",
    type: "string",
    hidden: true,
    label: "Expand Subtotals",
    default: "",
    order: 104
  },
  hideSubtotals: {
    section: "Table",
    type: "boolean",
    hidden: true,
    label: "Hide Subtotals",
    default: false,
    order: 105
  },
}

/**
 * Hook to be called by a Looker custom vis, for example:
 *    this.trigger('registerOptions', VisPluginTableModel.getConfigOptions())
 * 
 * Returns a new config object, combining the core options with dynamic options based on available dimensions and measures
 */
export function getConfigOptions() {
  var newOptions = clone(tableModelCoreOptions)
  newOptions.customTheme.hidden = this.config.theme !== 'custom'
  ;['allowDimensionOrder', 'allowMeasureOrder'].forEach(k => { newOptions[k].hidden = !this.config.allowUserEdits })

  var subtotal_options = []
  this.dimensions.forEach((dimension, i) => {
    newOptions['label|' + dimension.name] = {
      section: 'Dimensions',
      type: 'string',
      label: dimension.label,
      default: '',
      placeholder: dimension.label,
      order: i * 10 + 1,
    }

    if (this.useHeadings || dimension.name === this.firstVisibleDimension) {
      newOptions['heading|' + dimension.name] = {
        section: 'Dimensions',
        type: 'string',
        label: this.useHeadings ? 'Heading for ' + dimension.label : 'Heading',
        default: '',
        order: i * 10 + 2,
      }
    }

    newOptions['hide|' + dimension.name] = {
      section: 'Dimensions',
      type: 'boolean',
      label: 'Hide',
      display_size: 'third',
      default: false,
      order: i * 10 + 3,
    }

    if (i < this.dimensions.length - 1) {
      var subtotal_option = {}
      subtotal_option[dimension.label] = (i + 1).toString()
      subtotal_options.push(subtotal_option)
    }
  })
  subtotal_options.push({'(all)': '(all)'})

  const hideSubtotalOptions = !this.config.rowSubtotals
  newOptions['subtotalDepth'] = {
    section: "Table",
    type: "string",
    label: "Sub Total Depth",
    display: 'select',
    values: subtotal_options,
    hidden: hideSubtotalOptions,
    default: "(all)",
    order: 2.2,
  }
  ;['allowSubtotalToggle', 'subtotalStyle', 'subtotalsOnTop', 'genericLabelForSubtotals', 'arrowStyle', 'startFolded'].forEach(k => { newOptions[k].hidden = hideSubtotalOptions })

  this.measures.forEach((measure, i) => {
    newOptions['label|' + measure.name] = {
      section: 'Measures',
      type: 'string',
      label: measure.label,
      default: '',
      placeholder: measure.label,
      order: 100 + i * 10 + 1,
    }

    newOptions['heading|' + measure.name] = {
      section: 'Measures',
      type: 'string',
      label: 'Heading for ' + measure.label,
      default: '',
      order: 100 + i * 10 + 2,
    }

    newOptions['style|' + measure.name] = {
      section: 'Measures',
      type: 'string',
      label: 'Style',
      display: 'select',
      display_size: 'third',
      values: [
        {'Normal': 'normal'},
        {'Black/Red': 'black_red'},
        {'Subtotal': 'subtotal'},
        {'Hidden': 'hide'}
      ],
      default: 'normal',
      order: 100 + i * 10 + 3
    }

    newOptions['reportIn|' + measure.name] = {
      section: 'Measures',
      type: 'string',
      label: 'Report In',
      display: 'select',
      display_size: 'third',
      values: [
        {'Absolute Figures': '1'},
        {'Thousands': '1000'},
        {'Millions': '1000000'},
        {'Billions': '1000000000'}
      ],
      default: '1',
      order: 100 + i * 10 + 3.5
    }

    newOptions['unit|' + measure.name] = {
      section: 'Measures',
      type: 'string',
      label: 'Unit',
      // display: 'select',
      display_size: 'third',
      default: '',
      order: 100 + i * 10 + 3.7
    }

    var comparisonOptions = []
    
    if (measure.can_pivot) {
      var pivotComparisons = []
      this.pivot_fields.forEach((pivot_field, p) => {
        if (this.pivot_fields.length === 1 || p === 1 || this.config.colSubtotals ) {
          var option = {}
          option['By ' + pivot_field.label] = pivot_field.name
          pivotComparisons.push(option)
        }
      })
      comparisonOptions = comparisonOptions.concat(pivotComparisons)
    }

    // measures, row totals and supermeasures
    this.measures.forEach((comparisonMeasure, j) => {
      var includeMeasure = measure.can_pivot === comparisonMeasure.can_pivot
                            || 
                          this.hasRowTotals && !comparisonMeasure.is_table_calculation         
      if (i != j && includeMeasure) {
        var option = {}
        option['Vs. ' + comparisonMeasure.label] = comparisonMeasure.name
        comparisonOptions.push(option)
      }
    })
    comparisonOptions.unshift({ '(none)': 'no_variance'})

    newOptions['comparison|' + measure.name] = {
      section: 'Measures',
      type: 'string',
      label: 'Comparison',
      display: 'select',
      values: comparisonOptions,
      default: 'no_variance',
      order: 100 + i * 10 + 5
    }

    newOptions['switch|' + measure.name] = {
      section: 'Measures',
      type: 'boolean',
      label: 'Switch',
      display_size: 'third',
      default: false,
      order: 100 + i * 10 + 6,
    }

    newOptions['var_num|' + measure.name] = {
      section: 'Measures',
      type: 'boolean',
      label: 'Var #',
      display_size: 'third',
      default: true,
      order: 100 + i * 10 + 7,
    }

    newOptions['var_pct|' + measure.name] = {
      section: 'Measures',
      type: 'boolean',
      label: 'Var %',
      display_size: 'third',
      default: false,
      order: 100 + i * 10 + 8,
    }
  })
  return newOptions
}

export function validateConfig() {
  if (!['traditional', 'looker', 'contemporary', 'custom'].includes(this.config.theme)) {
    this.config.theme = 'traditional'
  }

  if (!['fixed', 'auto'].includes(this.config.layout)) {
    this.config.layout = 'fixed'
  }

  if (typeof this.config.transposeTable === 'undefined') {
    this.config.transposeTable = false
  }

  Object.entries(this.config).forEach(option => {
    if (option[1] === 'false') {
      option[1] = false
    } else if (option[1] === 'true') {
      option[1] = true
    }

    if (option[0].split('|').length === 2) {
      var [field_option, field_name] = option[0].split('|')
      if (['label', 'heading', 'hide', 'style', 'switch', 'var_num', 'var_pct', 'comparison'].includes(field_option)) {
        var keep_option = false
        this.dimensions.forEach(dimension => {
          if (dimension.name === field_name) { keep_option = true }
        })
        this.measures.forEach(measure => {
          if (measure.name === field_name) { keep_option = true }
        })
        if (!keep_option) {
          delete this.config[option[0]]
        } 
      }
    }
  })
}
