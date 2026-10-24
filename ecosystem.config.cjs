/** PM2 — Brabo Tabacos API (producción). bootstrap-prod.sh puede regenerarlo. */
module.exports = {
  apps: [
    {
      name: "brabo-tabacos-api",
      script: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
