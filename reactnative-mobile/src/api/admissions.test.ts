import { apiFetch } from "./client";
import {
  activateAdmission,
  assignApplicationCoach,
  decideApplication,
  getApplication,
  getAssignedApplication,
  getOwnApplication,
  listApplications,
  listAssignedApplications,
  listOwnApplications,
  resendActivationEmail,
  submitApplication,
  submitAssessment,
} from "./admissions";

jest.mock("./client", () => ({
  apiFetch: jest.fn(() => Promise.resolve({})),
}));

const id = "11111111-1111-4111-8111-111111111111";

describe("fighter admission client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls every admission route with the backend path", async () => {
    await submitApplication({
      firstName: "An",
      lastName: "Le",
      dateOfBirth: "2000-01-02",
      weightClass: "LIGHTWEIGHT",
    });
    await listOwnApplications({ page: 1, limit: 20 });
    await getOwnApplication(id);
    await activateAdmission();
    await listApplications({ page: 1, status: "SUBMITTED" });
    await getApplication(id);
    await assignApplicationCoach(id, { coachId: id });
    await decideApplication(id, { decision: "APPROVED", reason: "Dat" });
    await resendActivationEmail(id);
    await listAssignedApplications({ page: 1 });
    await getAssignedApplication(id);
    await submitAssessment(id, {
      conclusion: "PASS",
      summary: "Tot",
      criteria: [{ criterionName: "The luc", method: "Test", observation: "On" }],
    });

    const calls = (apiFetch as jest.Mock).mock.calls.map((call) => [
      call[0],
      (call[1] as { method?: string } | undefined)?.method ?? "GET",
    ]);
    expect(calls).toEqual([
      ["/fighter-admissions/applications", "POST"],
      ["/fighter-admissions/applications/me?page=1&limit=20", "GET"],
      [`/fighter-admissions/applications/me/${id}`, "GET"],
      ["/fighter-admissions/activation", "POST"],
      ["/fighter-admissions/applications?page=1&status=SUBMITTED", "GET"],
      [`/fighter-admissions/applications/${id}`, "GET"],
      [`/fighter-admissions/applications/${id}/assign-coach`, "POST"],
      [`/fighter-admissions/applications/${id}/decision`, "POST"],
      [`/fighter-admissions/applications/${id}/resend-activation-email`, "POST"],
      ["/fighter-admissions/assigned?page=1", "GET"],
      [`/fighter-admissions/assigned/${id}`, "GET"],
      [`/fighter-admissions/assigned/${id}/assessment`, "POST"],
    ]);
  });
});
