const path = require("path");
const VueLoaderPlugin = require("vue-loader/lib/plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const webpack = require("webpack");

const DEV_MODE = process.argv.includes("webpack/webpack.dev.js");

module.exports = {
  target: "web", // NOTE: Hot module reloading via vue-loader breaks without this, even though it is supposed to be the default.
  experiments: {
    syncWebAssembly: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["vue-style-loader", "css-loader"],
      },
      {
        test: /\.vue$/,
        loader: "vue-loader",
      },
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules\/(?!(cptv-player-vue)\/).*/,
        options: {
          appendTsSuffixTo: [/\.vue$/],
          transpileOnly: true,
        },
      },
      {
        test: /\.js$/,
        loader: "babel-loader",
        exclude: /node_modules\/(?!(cptv-player-vue|cptv-decoder)\/).*/,
        include: [
          path.resolve(__dirname, "src"),
          /\.js$/,
          require.resolve("bootstrap-vue"),
        ],
        options: {
          compact: !DEV_MODE,
        },
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: "file-loader",
        options: {
          name: "[name].[ext]?[hash]",
        },
      },
      // this will apply to both plain `.scss` files
      // AND `<style lang="scss">` blocks in `.vue` files
      {
        test: /\.scss$/,
        use: ["vue-style-loader", "css-loader", "sass-loader"],
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new CleanWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, "../src/assets/favicon") },
        { from: path.resolve(__dirname, "../src/assets/video") },
        { from: path.resolve(__dirname, "../src/assets/map") },
      ],
    }),
    new ESLintPlugin(),
    new ForkTsCheckerWebpackPlugin(),
    new webpack.DefinePlugin({
      "process.env.BUILD": JSON.stringify("web"),
    }),
  ],
  resolve: {
    fallback: {
      // NOTE: These are needed for h264-mp4-encoder to package properly.
      fs: false,
      module: false,
      path: false,
      crypto: false,
      worker_threads: false,
    },
    alias: {
      vue$: "vue/dist/vue.esm.js",
      "@": path.resolve(__dirname, "../src"),
    },
    extensions: ["*", ".js", ".vue", ".json", ".ts", ".wasm", ".mjs"],
  },
  devServer: {
    historyApiFallback: true,
    noInfo: true,
    overlay: {
      warnings: false,
      errors: true,
    },
  },
  performance: {
    hints: false,
  },
  devtool: "eval-source-map",
};
