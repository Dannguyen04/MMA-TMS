"""
coaching_engine.py — Coaching Feedback & Drill Recommendation Engine (Task 12)

Ánh xạ error codes từ kết quả phân tích sang khuyến nghị huấn luyện chuyên môn:
- Drill Catalog versioned và coach-approved (không tự bịa drill bằng LLM ở production path).
- Mỗi bài tập có: objective, brief instructions, safety note, applicability, contraindications (phi y tế).
- Dual Mode:
    * Athlete Mode: Ngôn ngữ súc tích, dễ hiểu, các khẩu lệnh (cues) trực quan.
    * Coach Mode: Đầy đủ số liệu đo lường, bằng chứng video, rubric provenance và sai số định lượng.
- Nghiêm ngặt TỐI ĐA 3 ưu tiên/session theo kết quả xếp hạng từ Task 11.
- Fallback an toàn cho mã lỗi không xác định.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import deep_freeze, to_json_safe
from pipeline.finding_engine import FindingErrorCode
from pipeline.session_aggregation import PriorityFindingSummary, SessionInsights

DRILL_CATALOG_VERSION = "1.0.0"
COACHING_ENGINE_VERSION = "1.0.0"


@dataclass(frozen=True)
class CoachingDrill:
    """Định nghĩa một bài tập chuẩn hóa trong catalog của huấn luyện viên."""
    drill_id: str
    title: str
    error_code: str
    target_technique: str
    objective: str
    instructions: tuple[str, ...]
    safety_note: str
    applicability: str
    contraindications: str
    recommended_reps: str
    catalog_version: str = DRILL_CATALOG_VERSION

    def to_dict(self) -> dict[str, Any]:
        return {
            "drillId": self.drill_id,
            "title": self.title,
            "errorCode": self.error_code,
            "targetTechnique": self.target_technique,
            "objective": self.objective,
            "instructions": list(self.instructions),
            "safetyNote": self.safety_note,
            "applicability": self.applicability,
            "contraindications": self.contraindications,
            "recommendedReps": self.recommended_reps,
            "catalogVersion": self.catalog_version,
        }


@dataclass(frozen=True)
class CoachingRecommendation:
    """Khuyến nghị khắc phục lỗi với 2 chế độ hiển thị: Vận động viên & Huấn luyện viên."""
    priority_rank: int
    error_code: str
    drill: Optional[CoachingDrill]
    athlete_cue: str
    coach_notes: Mapping[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "priorityRank": self.priority_rank,
            "errorCode": self.error_code,
            "drill": self.drill.to_dict() if self.drill is not None else None,
            "athleteCue": self.athlete_cue,
            "coachNotes": to_json_safe(self.coach_notes),
        }


@dataclass(frozen=True)
class SessionCoachingPlan:
    """Kế hoạch huấn luyện hoàn chỉnh cho buổi tập."""
    session_status: str
    recommendations: tuple[CoachingRecommendation, ...]
    catalog_version: str = DRILL_CATALOG_VERSION
    engine_version: str = COACHING_ENGINE_VERSION
    quality_status: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        d = {
            "sessionStatus": self.session_status,
            "recommendations": [r.to_dict() for r in self.recommendations],
            "catalogVersion": self.catalog_version,
            "engineVersion": self.engine_version,
        }
        if self.quality_status is not None:
            d["qualityStatus"] = self.quality_status
        return d


# ─── Coach-Approved Drill Catalog Registry ───
APPROVED_DRILL_CATALOG: dict[str, CoachingDrill] = {
    FindingErrorCode.PUNCH_GUARD_DROPPED.value: CoachingDrill(
        drill_id="drill_guard_tennis_ball",
        title="Phone-to-Ear & Tennis Ball Guard Drill",
        error_code=FindingErrorCode.PUNCH_GUARD_DROPPED.value,
        target_technique="all_punches",
        objective="Tạo phản xạ găm chặt tay thủ đối diện bảo vệ hàm khi tay kia tung đòn.",
        instructions=(
            "Kẹp một quả bóng tennis hoặc miếng đệm nhỏ giữa cằm và găng tay thủ đối diện.",
            "Tung 20 đòn jab/cross bằng tay còn lại sao cho quả bóng không bị rơi xuống.",
            "Tập trung cảm giác cơ bắp ở vai giữ chặt vị trí phòng ngự.",
        ),
        safety_note="Giữ cổ thẳng tự nhiên, không gập cằm quá gắt gây căng cứng cơ vùng cổ.",
        applicability="Tất cả thế thủ (orthodox, southpaw), mọi cấp độ kỹ năng.",
        contraindications="Tạm ngưng nếu có dấu hiệu mỏi cơ cổ hoặc chóng mặt khi giữ thăng bằng.",
        recommended_reps="3 hiệp x 20 lần ra đòn",
    ),
    FindingErrorCode.PUNCH_ELBOW_UNDEREXTENDED.value: CoachingDrill(
        drill_id="drill_punch_wall_reach",
        title="Wall Reach Distance Extension Drill",
        error_code=FindingErrorCode.PUNCH_ELBOW_UNDEREXTENDED.value,
        target_technique="straight_punches",
        objective="Tối ưu hóa tầm với và độ duỗi của khớp khuỷu ở pha va chạm.",
        instructions=(
            "Đứng cách tường đúng bằng chiều dài cánh tay duỗi thẳng của bạn.",
            "Tung đòn thẳng từ từ cho đến khi khớp ngón tay chạm nhẹ vào mặt phẳng tường.",
            "Kiểm tra khớp khuỷu tay mở thẳng nhưng không bị khóa cứng gắt.",
        ),
        safety_note="Tuyệt đối không đấm mạnh vào tường phẳng; đây là bài tập cảm giác khoảng cách và cữ tay.",
        applicability="Boxing, Kickboxing, MMA; đòn Jab và Cross.",
        contraindications="Không thực hiện đòn phát lực tốc độ cao khi đứng cự ly quá gần tường.",
        recommended_reps="3 hiệp x 15 lần mỗi tay",
    ),
    FindingErrorCode.PUNCH_LOW_SPEED.value: CoachingDrill(
        drill_id="drill_punch_band_snap",
        title="Resistance Band Snap & Whip Drill",
        error_code=FindingErrorCode.PUNCH_LOW_SPEED.value,
        target_technique="all_punches",
        objective="Cải thiện khả năng giải phóng tốc độ đột biến ở pha cuối đòn đánh.",
        instructions=(
            "Cố định dây kháng lực đàn hồi phía sau lưng, cầm đầu dây bằng tay đấm.",
            "Thả lỏng toàn bộ cơ vai và bắp tay ở 2/3 quãng đường đầu.",
            "Bung tốc độ bộc phát và siết chặt nắm đấm đúng tại thời điểm tiếp xúc mục tiêu.",
        ),
        safety_note="Khởi động kỹ khớp vai và cổ tay trước khi thực hiện bài tập tốc độ.",
        applicability="Tất cả võ sĩ thi đấu đối kháng.",
        contraindications="Không sử dụng mức dây kháng lực quá nặng làm méo mó quỹ đạo kỹ thuật.",
        recommended_reps="4 hiệp x 10 lần bộc phát nhanh",
    ),
    FindingErrorCode.KICK_CHAMBER_LOW.value: CoachingDrill(
        drill_id="drill_kick_high_chamber_hurdle",
        title="High Knee Barrier Chamber Drill",
        error_code=FindingErrorCode.KICK_CHAMBER_LOW.value,
        target_technique="roundhouse_kick",
        objective="Rút gối cao ngang hông trước khi xoay hông và mở cẳng chân.",
        instructions=(
            "Đặt một chướng ngại vật (như ghế tập hoặc dây rào) cao ngang thắt lưng.",
            "Nhấc gối chân đá vượt qua mép chướng ngại vật trước khi bắt đầu pha bung chân.",
            "Giữ tư thế rút gối ổn định trong 1 giây để xây dựng sức bền nhóm cơ gập hông.",
        ),
        safety_note="Giữ chắc chân trụ bám sàn và duy trì cơ bụng gồng nhẹ để hỗ trợ cột sống.",
        applicability="Muay Thai, Kickboxing, Taekwondo.",
        contraindications="Tạm dừng nếu nhóm cơ gập hông hoặc cơ đáy chậu bị căng cứng quá tải.",
        recommended_reps="3 hiệp x 12 lần mỗi bên",
    ),
    FindingErrorCode.KICK_HIP_LEAN_EXCESSIVE.value: CoachingDrill(
        drill_id="drill_kick_wall_posture_lock",
        title="Wall-Assisted Core Alignment Pivot Drill",
        error_code=FindingErrorCode.KICK_HIP_LEAN_EXCESSIVE.value,
        target_technique="roundhouse_kick",
        objective="Duy trì góc thân trên vững chắc, tránh ngả người về sau làm mất cân bằng cơ sinh học.",
        instructions=(
            "Chống một tay vào tường để hỗ trợ thăng bằng, xoay ức bàn chân trụ 90–120 độ.",
            "Xoay hông chân đá vào tư thế nằm ngang trong khi giữ thân trên không ngả quá 45 độ.",
            "Siết chặt cơ liên sườn và cơ bụng để khóa chặt trục cơ thể.",
        ),
        safety_note="Xoay trên ức bàn chân trụ, tuyệt đối không vặn hông khi bàn chân trụ còn dính chặt sàn.",
        applicability="Võ sinh có xu hướng ngửa người ra sau khi đá cao.",
        contraindications="Không tập trên sàn trơn trượt hoặc khi đi giày đế cao su quá rít.",
        recommended_reps="3 hiệp x 10 lần giữ tĩnh 3 giây",
    ),
}


class CoachingEngine:
    """
    Engine sinh Coaching Plan từ SessionInsights theo Task 12.
    """

    @classmethod
    def generate_coaching_plan(
        cls,
        session_insights: SessionInsights,
    ) -> SessionCoachingPlan:
        """
        Tạo kế hoạch huấn luyện từ tối đa 3 priority findings của session.
        Nếu mã lỗi không nằm trong APPROVED_DRILL_CATALOG -> abstention an toàn với status NO_APPROVED_DRILL.
        Tuyệt đối KHÔNG tự tạo drill giả mạo.
        """
        if session_insights.status in ("blocked", "empty_session"):
            return SessionCoachingPlan(
                session_status=session_insights.status,
                recommendations=(),
            )

        recommendations: list[CoachingRecommendation] = []

        for p_finding in session_insights.priority_findings[:3]:
            drill = APPROVED_DRILL_CATALOG.get(p_finding.code)

            if drill is not None:
                # Athlete Mode cue with approved drill
                athlete_cue = (
                    f"[Ưu tiên {p_finding.rank}] {p_finding.title}: {p_finding.primary_recommendation} "
                    f"Tập trung bài: '{drill.title}' ({drill.recommended_reps})."
                )
                coach_notes = {
                    "status": "APPROVED_DRILL_RECOMMENDED",
                    "errorCode": p_finding.code,
                    "severity": p_finding.severity,
                    "frequency": p_finding.frequency,
                    "priorityScore": p_finding.priority_score,
                    "representativeFrame": p_finding.representative_frame,
                    "representativeTimeMs": p_finding.representative_time_ms,
                    "affectedActionIds": list(p_finding.affected_action_ids),
                    "technicalDescription": p_finding.description,
                    "drillObjective": drill.objective,
                    "contraindications": drill.contraindications,
                    "safetyPrecaution": drill.safety_note,
                }
            else:
                # Abstention result (R3.3): Do not fabricate unapproved drill
                athlete_cue = (
                    f"[Ưu tiên {p_finding.rank}] {p_finding.title}: "
                    f"Chưa có bài tập được phê duyệt chính thức trong catalog cho lỗi này. "
                    f"Khuyến nghị tham vấn trực tiếp HLV chuyên môn."
                )
                coach_notes = {
                    "status": "NO_APPROVED_DRILL",
                    "errorCode": p_finding.code,
                    "severity": p_finding.severity,
                    "frequency": p_finding.frequency,
                    "priorityScore": p_finding.priority_score,
                    "representativeFrame": p_finding.representative_frame,
                    "representativeTimeMs": p_finding.representative_time_ms,
                    "affectedActionIds": list(p_finding.affected_action_ids),
                    "technicalDescription": p_finding.description,
                    "drillObjective": None,
                    "contraindications": "Chưa có khuyến nghị bài tập được phê chuẩn.",
                    "safetyPrecaution": "Không tự ý tập biến thể phát lực nặng khi chưa có giáo án HLV.",
                }

            q_status = getattr(session_insights, "quality_status", None)
            if q_status == "degraded":
                coach_notes["evidenceQualityNotice"] = "DEGRADED_VIDEO_QUALITY: Kinematic measurements are derived proxies. Hedge drill intensity."

            rec = CoachingRecommendation(
                priority_rank=p_finding.rank,
                error_code=p_finding.code,
                drill=drill,
                athlete_cue=athlete_cue,
                coach_notes=deep_freeze(coach_notes),
            )
            recommendations.append(rec)

        return SessionCoachingPlan(
            session_status=session_insights.status,
            recommendations=tuple(recommendations),
            quality_status=getattr(session_insights, "quality_status", None),
        )

