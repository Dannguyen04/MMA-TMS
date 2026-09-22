const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required.");
}

const objectPath = `integration-checks/${crypto.randomUUID()}.txt`;
const response = await fetch(
    `${supabaseUrl}/storage/v1/object/analysis-results/${objectPath}`,
    {
        method: "POST",
        headers: {
            "Content-Type": "text/plain",
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "x-upsert": "false",
        },
        body: "mma-tms storage integration check",
    },
);

if (!response.ok) {
    throw new Error(`Storage upload failed: HTTP ${response.status}`);
}

console.log(`Private storage upload succeeded: ${objectPath}`);
