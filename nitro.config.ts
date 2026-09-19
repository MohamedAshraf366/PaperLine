import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "vercel",
  traceDeps: ["tesseract.js*", "tesseract.js-core*", "wasm-feature-detect"],
});
