import https from "https";

const SUPABASE_URL = "https://wskisxkpbhisnqfpjqrm.supabase.co";
const SERVICE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indza2lzeGtwYmhpc25xZnBqcXJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA5NDkwMSwiZXhwIjoyMTA0NjcwOTAxfQ.moeIkCVAkKhf_d8p6xyVFLkxAGQ5gvlqh__oXa6oKU0";

async function createBucket(bucketId) {
    const data = JSON.stringify({
        id: bucketId,
        name: bucketId,
        public: true,
    });

    const options = {
        hostname: "wskisxkpbhisnqfpjqrm.supabase.co",
        port: 443,
        path: "/storage/v1/bucket",
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Length": data.length,
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ status: res.statusCode, body }));
        });
        req.on("error", (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function run() {
    const v = await createBucket("videos");
    console.log("videos bucket:", v.status, v.body);

    const a = await createBucket("analysis-results");
    console.log("analysis-results bucket:", a.status, a.body);
}
run();
