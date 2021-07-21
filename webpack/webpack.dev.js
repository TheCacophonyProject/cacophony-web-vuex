const { merge } = require("webpack-merge");
const path = require("path");
const common = require("./webpack.common");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const devConfig = require("../dev-config");
const { GitRevisionPlugin } = require("git-revision-webpack-plugin");
const gitRevisionPlugin = new GitRevisionPlugin({ branch: true });

const distDir = path.resolve(__dirname, "../dist");
module.exports = merge(common, {
  mode: "development",
  entry: { load: "./src/load.js" },
  output: {
    path: distDir,
    publicPath: "/",
    filename: "build.js",
  },
  plugins: [
    new webpack.DefinePlugin({
      __ENV__: JSON.stringify(devConfig.environment),
      __API__: JSON.stringify(devConfig.api),
      __LINZ_API_KEY__: JSON.stringify(devConfig.linzBasemapApiKey || ""),
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
      template: "index.template.ejs",
      inject: "body",
    }),
  ],
  devServer: {
    contentBase: distDir,
    hot: true,
    host: "0.0.0.0",
    disableHostCheck: true,
    stats: {
      minimal: true,
      assets: false,
      modules: false,
      timings: true,
    },
  },
  devtool: "eval-cheap-module-source-map",
});
