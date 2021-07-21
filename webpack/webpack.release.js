const { merge } = require("webpack-merge");
const path = require("path");
const common = require("./webpack.common");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const { GitRevisionPlugin } = require("git-revision-webpack-plugin");
const gitRevisionPlugin = new GitRevisionPlugin({ branch: true });

module.exports = merge(common, {
  mode: "production",
  devtool: "source-map",
  entry: {
    prod: "./src/load.js",
    staging: "./src/load_staging.js",
  },
  output: {
    path: path.resolve(__dirname, "../dist"),
    publicPath: "/",
    filename: "[name].[contenthash].bundle.js",
  },
  plugins: [
    new webpack.LoaderOptionsPlugin({
      minimize: true,
    }),
    new webpack.DefinePlugin({
      __ENV__: JSON.stringify("PRODUCTION"),
      __API__: JSON.stringify("https://api.cacophony.org.nz"),
      __LINZ_API_KEY__: JSON.stringify(process.env.LINZ_BASEMAP_API_KEY || ""),
      __ENV_STAGING__: JSON.stringify("STAGING"),
      __API_STAGING__: JSON.stringify("https://api-test.cacophony.org.nz"),
      __VERSION__: JSON.stringify(gitRevisionPlugin.version()),
      __COMMIT_HASH__: JSON.stringify(gitRevisionPlugin.commithash()),
      __BRANCH__: JSON.stringify(gitRevisionPlugin.branch()),
      __LAST_COMMIT_DATETIME__: JSON.stringify(
        gitRevisionPlugin.lastcommitdatetime()
      ),

      __TRAVIS_TAG__: JSON.stringify(process.env.TRAVIS_TAG || ""),
      __TRAVIS_BRANCH__: JSON.stringify(process.env.TRAVIS_BRANCH || ""),
      __TRAVIS_BUILD_WEB_URL__: JSON.stringify(
        process.env.TRAVIS_BUILD_WEB_URL || ""
      ),
      __TRAVIS_COMMIT__: JSON.stringify(process.env.TRAVIS_COMMIT || ""),
      __TRAVIS_COMMIT_RANGE__: JSON.stringify(
        process.env.TRAVIS_COMMIT_RANGE || ""
      ),
      __TRAVIS_COMMIT_MESSAGE__: JSON.stringify(
        process.env.TRAVIS_COMMIT_MESSAGE || ""
      ),
      __TRAVIS_REPO_SLUG__: JSON.stringify(process.env.TRAVIS_REPO_SLUG || ""),
    }),
    new HtmlWebpackPlugin({
      filename: "index-prod.html",
      template: "index.template.ejs",
      excludeChunks: ["staging"],
      inject: "body",
    }),
    new HtmlWebpackPlugin({
      filename: "index-staging.html",
      template: "index.template.ejs",
      excludeChunks: ["prod"],
      inject: "body",
    }),
    new BundleAnalyzerPlugin({
      openAnalyzer: !process.env["IS_CI_ENV"],
      analyzerMode: process.env["IS_CI_ENV"] ? "disabled" : "server",
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: "all",
    },
  },
});
