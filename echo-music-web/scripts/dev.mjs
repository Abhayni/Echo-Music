import { spawn } from "node:child_process";
import { createServer } from "node:net";

const defaultPort = 4174;
const portWasProvided = process.env.PORT !== undefined;
let port = Number(process.env.PORT || defaultPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

async function isPortAvailable(candidate) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", error => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
      } else {
        reject(error);
      }
    });
    server.listen(candidate, "0.0.0.0", () => {
      server.close(error => error ? reject(error) : resolve(true));
    });
  });
}

while (!(await isPortAvailable(port))) {
  if (portWasProvided) {
    throw new Error(`Port ${port} is already in use. Set PORT to an available port and retry.`);
  }
  if (port === 65535) {
    throw new Error("No available API port found starting from 4174.");
  }
  port++;
}

if (port !== defaultPort) {
  console.log(`Port ${defaultPort} is in use; using API port ${port}.`);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(
  npm,
  [
    "exec",
    "concurrently",
    "--",
    "-k",
    "-n",
    "api,web",
    "-c",
    "magenta,cyan",
    "tsx server/index.ts",
    "npm --prefix frontend run dev -- --host 0.0.0.0",
  ],
  {
    env: { ...process.env, PORT: String(port) },
    stdio: "inherit",
  },
);

child.once("error", error => {
  console.error("Could not start the development servers", error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
