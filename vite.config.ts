import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const repositoryName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "training-app";

export default defineConfig(({ command }) => {
  const base = command === "build" ? `/${repositoryName}/` : "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg"],
        manifest: {
          id: base,
          name: "Training App",
          short_name: "Training",
          description:
            "Offline-ready training plans with exercise notes and completion tracking.",
          theme_color: "#111827",
          background_color: "#f6efe4",
          display: "standalone",
          start_url: base,
          scope: base,
          icons: [
            {
              src: "icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
          ],
        },
      }),
    ],
  };
});
