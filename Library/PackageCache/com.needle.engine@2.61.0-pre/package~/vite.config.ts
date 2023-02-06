// vite.config.ts
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'needle-engine.ts'),
            name: 'needle-engine',
            fileName: 'dist/needle-engine',
        },
        rollupOptions: {
            // external: ["@dimforge/rapier3d-compat"]
            // external: id => {
            //     // console.log(id);
            //     let exclude = id.includes("include/");
            //     if(exclude) {
            //         console.log("\n> ", id);
            //         return true;
            //     }
            //     return false;
            // }
        }
    }
});