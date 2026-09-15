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

async function main() {
  const open = await isPortOpen(6379);
  if (open) {
    console.log("✓ Redis Server is already running on port 6379.");
    return;
  }

  console.log("⏳ Starting Redis Server on port 6379...");
  const winGetPath =
    "C:\\Users\\DAN\\AppData\\Local\\Microsoft\\WinGet\\Packages\\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\\Redis-8.10.1-Windows-x64-msys2\\redis-server.exe";
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
        console.log("✓ Redis Server started successfully.");
        return;
      }
    }
    console.warn("⚠️ Redis Server process spawned, but port 6379 is not yet responding.");
  } catch (err) {
    console.error("❌ Failed to start Redis Server automatically:", err.message);
  }
}

await main();
