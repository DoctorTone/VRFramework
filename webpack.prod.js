const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = merge(common, {
  mode: "production",
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./depends/libs/draco", to: "./libs/draco" },
        { from: "./depends/models", to: "./models" },
        { from: "./depends/textures", to: "./textures" },
      ],
    }),
  ],
});
