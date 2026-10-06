import net from "net";
import { spawn } from "child_process";
import fs from "fs";

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function getRedisVersion(port = 6379, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host });
    let response = "";
    let settled = false;
    socket.setTimeout(1000);
    socket.on("connect", () => socket.write("*2\r\n$4\r\nINFO\r\n$6\r\nserver\r\n"));
    socket.on("data", (chunk) => {
      response += chunk;
      const match = response.match(/redis_version:(\d+\.\d+\.\d+)/);
      if (match && !settled) {
        settled = true;
        socket.destroy();
        resolve(match[1]);
      }
    });
    socket.on("end", () => {
      const match = response.match(/redis_version:(\d+\.\d+\.\d+)/);
      if (!settled) {
        settled = true;
        match ? resolve(match[1]) : reject(new Error("Redis did not return its version."));
      }
    });
    socket.on("timeout", () => socket.destroy(new Error("Timed out reading Redis version.")));
    socket.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

async function assertCompatibleRedis() {
  const version = await getRedisVersion();
  if (Number(version.split(".")[0]) < 5) {
    throw new Error(
      `Redis ${version} is listening on port 6379; BullMQ requires Redis 5.0.0 or newer. Stop the legacy C:\\Program Files\\Redis service and retry.`,
    );
  }
  return version;
}

async function main() {
  const open = await isPortOpen(6379);
  if (open) {
    try {
      const version = await assertCompatibleRedis();
      console.log(`✓ Compatible Redis ${version} is already running on port 6379.`);
    } catch (err) {
      console.error(`❌ ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  console.log("⏳ Starting Redis Server on port 6379...");
  // Do not hard-code a Windows user profile: this project is shared by
  // different developers and the WinGet install lives below LOCALAPPDATA.
  const winGetPath = process.env.LOCALAPPDATA
    ? `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\\Redis-8.10.1-Windows-x64-msys2\\redis-server.exe`
    : "";
  const redisExe = fs.existsSync(winGetPath) ? winGetPath : "redis-server";

  try {
    const child = spawn(redisExe, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();

    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isPortOpen(6379)) {
        try {
          const version = await assertCompatibleRedis();
          console.log(`✓ Redis ${version} started successfully.`);
          return;
        } catch (err) {
          console.error(`❌ ${err.message}`);
          process.exitCode = 1;
          return;
        }
      }
    }
    console.warn("⚠️ Redis Server process spawned, but port 6379 is not yet responding.");
  } catch (err) {
    console.error("❌ Failed to start Redis Server automatically:", err.message);
  }
}

await main();
