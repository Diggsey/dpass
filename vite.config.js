import { defineConfig, loadEnv } from "vite";
import webExtension from "@samrum/vite-plugin-web-extension";
import path from "path";
import { getManifest } from "./src/manifest";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");

    return {
        plugins: [
            webExtension({
                manifest: getManifest(Number(env.MANIFEST_VERSION)),
                extraContentScripts: [
                    {
                        js: ["src/entries/content/main.tsx"]
                    }
                ],
                extraHtmlPages: [
                    "src/entries/unlockPopup/index.html",
                    "src/entries/noActionPopup/index.html",
                    "src/entries/autofillEmbed/index.html",
                ],
            }),
        ],
        resolve: {
            alias: {
                "~": path.resolve(__dirname, "./src"),
            },
        },
        build: {
            sourcemap: true,
            rollupOptions: {
                output: {
                    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
                        return path.resolve(path.dirname(sourcemapPath), relativeSourcePath);
                    }
                }
            }
        }
    };
});
