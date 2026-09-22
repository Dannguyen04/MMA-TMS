import { spawnSync } from "node:child_process";

const patterns = [
    { name: "Supabase JWT literal", needle: ["eyJ", "hbGciOiJ", "IUzI1Ni"].join("") },
    { name: "private key", needle: ["-----BEGIN ", "PRIVATE KEY-----"].join("") },
];
const allowedFixtureFiles = new Set(["nestjs-api/test/dataset-export-trust-boundary.spec.ts"]);
const findings = [];

for (const pattern of patterns) {
    const result = spawnSync("git", ["grep", "-n", "-I", "-F", "-e", pattern.needle, "--", "."], { encoding: "utf8" });
    if (result.status === 0) {
        for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
            const file = line.split(":", 1)[0].replaceAll("\\", "/");
            if (!allowedFixtureFiles.has(file)) findings.push(`${pattern.name}: ${file}`);
        }
    } else if (result.status !== 1) {
        console.error("Không thể quét tệp được Git theo dõi.");
        process.exit(1);
    }
}

if (findings.length) {
    console.error("Phát hiện bí mật dạng literal trong tệp được theo dõi:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exit(1);
}
console.log("Secret scan passed.");
