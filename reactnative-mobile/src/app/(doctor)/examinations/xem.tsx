import { ExaminationReadScreen } from "@/screens/doctor/clinical-read";

/** Chi tiết kết luận khám: /(doctor)/examinations/xem?examId=… (route tĩnh, không phụ thuộc file bracket). */
export default function DoctorExamReadRoute() {
  return <ExaminationReadScreen />;
}
