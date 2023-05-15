import { defineConfig, loadEnv } from "vite"
import webExtension from "@samrum/vite-plugin-web-extension"
import path from "path"
import { getManifest } from "./src/manifest"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "")

    return {
        plugins: [
            webExtension({
                manifest: getManifest(Number(env.MANIFEST_VERSION)),
                additionalInputs: {
                    scripts: ["src/entries/content/main.tsx"],
                    html: [
                        "src/entries/unlockPopup/index.html",
                        "src/entries/noActionPopup/index.html",
                        "src/entries/autofillEmbed/index.html",
                    ],
                },
            }),
        ],
        resolve: {
            alias: {
                "~": path.resolve(__dirname, "./src"),
            },
        },
        build: {
            target: ["es2022", "edge89", "firefox89", "chrome89", "safari15"],
            sourcemap: true,
            rollupOptions: {
                output: {
                    sourcemapPathTransform: (
                        relativeSourcePath,
                        sourcemapPath
                    ) => {
                        return path.resolve(
                            path.dirname(sourcemapPath),
                            relativeSourcePath
                        )
                    },
                },
            },
        },
    }
})
