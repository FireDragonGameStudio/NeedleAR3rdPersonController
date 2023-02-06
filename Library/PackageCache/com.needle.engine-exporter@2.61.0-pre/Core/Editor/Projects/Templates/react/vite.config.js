import * as path from 'path';
import { defineConfig, optimizeDeps } from 'vite';
import viteCompression from 'vite-plugin-compression';
import react from '@vitejs/plugin-react'

export default defineConfig({

    base: "./",
    // publicDir: "./assets", // this would copy all assets in the outdir (but not inside assets)
    assetsInclude: ['*'],
    // logLevel: 'info',

    plugins: [
        react(),
        //viteCompression({ deleteOriginFile: true }),
    ],

    server: {
        // hmr: false,
        // watch: ["generated/**"]
        https: true,
        proxy: { // workaround: specifying a proxy skips HTTP2 which is currently problematic in Vite since it causes session memory timeouts.
            'https://localhost:3000': 'https://localhost:3000'
        },
        watch: {
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 1000
            },
        },
        strictPort: true,
    },
    build: {
        outDir: "./dist",
        emptyOutDir: true,
        keepNames: true,
    },
    resolve: {
        alias: {
            'three': () => {
                const absPath = path.resolve(__dirname, 'node_modules/three');
                return absPath;
            },
            '@needle-tools/engine': () => {
                const absPath = path.resolve(__dirname, 'node_modules/@needle-tools/engine');
                return absPath;
            },
            'react': () => {
                const absPath = path.resolve(__dirname, 'node_modules/react');
                return absPath;
            }
        }
    }
});