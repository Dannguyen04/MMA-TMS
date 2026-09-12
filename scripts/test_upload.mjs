import https from "https";

const SUPABASE_URL = "https://wskisxkpbhisnqfpjqrm.supabase.co";
const ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indza2lzeGtwYmhpc25xZnBqcXJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTQ5MDEsImV4cCI6MjEwNDY3MDkwMX0.8v0LcQ_9ySo4XoZC-vaIRD1AzjKjV84qbJw5FCzNjp0";

async function testUpload() {
    const data = "test data";

    const options = {
        hostname: "wskisxkpbhisnqfpjqrm.supabase.co",
        port: 443,
        path: "/storage/v1/object/videos/uploads/test.txt",
        method: "POST",
        headers: {
            "Content-Type": "text/plain",
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
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

testUpload().then((res) => console.log("Upload:", res.status, res.body));
