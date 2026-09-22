const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required.");
}

async function createPrivateBucket(bucketId) {
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ id: bucketId, name: bucketId, public: false }),
    });

    if (![200, 201, 409].includes(response.status)) {
        throw new Error(`Could not create ${bucketId}: HTTP ${response.status}`);
    }

    return response.status;
}

for (const bucket of ["videos", "analysis-results"]) {
    const status = await createPrivateBucket(bucket);
    console.log(`${bucket}: HTTP ${status}`);
}
