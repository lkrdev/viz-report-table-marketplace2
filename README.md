# Report Table for Looker

A table dedicated to single-page, enterprise summary reports. Useful for PDF exports, report packs, finance reporting, etc. Does not do multi-page tables and lists. Does look good for your year-on-year analysis. Originally created by [Jon Walls](https://github.com/ContrastingSounds/vis-report_table).

![Example Report](assets/marketplace_image.png)

## Features

- Quick variance calculations
- Add subtotals (including column subtotals for tables with two levels of pivot)

  - Subtotals taken from Looker subtotals if available, otherwise performed as front-end calculation
- Add a header row to non-pivoted tables
- Organise measure columns by pivot value, or by measure

  - Flat tables (i.e. no pivots) can be organised by drag'n'drop
- Transpose (any number of dimensions)
- Easy red/black conditional format
- "Subtotal" format e.g. for highlighting transposed rows of measures
- Themes, including ability to test custom themes using your own css file
- Use LookML tags to give default abbreviations to popular fields
- Reduce to a single dimension value for financial-style reporting
- Drill-to-detail 

## Recent Updates

- Added an option to freeze the first X columns during horizontal scrolling (fully compatible with transposed tables).
- Added support for dynamic field labels in Looker (such as LookML's `label_from_parameter` or Liquid conditional logic).


## Installation

To install this visualization in your Looker instance, add the following `visualization` parameter to your project's `manifest.lkml` file:

```lookml
visualization: {
  id: "lkrdev-report-table"
  url: "https://cdn.lkr.dev/viz/report-table/latest/report_table.js"
  label: "Report Table"
}
```

For more details on installing custom visualizations in a project with `manifest.lkml` or globally via the Admin panel, refer to the Looker documentation on [developing custom visualizations using a project manifest](https://cloud.google.com/looker/docs/developing-custom-visualizations) or managing [Admin panel visualizations](https://cloud.google.com/looker/docs/admin-panel-visualizations).


## Standalone Usage Outside Looker

You can also use this visualization independently in any non-Looker web app by embedding the compiled `report_table.js` script and calling `window.looker.table()`.

For complete integration instructions, method signatures, and payload data formats, see [standalone.md](standalone.md).



## Examples

*Drag'n'drop columns for flat tables*

![Drag'n'drop columns for flat tables](assets/report_table_01_drag_and_drop.gif)

*Tags in LookML for consistent headers and abbreviations*

![Tags in LookML for consistent headers and abbreviations](assets/report_table_02_auto_headers_and_abbreviations.gif)

*Subtotals and "show last dimension only"*

![Subtotals and last field only](assets/report_table_03_subtotals_and_last_field_only.gif)

*Sort by Pivot or Measure*

![Sort by Pivot or Measure](assets/report_table_04_sort_by_pivot_or_measure.gif)

*Set headers and labels*

![Set headers and labels](assets/report_table_05_change_headers.gif)

*Even width columns or autolayout*

![Even width columns or autolayout](assets/report_table_06_even_width_or_auto_layout.gif)

*Transposing and PnL style reports*

![Transposing and PnL style reports](assets/report_table_07_PnL_transpose_theme.gif)


## Tagging fields in LookML

A common reporting requirement is grouping fields under headings, and abbreviating column headers when many columns are present. This can be repetitive work! The Report Table vis will pick up tags in the LookML model, with the format `"vis-tools:SETTING:VALUE"`.

The current tag settings available are `heading`, `short_name`, `unit`.

    measure: number_of_transactions {
      tags: [
        "vis-tools:heading:Transaction Value",
        "vis-tools:short_name:Volume",
        "vis-tools:unit:#"
      ]
      type: count
      value_format_name: decimal_0
      drill_fields: [transaction_details*]
    }

## Notes

- Maximum of two pivot fields
- Subtotals calculated at the front end are only for simple sums & averages
  - e.g. no Count Distincts, running totals, measures of type "number" with arbitrary calculations
  - The vis will use subtotals from the query response if available
  - The tooltip will alert users to "estimated" numbers

## Using Custom CSS 

You can apply your own custom styling by supplying a URL to a CSS file in the `Load custom CSS from:` option and selecting `Use custom theme` in the `Theme` tab.

![Theme selector](/assets/custom_theme.png)

Please use [this example template](src/theme_custom_template.css) to help you get started with your customization.

### Custom Styling Examples

#### 1. High-Contrast Dark Mode
```css
/* Invert table styling for sleek, premium dark dashboards */
.reportTable {
  background-color: #1a1a1a;
  color: #f5f5f5;
  border: 1px solid #333333;
}
.reportTable th {
  background-color: #242424;
  color: #ffffff;
  border-bottom: 2px solid #64b5f6 !important;
}
.reportTable td {
  color: #e0e0e0;
  border: 1px solid #2a2a2a;
}
.subtotal {
  background: #2d2d2d;
  color: #81c784;
}
/* Style the hover tooltip/popover for dark mode */
#tooltip {
  background-color: #242424;
  border: 1px solid #444444;
  border-radius: 6px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
  color: #f5f5f5;
}
```

#### 2. Corporate Card Premium Layout
```css
/* Remove harsh borders and introduce subtle drop shadows and professional gradient headers */
.reportTable {
  font-family: 'Inter', Roboto, sans-serif;
  border: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  border-radius: 6px;
  overflow: hidden;
}
.reportTable th {
  background: linear-gradient(90deg, #1A365D 0%, #2B6CB0 100%);
  color: #ffffff;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.5px;
}
/* Premium modern tooltip/popover styling */
#tooltip {
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  padding: 8px 12px;
  color: #1a202c;
  font-weight: 500;
}
```

#### 3. Grouped & Pivoted Column Targeting
```css
/* Style alternating grouped/pivoted column groups (e.g. QTD vs YTD) */
#reportTable td.pivot-group-even,
#reportTable th.pivot-group-even {
  background-color: #ececec;
}
#reportTable td.pivot-group-odd,
#reportTable th.pivot-group-odd {
  background-color: #ffffff;
}

/* Or target a specific pivot group index directly (e.g., pivot group 0) */
#reportTable .pivot-group-0 {
  border-left: 2px solid #006B9B;
}
```

#### 4. Targeting the Last X Rows
```css
/* Highlight the last 4 rows in the table (e.g. summary / grand total rows) */
#reportTable tbody tr:nth-last-child(-n+4) td {
  background-color: #f0f0f0 !important;
  font-weight: bold;
}
```

#### 5. Alternating Row Shading (Zebra Striping)
```css
/* Apply alternating row backgrounds to body rows */
#reportTable tbody tr:nth-child(even) td {
  background-color: #f8f9fa;
}
#reportTable tbody tr:nth-child(odd) td {
  background-color: #ffffff;
}
```

#### 6. Top-Aligning Table Cell Content
```css
/* Align table header and data cell text to the top across all cells */
.reportTable th,
.reportTable td {
  vertical-align: top;
}
```


### Hosting Your Custom CSS Simple & Free

To load external CSS into Looker, the stylesheet must be served over HTTPS with permissive **CORS** (`Access-Control-Allow-Origin: *`) and a `Content-Type: text/css` header. 

> [!WARNING]
> **Raw GitHub/Gist Links Will Fail**: Direct links like `https://gist.githubusercontent.com/...` fail because GitHub enforces `X-Content-Type-Options: nosniff` with a `text/plain` MIME type. You **must** pass the link through a proxy like Githack or jsDelivr.

Here are the most reliable ways to host your CSS instantly:

1. **Githack ([raw.githack.com](https://raw.githack.com/)) for GitHub & Gists**
   * **For a Gist**: Create a free [GitHub Gist](https://gist.github.com/) with your `.css` file. Copy the raw URL (`https://gist.githubusercontent.com/...`) and paste it into [raw.githack.com](https://raw.githack.com/) (which converts it to `gist.githack.com/...`).
   * **For a GitHub Repo**: Commit your `.css` file to any public GitHub repository. Copy its raw URL (`https://raw.githubusercontent.com/...`) and paste it into [raw.githack.com](https://raw.githack.com/) (which converts it to `raw.githack.com/...`).

2. **Google Cloud Storage (Enterprise Standard)**
   * Upload your stylesheet to a public GCS bucket.
   * Ensure `allUsers` has `Storage Object Viewer` access and configure your bucket's CORS policy to allow `*` origins. Link via `https://storage.googleapis.com/YOUR_BUCKET/theme.css`.



## What if I find an error? Suggestions for improvements?
Great! Marketplace content -- including visualizations -- were designed for continuous improvement through the help of the entire Looker community and we'd love your input. To report an error or improvement recommendation, please get in touch at help.looker.com to submit a request. Please be as detailed as possible in your explanation and we'll address it as quick as we can.


### Interested in extending the visualization for your own use case?
#### Quickstart Dev Instructions
1.  **Install Dependecies.**

    Using yarn, install all dependencies
    ```
    yarn install
    ```
2. **Make changes to the source code**

3.  **Compile your code**

    You need to bundle your code, let's run:
    ```
    yarn build
    ```
    Recommended: Webpack can detect changes and build automatically
     ```
    yarn watch
    ```
    Your compiled code can be found in this repo.

**`./report_table.js`**: This visualization's minified distribution file. 

**`LICENSE`**: Looker's Marketplace content License file.

**`manifest.lkml`**: Looker's external dependencies configuration file. The visualization object is defined here.

**`marketplace.json`**: A JSON file containing information the marketplace installer uses to set up this project.

**`/src`**: This directory will contain all of the visualization's source code.

**`/src/report_table.js`**: The main source code for the visualization.

**`/node_modules`**: The directory where all of the modules of code that your project depends on (npm packages) are automatically installed.

**`README.md`**: This! A text file containing useful reference information about this visualization.

**`yarn.lock`**: [Yarn](https://yarnpkg.com/) is a package manager alternative to npm. This file serves essentially the same purpose as `package-lock.json`, just for a different package management system.

