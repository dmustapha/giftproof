// File: ecosystem.config.cjs
// pm2 process manager config for the Oracle Always-Free VM (ARCHITECTURE §N+9).
module.exports = {
  apps: [
    {
      name: "giftproof",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
    {
      // keep-warm cron: hit /api/health so the VM stays hot for the on-air window (R4).
      name: "keepwarm",
      script: "node_modules/.bin/tsx",
      args: "scripts/keepwarm.ts",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      cron_restart: "*/5 * * * *",
      env: {
        HEALTH_URL: "http://localhost:3000/api/health",
      },
    },
  ],
};
