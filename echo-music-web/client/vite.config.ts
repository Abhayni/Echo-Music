import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL("..", import.meta.url));
  const env = loadEnv(mode, envDir, ["PORT", "VITE_PORT"]);
  const apiPort = process.env.PORT?.trim() || env.PORT || "8787";
  const webPort = process.env.VITE_PORT?.trim() || env.VITE_PORT || "5173";

  return {
    envDir,
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: Number(webPort),
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
