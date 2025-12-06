import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  reactStrictMode: true,
  basePath: "/myGame", // GitHub Pages でリポジトリ名付きURLなら設定
  reactCompiler: true,
};

export default nextConfig;
