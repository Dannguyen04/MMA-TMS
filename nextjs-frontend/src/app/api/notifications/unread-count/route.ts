import { apiErrorResponse } from "@/lib/api/client";
import { getUnreadNotificationCount } from "@/lib/services/notifications";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The unread count the bell polls while the live stream isn't available. A plain read rather than a Server Action, so a
 * poll never queues ahead of a form the person submits.
 */
export async function GET() {
    try {
        const count = await getUnreadNotificationCount();
        if (count === null) return Response.json({ message: "Your session has expired. Sign in again." }, { status: 401, headers: NO_STORE });
        return Response.json({ count }, { headers: NO_STORE });
    } catch (error) {
        return apiErrorResponse(error, "Notifications are unavailable right now.", NO_STORE);
    }
}
