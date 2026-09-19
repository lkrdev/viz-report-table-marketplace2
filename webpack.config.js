const path = require('path');

const sharedModuleRules = [
  {
    test: /\.(ts|tsx|js|jsx)$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: [
          ['@babel/preset-env', { targets: 'defaults' }],
          '@babel/preset-react',
          '@babel/preset-typescript',
        ],
      },
    },
  },
  {
    test: /\.css$/i,
    use: [
      { loader: 'style-loader', options: { injectType: 'lazyStyleTag' } },
      'css-loader',
    ],
  },
  {
    test: /\.(woff|woff2|ttf|otf)$/,
    loader: 'url-loader',
  },
];

const sharedResolve = {
  extensions: ['.tsx', '.ts', '.js', '.jsx'],
  alias: {
    'report-table-js': path.resolve(__dirname, 'src/report_table.js'),
    'report-table-react': path.resolve(__dirname, 'packages/report-table-react/index.tsx'),
  },
  fallback: {
    buffer: false,
  },
};

module.exports = [
  {
    name: 'report-table-js',
    entry: path.resolve(__dirname, 'packages/report-table-js/index.js'),
    output: {
      filename: 'report_table.js',
      path: path.resolve(__dirname, 'dist'),
    },
    devtool: 'source-map',
    resolve: sharedResolve,
    module: {
      rules: sharedModuleRules,
    },
    devServer: {
      allowedHosts: 'all',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
      },
    },
  },
  {
    name: 'report-table-react',
    entry: path.resolve(__dirname, 'packages/report-table-react/vis_react_plugin.tsx'),
    output: {
      filename: 'report_table_react.js',
      path: path.resolve(__dirname, 'dist'),
    },
    devtool: 'source-map',
    resolve: sharedResolve,
    module: {
      rules: sharedModuleRules,
    },
  },
  {
    name: 'report-table-extension',
    entry: path.resolve(__dirname, 'packages/report-table-extension/index.tsx'),
    output: {
      filename: 'report_table_extension.js',
      path: path.resolve(__dirname, 'dist'),
    },
    devtool: 'source-map',
    resolve: sharedResolve,
    module: {
      rules: sharedModuleRules,
    },
  },
];
