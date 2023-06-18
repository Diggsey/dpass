import pkg from "../package.json"

const permissions: chrome.runtime.ManifestPermissions[] = [
    "activeTab",
    "scripting",
    "storage",
    "identity",
    "contextMenus",
    "downloads",
]

const hostPermissions: string[] = ["https://www.googleapis.com/*"]

const sharedManifest = {
    icons: {
        48: "icons/icon-48.png",
    },
    options_ui: {
        page: "src/entries/options/index.html",
        open_in_tab: true,
    },
    browser_specific_settings: {
        gecko: {
            id: "dpass@diggsey.com",
        },
    },
    commands: {
        "dpass-configure": {
            description: "Open the dpass options page",
        },
        "dpass-sync": {
            description: "Trigger an immediate dpass sync",
        },
        _execute_browser_action: {
            suggested_key: {
                default: "Ctrl+Space",
            },
        },
    },
}

const browserAction = {
    default_icon: {
        48: "icons/icon-48.png",
    },
    default_title: "Auto-fill using dpass",
    default_area: "navbar",
}

const ManifestV2 = {
    ...sharedManifest,
    background: {
        scripts: ["src/entries/background/script.ts"],
        persistent: true,
    },
    browser_action: browserAction,
    options_ui: {
        ...sharedManifest.options_ui,
        chrome_style: false,
    },
    permissions: [...permissions, ...hostPermissions],
}

const ManifestV3 = {
    ...sharedManifest,
    action: browserAction,
    background: {
        service_worker: "src/entries/background/serviceWorker.ts",
    },
    permissions,
    host_permissions: hostPermissions,
}

export function getManifest(
    manifestVersion: number
): chrome.runtime.ManifestV2 | chrome.runtime.ManifestV3 {
    const manifest = {
        author: pkg.author,
        description: pkg.description,
        name: pkg.displayName ?? pkg.name,
        version: pkg.version,
    }

    if (manifestVersion === 2) {
        return {
            ...manifest,
            ...ManifestV2,
            manifest_version: manifestVersion,
        }
    }

    if (manifestVersion === 3) {
        return {
            ...manifest,
            ...ManifestV3,
            manifest_version: manifestVersion,
        }
    }

    throw new Error(
        `Missing manifest definition for manifestVersion ${manifestVersion}`
    )
}
