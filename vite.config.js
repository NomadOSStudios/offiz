import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        studio: fileURLToPath(new URL("./index.html", import.meta.url)),
        models: fileURLToPath(new URL("./models.html", import.meta.url)),
      },
    },
  },
});
