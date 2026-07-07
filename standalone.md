# Standalone Usage (Outside Looker)

The Report Table visualization can be loaded and rendered independently in any standard web application (React, Vue, Angular, or Vanilla JS) without requiring Looker.

---

## 1. Quickstart

Include the built `report_table.js` script tag or load it into your web application, then call `window.looker.table()`:

```html
<script src="path/to/report_table.js"></script>

<div id="table-container" style="width: 100%; height: 600px;"></div>

<script>
  window.looker.table('#table-container', {
    queryResponse: {
      fields: {
        dimensions: [{ name: 'category', label: 'Category' }],
        measures: [{ name: 'sales', label: 'Total Sales' }],
        pivots: []
      }
    },
    data: [
      {
        category: { value: 'Apparel' },
        sales: { value: 45000, rendered: '$45,000' }
      }
    ],
    config: {
      theme: 'contemporary',
      bodyFontSize: 12,
      headerFontSize: 12,
      showHighlight: true
    }
  });
</script>
```

---

## 2. API Signatures & Instance Methods

```javascript
// Render table & obtain instance handle
const tableInstance = window.looker.table('#table-container', options);

// 1. Get Excel data URL string (data:application/vnd.ms-excel,...)
const excelDataUrl = tableInstance.asExcel();

// 2. Trigger browser download directly
tableInstance.downloadExcel('financial-report.xls');
```

### Options Breakdown

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `element` | `HTMLElement \| string` | Yes | Target DOM node or selector string (e.g. `'#my-table'`). |
| `queryResponse` | `Object` | Yes | Column metadata definition schema (`dimensions`, `measures`, `pivots`). |
| `data` | `Array<Object>` | Yes | Array of row objects. |
| `config` | `Object` | No | Display & layout settings (`theme`, font sizes, subtotals, etc.). |
| `details` | `Object` | No | Additional context details if needed. |
| `done` | `Function` | No | Callback function triggered after rendering completes. |

---

## 3. Input Data Payload Formats

### `queryResponse` Schema
Defines the columns and field types:

```json
{
  "fields": {
    "dimensions": [
      {
        "name": "products.category",
        "label": "Category",
        "is_numeric": false
      }
    ],
    "measures": [
      {
        "name": "orders.total_amount",
        "label": "Total Sales",
        "is_numeric": true
      }
    ],
    "pivots": []
  }
}
```

### `data` Row Structures

#### Flat Table (No Pivots)
```json
[
  {
    "products.category": { "value": "Apparel" },
    "orders.total_amount": { "value": 45000, "rendered": "$45,000" }
  },
  {
    "products.category": { "value": "Electronics" },
    "orders.total_amount": { "value": 120000, "rendered": "$120,000" }
  }
]
```

#### Pivoted Table
When `queryResponse.fields.pivots` contains pivot fields, measure values map to objects keyed by pivot names:

```json
[
  {
    "products.category": { "value": "Apparel" },
    "orders.total_amount": {
      "2025": { "value": 20000, "rendered": "$20,000" },
      "2026": { "value": 25000, "rendered": "$25,000" }
    }
  }
]
```

---

## 4. Complete Configuration Options Reference (`config`)

All available configuration options categorized by section:

### Theme & Styling
| Option | Type | Values / Default | Description |
| :--- | :--- | :--- | :--- |
| `theme` | `string` | `'traditional'` (default), `'looker'`, `'contemporary'`, `'custom'` | Table color theme |
| `customTheme` | `string` | `""` (default) | URL to custom CSS file (used when `theme: "custom"`) |
| `layout` | `string` | `'fixed'` (default), `'auto'` | Column width distribution layout |
| `minWidthForIndexColumns` | `boolean` | `true` (default) | Automatic min-width on index/dimension columns |
| `headerFontSize` | `number` | `12` (default) | Font size (px) for header cells |
| `bodyFontSize` | `number` | `12` (default) | Font size (px) for body cells |
| `showHighlight` | `boolean` | `true` (default) | Highlight row on hover |
| `showTooltip` | `boolean` | `true` (default) | Show tooltip on hover |

