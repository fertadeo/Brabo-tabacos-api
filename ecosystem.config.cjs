/** PM2 — Brabo Tabacos API. Entry canónico: dist/index.js (tsconfig rootDir=src). */
const fs = require("fs");
const path = require("path");

const candidates = ["dist/index.js", "dist/src/index.js"];
const script = candidates.find((p) => fs.existsSync(path.join(__dirname, p)));
if (!script) {
  throw new Error(
    "No existe dist/index.js ni dist/src/index.js. Corré: npm ci --include=dev && npm run build"
  );
}

module.exports = {
  apps: [
    {
      name: "brabo-tabacos-api",
      script,
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
