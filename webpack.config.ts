import { resolve } from "path"
import type { Configuration } from "webpack"

const config: Configuration = {
  mode: "production",
  parallelism: 10,
  output: {
    filename: "app_[fullhash:8].js",
    clean: true,
    path: resolve(__dirname, "dist")
  },
  entry: {
    app: {
      import: resolve(__dirname, "./src/bin/index.ts"),
    }
  },
  resolve: {
    alias: {
      "@*": resolve(__dirname, "src/*")
    },
    extensions: [".ts"]
  },
  module: {
    rules: [
      { test: /\.ts$/, use: 'ts-loader' }
    ]
  }
}

export default config