#### Using External Custom CSS
Setting `theme: 'custom'` and providing a URL in `customTheme` automatically injects a `<link rel="stylesheet">` into `<head>`:

```javascript
window.looker.table('#table-container', {
  queryResponse,
  data,
  config: {
    theme: 'custom',
    customTheme: 'https://cdn.example.com/custom-theme.css'
  }
});
```
* **Browser Excel Export (`asExcel()`)**: Inlines the computed styles from the external CSS stylesheet onto every exported table cell (`<td>`, `<th>`).
* **CORS Requirement**: External CSS URLs must serve Permissive CORS headers (`Access-Control-Allow-Origin: *`) when loaded cross-origin.


### Table & Layout
| Option | Type | Values / Default | Description |
| :--- | :--- | :--- | :--- |
| `rowSubtotals` | `boolean` | `false` (default) | Calculate and show row subtotals |
| `colSubtotals` | `boolean` | `false` (default) | Calculate and show column subtotals |
| `collapsedSubtotals` | `string` | `""` | Comma-separated keys of subtotals to collapse |
| `startFolded` | `boolean` | `false` (default) | Collapse all subtotals initially |
| `genericLabelForSubtotals` | `boolean` | `false` (default) | Label all subtotal rows as `'Subtotal'` |
| `spanRows` | `boolean` | `true` (default) | Merge duplicate dimension values vertically |
| `spanCols` | `boolean` | `true` (default) | Merge duplicate header labels horizontally |
| `transposeTable` | `boolean` | `false` (default) | Transpose rows and columns |
| `sortColumnsBy` | `string` | `'pivots'` (default), `'measures'` | Column sorting order for pivoted tables |
| `groupVarianceColumns` | `boolean` | `false` (default) | Group variance calculation columns |
| `freezeFirstColumns` | `number` | `0` (default) | Number of left columns to freeze when scrolling horizontally |
| `freezeTableHeaders` | `boolean` | `false` (default) | Freeze table header rows during vertical scroll |
| `exposeDownloadLink` | `boolean` | `false` (default) | Render an Excel download icon button above table |

### Field Labels & Formatting
| Option | Type | Values / Default | Description |
| :--- | :--- | :--- | :--- |
| `indexColumn` | `boolean` | `false` (default) | Use last field only for dimension hierarchy |
| `useViewName` | `boolean` | `false` (default) | Include view name prefix in column headers |
| `useHeadings` | `boolean` | `false` (default) | Group fields under headings (from LookML tags) |
| `useShortName` | `boolean` | `false` (default) | Use short names (from LookML tags) |
| `useUnit` | `boolean` | `false` (default) | Display unit annotations (from LookML tags) |

---

## 5. Node.js Server-Side Usage (via JSDOM)

Because the rendering engine uses DOM and D3 manipulation, run it inside a headless DOM environment (`jsdom`) when generating server-side HTML or PDFs in Node.js:

```javascript
const { JSDOM } = require('jsdom');

// 1. Initialize headless DOM
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="table-container"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// 2. Import compiled bundle
require('./dist/report_table.js');

// 3. Render visualization into virtual DOM
window.looker.table('#table-container', {
  queryResponse: {
    fields: {
      dimensions: [{ name: 'category', label: 'Category' }],
      measures: [{ name: 'sales', label: 'Total Sales' }]
    }
  },
  data: [
    {
      category: { value: 'Apparel' },
      sales: { value: 45000, rendered: '$45,000' }
    }
  ],
  config: { theme: 'traditional' }
});

// 4. Extract generated HTML output
const htmlOutput = dom.window.document.querySelector('#table-container').innerHTML;
console.log(htmlOutput);
```


