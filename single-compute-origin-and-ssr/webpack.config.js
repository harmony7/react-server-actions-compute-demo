"use strict";

import path from 'node:path';
import url from 'node:url';
import webpack from 'webpack';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
import ReactFlightWebpackPlugin from 'react-server-dom-webpack/plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import RscWebpackPlugin from '@h7/compute-js-rsc/webpack-plugin';

const mode = process.env.NODE_ENV || "development";
const development = mode === "development";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseConfig = {
  mode,
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: "babel-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
  output: {
    chunkFilename: development
      ? "[id].chunk.js"
      : "[id].[contenthash].chunk.js",
    publicPath: '/client/',
    filename: "[name].js",
    clean: true,
    library: {
      type: "module"
    },
  },
  plugins: [
    // Generates `entrypoint-manifest.json` to be used during bootstrapping
    new WebpackManifestPlugin({
      fileName: 'entrypoint-manifest.json',
      generate: (seed, files, entrypoints) => {
        const processedEntrypoints = {};
        for (let key in entrypoints) {
          processedEntrypoints[key] = {
            js: entrypoints[key].filter(
              filename =>
                // Include JS assets but ignore hot updates because they're not
                // safe to include as async script tags.
                filename.endsWith('.js') &&
                !filename.endsWith('.hot-update.js')
            ),
            css: entrypoints[key].filter(filename =>
              filename.endsWith('.css')
            ),
          };
        }
        return processedEntrypoints;
      },
    }),
  ],
  devtool: development ? "cheap-module-source-map" : "source-map",
};

// == "ORIGIN" BUNDLE ==
// originBundle:
//   This is based on react-server-dom-webpack/server and runs on the origin
//   This is not needed if Fastly Compute is not being run as the origin server
const originBundleConfig = {
  ...baseConfig,
  experiments: {
    ...baseConfig.experiments,
    outputModule: true,
  },
  optimization: {
    // We must not mangle export names, because RSC actions are called by name
    mangleExports: false,
  },
  entry: "./src/entry.origin.js",
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: '@h7/compute-js-rsc/webpack-loader',
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      ...baseConfig.module.rules,
    ],
  },
  resolve: {
    ...baseConfig.resolve,
    conditionNames: [
      ...baseConfig.conditionNames ?? ['...'],
      'react-server',
      'edge-light',
    ],
  },
  plugins: [
    // Emits the react-server-manifest.json file
    new RscWebpackPlugin(),
    // Writes css files
    new MiniCssExtractPlugin({
      filename: 'static/css/[name].[contenthash:8].css',
      chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
    }),
    ...baseConfig.plugins,
  ],
  output: {
    ...baseConfig.output,
    path: path.resolve(__dirname, "build/origin"),
  },
  externals: [
    ({request,}, callback) => {
      // Allow Webpack to handle fastly:* namespaced module imports by treating
      // them as modules rather than try to process them as URLs
      // We only allow this on the origin build ('use server' components)
      if (/^fastly:.*$/.test(request)) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    }
  ],
};

// == "CLIENT" BUNDLES ==
// These are both based on react-server-dom-webpack/client and run ReactFlightWebpackPlugin
// to include the client components in the bundles.
// clientBundle:
//   Served to the browser. Chunked.
// ssrBundle:
//   Run at the edge on Fastly Compute. It's also possible to run a single service as both the
//   SSR and origin roles. If so, bundle separately and import both this bundle and the origin
//   bundle into the edge application.
const baseClientConfig = {
  ...baseConfig,
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['css-loader'],
      },
      ...baseConfig.module.rules,
    ],
  },
  plugins: [
    // react-server-dom-webpack/plugin
    // This adds all 'use client' files recursively under the current directory
    // to the client bundle, and records them to `react-client-manifest.json`
    // and `react-ssr-manifest.json`.
    new ReactFlightWebpackPlugin({
      isServer: false,
    }),
    ...baseConfig.plugins,
  ],
};

const clientBundleConfig = {
  ...baseClientConfig,
  entry: "./src/entry.client.js",
  optimization: {
    runtimeChunk: "single",
  },
  experiments: {
    ...baseClientConfig.experiments,
    // For client bundle we export a script, so no module mode
    outputModule: false,
  },
  output: {
    ...baseClientConfig.output,
    path: path.resolve(__dirname, "build/client"),
    // For the client bundle we're not exposing a library, just a script that runs
    library: undefined,
  },
};

const ssrBundleConfig = {
  ...baseClientConfig,
  entry: [
    // We include ReactFlightDOMClientBrowser here, because this is what
    // ReactFlightWebpackPlugin looks for to attach client components to.
    // Without this, the 'use client' modules wouldn't get added to the bundle.
    'react-server-dom-webpack/client.browser',
    './src/entry.ssr.js',
  ],
  plugins: [
    // We use only one chunk for SSR bundle:
    // * it runs on edge and cannot use `webpack/runtime/load` mechanism
    // * not likely to benefit from chunking anyway
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    ...baseClientConfig.plugins,
  ],
  output: {
    ...baseClientConfig.output,
    path: path.resolve(__dirname, "build/ssr"),
  },
};

export default [originBundleConfig, clientBundleConfig, ssrBundleConfig];
