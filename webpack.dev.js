const path = require("path");
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "development",
  devtool: "inline-source-map",
  devServer: {
    static: "dist",
    port: 3001,
    open: true,
    hot: true,
    server: "https",
  },
});
