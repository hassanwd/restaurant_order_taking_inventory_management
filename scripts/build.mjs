// Chains `prisma migrate deploy` before `next build` in a way that works identically under
// bash (Vercel's build container) and Windows PowerShell (this machine's npm script-shell) —
// `&&` isn't valid syntax in PowerShell 5.1, so the two steps are run from here instead.
import { execSync } from "node:child_process";

execSync("npx prisma migrate deploy", { stdio: "inherit" });
execSync("npx next build", { stdio: "inherit" });
