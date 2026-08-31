// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: "index.html",
    }),

    /**
     * What the app is allowed to run and load.
     *
     * Mari renders Markdown from files people send each other, and it has a
     * terminal. DOMPurify strips anything dangerous out of that Markdown, but
     * it is one library standing between a document and a shell. This is the
     * second lock: even if something got past the sanitiser, the browser
     * refuses to execute it or send anything anywhere.
     *
     * Owned here rather than in tauri.conf.json because the app has two inline
     * scripts it genuinely needs — SvelteKit's own bootstrap and the theme
     * applied before first paint — and `mode: "hash"` recomputes their hashes
     * on every build. Hashes written by hand in Tauri's config would be stale
     * the next time either script changed, and the app would refuse to start.
     */
    csp: {
      mode: "hash",
      directives: {
        "default-src": ["self"],
        // No 'unsafe-inline': injected scripts are exactly what this is for.
        // SvelteKit adds the hashes of the app's own two inline scripts.
        "script-src": ["self"],
        // Svelte writes component styles inline, and there is no hashing path
        // for those. Style injection can deface but not exfiltrate or execute.
        "style-src": ["self", "unsafe-inline"],
        // asset: and asset.localhost are how Tauri serves local files.
        "img-src": ["self", "data:", "blob:", "asset:", "http://asset.localhost"],
        "font-src": ["self", "data:"],
        // ipc: is Tauri's bridge to the Rust side. The dev-server socket is
        // named exactly rather than allowing ws: generally, which would let
        // anything that did run open a socket to any host it liked.
        "connect-src": ["self", "ipc:", "http://ipc.localhost", "ws://localhost:1420"],
        "object-src": ["none"],
        "base-uri": ["self"],
        "form-action": ["none"],
      },
    },
  },
};

export default config;
