// Production server for the SubTracker Next.js app.
// The sandbox auto-runs this file; it takes over port 3000 and starts next start.

const PORT = 3000;
const HOST = "0.0.0.0";

// Free PORT regardless of which user owns the current listener.
const freePort =
  `for _ in $(seq 1 25); do ` +
  `pids=$(lsof -t -iTCP:${String(PORT)} -sTCP:LISTEN 2>/dev/null || true); ` +
  `if [ -z "$pids" ]; then exit 0; fi; ` +
  `kill $pids 2>/dev/null || true; sleep 0.2; ` +
  `done`;

// Take over the port, then spawn next start as a child process.
for (let attempt = 1; ; attempt++) {
  await Bun.$`sudo sh -c ${freePort}`.quiet().nothrow();
  try {
    const proc = Bun.spawn(["bun", "run", "start"], {
      cwd: import.meta.dir,
      stdio: ["ignore", "inherit", "inherit"],
    });
    // Keep this wrapper alive so the sandbox doesn't try to restart.
    await proc.exited;
    // If next start exits, try again (sandbox will restart serve.ts anyway).
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}
