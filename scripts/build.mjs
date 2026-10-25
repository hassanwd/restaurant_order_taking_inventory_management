// Chains `prisma migrate deploy` before `next build` in a way that works identically under
// bash (Vercel's build container) and Windows PowerShell (this machine's npm script-shell) —
// `&&` isn't valid syntax in PowerShell 5.1, so the two steps are run from here instead.
import { spawnSync } from "node:child_process";

function run(command) {
  console.log(`\n=== Running: ${command} ===`);
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  if (result.error) {
    console.error(`\n=== ${command} failed to start ===`);
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\n=== ${command} exited with code ${result.status} (see output above) ===`);
    process.exit(result.status ?? 1);
  }
  console.log(`=== ${command} finished ===\n`);
}

run("npx prisma migrate deploy");
run("npx next build");
