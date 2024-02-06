"use strict";

const webpack = require("webpack");

const path = require("node:path");
const { ReactFlightWebpackServerPlugin } = require("@h7/react-flight-webpack-tools");
const ReactServerWebpackPlugin = require("react-server-dom-webpack/plugin");

const mode = process.env.NODE_ENV || "development";
const development = mode === "development";

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

const backendConfig = {
  ...baseConfig,
  entry: "./src/entry.backend.js",
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: "@h7/react-flight-webpack-tools/loader"
      },
      ...baseConfig.module.rules,
    ],
  },
  resolve: {
    ...baseConfig.resolve,
    conditionNames: ['react-server', 'edge-light'],
  },
  plugins: [
    new ReactFlightWebpackServerPlugin(),
  ],
  output: {
    ...baseConfig.output,
    path: path.resolve(__dirname, "build/backend"),
    library: {
      type: "this"
    },
  }
};

const baseClientConfig = {
  ...baseConfig,
  plugins: [
    new ReactServerWebpackPlugin({
      isServer: false,
    }),
  ],
};

const clientConfig = {
  ...baseClientConfig,
  entry: "./src/entry.client.js",
  optimization: {
    runtimeChunk: "single",
  },
  output: {
    ...baseClientConfig.output,
    path: path.resolve(__dirname, "build/client"),
  }
};

const edgeConfig = {
  ...baseClientConfig,
  entry: "./src/entry.edge.js",
  plugins: [
    ...baseClientConfig.plugins,
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
  output: {
    ...baseClientConfig.output,
    path: path.resolve(__dirname, "build/edge"),
    library: {
      type: "this"
    },
  },
};

module.exports = [backendConfig, clientConfig, edgeConfig];
