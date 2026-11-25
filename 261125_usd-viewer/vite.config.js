import { defineConfig } from "vite";
export default defineConfig({base:"./",optimizeDeps:{exclude:["@classcad/smlibwasm"]},build:{outDir:"build",target:"esnext"},worker:{format:"es"}});
