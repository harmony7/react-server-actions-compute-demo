"use strict";

import webpack from 'webpack';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
import path from 'node:path';
import url from 'node:url';
import RscWebpackPlugin from '@h7/compute-js-rsc/webpack-plugin';
import ReactServerWebpackPlugin from 'react-server-dom-webpack/plugin';

const mode = process.env.NODE_ENV || "development";
const development = mode === "development";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseConfig = {
  mode,
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
    publicPath: '/app/',
    filename: "[name].js",
    clean: true,
  },
  devtool: development ? "cheap-module-source-map" : "source-map",
  externals: [
    ({request,}, callback) => {
      // Allow Webpack to handle fastly:* namespaced module imports by treating
      // them as modules rather than try to process them as URLs
      if (/^fastly:.*$/.test(request)) {
        return callback(null, 'commonjs ' + request);
      }
      callback();
    }
  ],
};

// == "BACKEND" BUNDLE ==
// backendBundle

const backendBundleConfig = {
  ...baseConfig,
  experiments: {
    ...baseConfig.experiments,
    outputModule: true,
  },
  entry: "./src/entry.backend.js",
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: '@h7/compute-js-rsc/webpack-loader'
      },
      ...baseConfig.module.rules,
    ],
  },
  resolve: {
    ...baseConfig.resolve,
    conditionNames: ['react-server', 'edge-light'],
  },
  plugins: [
    new RscWebpackPlugin(),
  ],
  output: {
    ...baseConfig.output,
    path: path.resolve(__dirname, "build/backend"),
    library: {
      type: "module"
    },
  }
};

// == "CLIENT" BUNDLES ==
// There are two bundles here:
// clientBundle and ssrBundle

const baseClientConfig = {
  ...baseConfig,
  plugins: [
    new ReactServerWebpackPlugin({
      isServer: false,
    }),
  ],
};

const clientBundleConfig = {
  ...baseClientConfig,
  entry: "./src/entry.client.js",
  optimization: {
    runtimeChunk: "single",
  },
  output: {
    ...baseClientConfig.output,
    path: path.resolve(__dirname, "build/client"),
  },
  plugins: [
    ...baseClientConfig.plugins,
    // Generate a manifest containing the required script / css for each entry.
    new WebpackManifestPlugin({
      fileName: 'entrypoint-manifest.json',
      // publicPath: paths.publicUrlOrPath,
      generate: (seed, files, entrypoints) => {
        const entrypointFiles = entrypoints.main.filter(
          fileName => !fileName.endsWith('.map')
        );

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
};

const ssrBundleConfig = {
  ...baseClientConfig,
  experiments: {
    ...baseClientConfig.experiments,
    outputModule: true,
  },
  entry: "./src/entry.ssr.js",
  plugins: [
    ...baseClientConfig.plugins,
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
  output: {
    ...baseClientConfig.output,
    path: path.resolve(__dirname, "build/ssr"),
    library: {
      type: "module"
    },
  },
};

export default [backendBundleConfig, clientBundleConfig, ssrBundleConfig];
