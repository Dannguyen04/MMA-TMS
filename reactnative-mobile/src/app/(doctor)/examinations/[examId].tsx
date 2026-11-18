import { DoctorOldRoute } from "@/screens/doctor/detail/old-route";

/** Redesign step 20: an old exam link goes to the one exam page. */
export default function DoctorExamDetailRoute() {
  return <DoctorOldRoute tab="exams" exam/>;
}
