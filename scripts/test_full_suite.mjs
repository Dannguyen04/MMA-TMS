import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corepack = process.platform === "win32" ? "corepack.cmd" : "corepack";
const pythonVenv = path.join(root, "python-worker", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const pnpmRun = (directory, script) => [corepack, ["pnpm", "--dir", directory, "run", script], root];

const commands = [
    ["node", ["scripts/check-secrets.mjs"], root],
    pnpmRun("nextjs-frontend", "lint"),
    pnpmRun("nextjs-frontend", "typecheck"),
    pnpmRun("nextjs-frontend", "test"),
    pnpmRun("nextjs-frontend", "build"),
    pnpmRun("nestjs-api", "lint"),
    pnpmRun("nestjs-api", "format:check"),
    pnpmRun("nestjs-api", "build"),
    pnpmRun("nestjs-api", "test"),
    pnpmRun("nestjs-api", "test:e2e"),
    pnpmRun("nestjs-api", "db:check"),
    pnpmRun("nestjs-api", "test:db"),
];

if (existsSync(pythonVenv)) {
    commands.push([pythonVenv, ["-m", "unittest", "discover", "-s", "python-worker", "-p", "test_*.py"], root]);
} else {
    const workerPath = path.join(root, "python-worker").replaceAll(path.sep, "/");
    commands.push(
        ["docker", ["build", "-f", "python-worker/Dockerfile", "-t", "mma-tms-python-worker:test", "."], root],
        [
            "docker",
            [
                "run",
                "--rm",
                "--entrypoint",
                "python",
                "-e",
                "PYTHONPATH=/workspace:/app",
                "-v",
                `${workerPath}:/workspace:ro`,
                "-w",
                "/workspace",
                "mma-tms-python-worker:test",
                "-m",
                "unittest",
                "discover",
                "-s",
                "/workspace",
                "-p",
                "test_*.py",
            ],
            root,
        ],
    );
}

if (process.env.RUN_REAL_E2E === "1") {
    commands.push(
        ["docker", ["compose", "-p", "mma-tms-e2e", "-f", "docker-compose.yml", "-f", "docker-compose.e2e.yml", "up", "--build", "--wait"], root],
        pnpmRun("nextjs-frontend", "test:e2e:real"),
    );
}

let failureStatus = 0;
for (const [command, args, cwd] of commands) {
    console.log(`\n> ${command} ${args.join(" ")}`);
    // Node chặn spawn trực tiếp tệp .cmd trên Windows (EINVAL, CVE-2024-27980); các tham số ở đây là hằng số.
    const viaShell = process.platform === "win32" && command.endsWith(".cmd");
    const result = viaShell
        ? spawnSync([command, ...args].join(" "), { cwd, stdio: "inherit", shell: true })
        : spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
    if (result.error) {
        console.error(result.error.message);
        failureStatus = 1;
        break;
    }
    if (result.status !== 0) {
        failureStatus = result.status ?? 1;
        break;
    }
}

if (process.env.RUN_REAL_E2E === "1") {
    const cleanup = spawnSync(
        "docker",
        ["compose", "-p", "mma-tms-e2e", "-f", "docker-compose.yml", "-f", "docker-compose.e2e.yml", "down", "--volumes"],
        { cwd: root, stdio: "inherit", shell: false },
    );
    if (cleanup.error || cleanup.status !== 0) failureStatus ||= cleanup.status ?? 1;
}

if (failureStatus !== 0) process.exit(failureStatus);
console.log("\nFull suite passed.");
