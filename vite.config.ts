import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { caddyPlugin } from "./src/vite-plugin-caddy"
import wasm from "vite-plugin-wasm"
import topLevelAwait from "vite-plugin-top-level-await"

const config = defineConfig({
  server: {
    host: true,
  },
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: [`./tsconfig.json`],
    }),
    // Local HTTPS with Caddy
    caddyPlugin(),
    tailwindcss(),
    tanstackStart({
      target: "vercel",
      spa: {
        enabled: true,
      },
    }),
    wasm(),
    topLevelAwait(),
  ],
})

export default config
