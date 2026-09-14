import path from "node:path";

import type { NextConfig } from "next";

/**
 * The repository root has its own package-lock.json (orchestration scripts), so pin both the
 * Turbopack root and the output tracing root to this app. This keeps `server.js` at the top of
 * `.next/standalone`, matching the Dockerfile.
 */
const appRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
    output: "standalone",
    outputFileTracingRoot: appRoot,
    turbopack: { root: appRoot },
    /**
     * Legacy prototype routes now live in the fighter video area. Temporary (307) so the paths can be
     * reused later. Signed-out visitors are sent to login by the proxy; other roles are redirected to
     * their own dashboard by the fighter layout.
     */
    async redirects() {
        return [
            { source: "/analysis", destination: "/fighter/videos/upload", permanent: false },
            { source: "/analysis/:jobId", destination: "/fighter/videos", permanent: false },
            { source: "/live", destination: "/fighter/videos/live", permanent: false },
        ];
    },
};

export default nextConfig;
