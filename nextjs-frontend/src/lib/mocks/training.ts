import type {
    BodyRegion,
    CoachFeedback,
    Exercise,
    ExerciseCategory,
    Goal,
    GoalCheckpoint,
    GoalStatus,
    Intensity,
    SessionExercise,
    SessionStatus,
    Technique,
    TrainingPlan,
    TrainingSession,
    TrainingType,
} from "@/lib/domain/types";
import { mockVideos } from "./ai";
import { mockFighters } from "./people";
import { createRandom } from "./random";
import { clampPastToday, fromToday, MOCK_ANCHOR_MS, mondayOffset, shiftPastToday } from "./time";

/**
 * Training seed: exercise library, training plans, the session calendar, coach feedback and goals.
 * Everything follows the fighter storylines in ./people.ts and the shared id registry
 * (sessions s-*, plans tp-*, exercises exr-*).
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Exercise library
 * ──────────────────────────────────────────────────────────────────────────── */

type Dose = { rounds: number; roundSec: number } | { sets: number; reps: number };

const HANDS: BodyRegion[] = ["left_hand", "right_hand"];
const SHOULDERS: BodyRegion[] = ["left_shoulder", "right_shoulder"];
const ELBOWS: BodyRegion[] = ["left_elbow", "right_elbow"];
const KNEES: BodyRegion[] = ["left_knee", "right_knee"];
const HIPS: BodyRegion[] = ["left_hip", "right_hip"];
const HAMSTRINGS: BodyRegion[] = ["left_hamstring", "right_hamstring"];
const SHINS: BodyRegion[] = ["left_shin", "right_shin"];
const ANKLES: BodyRegion[] = ["left_ankle", "right_ankle"];

function exercise(
    id: string,
    name: string,
    category: ExerciseCategory,
    intensity: Intensity,
    techniques: Technique[],
    equipment: string[],
    dose: Dose,
    loadsRegions: BodyRegion[],
    description: string,
): Exercise {
    return {
        id,
        name,
        category,
        description,
        techniques,
        intensity,
        equipment,
        defaultRounds: "rounds" in dose ? dose.rounds : null,
        defaultRoundSec: "rounds" in dose ? dose.roundSec : null,
        defaultSets: "sets" in dose ? dose.sets : null,
        defaultReps: "sets" in dose ? dose.reps : null,
        loadsRegions,
    };
}

export const mockExercises: Exercise[] = [
    // Striking
    exercise(
        "exr-jab-cross-hook-pads",
        "Jab–cross–hook pad drill",
        "striking",
        "high",
        ["jab", "cross", "hook", "combination", "guard"],
        ["Đích tay", "Găng boxing", "Băng quấn tay"],
        { rounds: 6, roundSec: 180 },
        [...HANDS, ...SHOULDERS, ...ELBOWS],
        "HLV hô 1-2-3 mở bằng jab. Jab bật ra rồi thu ngay về má, xoay hông sau khi ra cross và kéo tay sau về thủ trước khi hook tay trước chạm đích.",
    ),
    exercise(
        "exr-southpaw-lead-hook-counter",
        "Southpaw lead-hook counter",
        "striking",
        "moderate",
        ["hook", "footwork", "guard"],
        ["Đích tay", "Găng boxing"],
        { rounds: 5, roundSec: 180 },
        ["left_hand", "left_elbow", "left_shoulder"],
        "HLV ra jab thế nghịch (southpaw). Gạt đòn, bước chân trước ra ngoài chân đối thủ, trả hook tay trước rồi xoay người ra khỏi trục trước khi đối thủ về thế.",
    ),
    exercise(
        "exr-teep-roundhouse-bag",
        "Teep & roundhouse kick bag rounds",
        "striking",
        "high",
        ["kick", "footwork"],
        ["Bao cát", "Bảo hộ ống quyển"],
        { rounds: 5, roundSec: 180 },
        [...KNEES, ...HAMSTRINGS, ...SHINS, ...HIPS],
        "Teep để tạo khoảng cách, sau đó bước lệch góc và lật hông khi đá vòng cầu. Thu chân đá về thế ngay, không để chân treo.",
    ),
    exercise(
        "exr-heavy-bag-power-rounds",
        "Heavy bag power rounds",
        "striking",
        "high",
        ["jab", "cross", "hook", "combination"],
        ["Bao cát", "Găng đánh bao", "Băng quấn tay"],
        { rounds: 6, roundSec: 180 },
        [...HANDS, ...SHOULDERS, ...ELBOWS],
        "30 giây ra đòn phối hợp hết lực, 30 giây vừa di chuyển vừa ra jab. Cổ tay thẳng, khớp ngón thẳng hàng, chân đứng vững dưới đòn.",
    ),
    exercise(
        "exr-thai-clinch-knees",
        "Muay Thai clinch knees",
        "striking",
        "high",
        ["combination", "guard"],
        ["Đích đá", "Bạn tập"],
        { rounds: 4, roundSec: 120 },
        [...KNEES, ...HIPS, "neck"],
        "Giành thế ôm cổ hai tay (double-collar) ở bên trong, kéo lệch trọng tâm bạn tập rồi thúc gối thẳng vào đích đá. Khép khuỷu tay để bạn tập không chống ra được.",
    ),
    exercise(
        "exr-technical-shadow-boxing",
        "Technical shadow boxing",
        "striking",
        "low",
        ["jab", "cross", "hook", "combination", "footwork", "guard", "head_movement"],
        [],
        { rounds: 4, roundSec: 180 },
        [],
        "Các hiệp chậm, có chủ đích, mỗi hiệp một chủ đề kỹ thuật. Kết thúc mỗi đòn phối hợp bằng một động tác phòng thủ và đổi góc.",
    ),
    exercise(
        "exr-thai-pad-kick-rounds",
        "Thai pad kick & check rounds",
        "striking",
        "high",
        ["kick", "guard", "footwork"],
        ["Đích Thái", "Bảo hộ ống quyển"],
        { rounds: 5, roundSec: 120 },
        [...KNEES, ...SHINS, ...HIPS, ...HAMSTRINGS],
        "Người cầm đích đổi luân phiên mục tiêu thân và chân, đá trả low kick. Chặn bằng ống quyển, đá phản đòn trong vòng một nhịp.",
    ),
    exercise(
        "exr-controlled-sparring",
        "Controlled sparring rounds",
        "striking",
        "high",
        ["jab", "cross", "hook", "kick", "combination", "footwork", "guard", "head_movement"],
        ["Găng 16 oz", "Mũ bảo hộ", "Bảo hộ ống quyển", "Bọc răng"],
        { rounds: 5, roundSec: 180 },
        ["head", ...HANDS, ...SHINS, "ribs"],
        "Đấu tập kỹ thuật khoảng 60% lực, mỗi hiệp một chủ đề do HLV đặt. HLV dừng hiệp ngay khi có pha trao đổi đòn nặng.",
    ),
    // Defense
    exercise(
        "exr-slip-roll-line",
        "Slip-roll line drill",
        "defense",
        "moderate",
        ["head_movement", "guard"],
        ["Dây né"],
        { rounds: 4, roundSec: 120 },
        ["neck", "lower_back"],
        "Di chuyển dọc theo dây: né ra ngoài jab, lăn dưới hook, hạ người bằng gối chứ không gập eo, và trả đòn phản công từ mỗi vị trí.",
    ),
    exercise(
        "exr-parry-catch-counter",
        "Parry-catch-counter partner drill",
        "defense",
        "moderate",
        ["guard", "jab", "cross"],
        ["Găng boxing", "Bạn tập"],
        { rounds: 4, roundSec: 180 },
        SHOULDERS,
        "Bạn tập ra từng đòn đơn ở tốc độ có kiểm soát. Gạt jab, đỡ cross bằng găng và trả lại đúng đòn đó trước khi bạn tập về thế.",
    ),
    exercise(
        "exr-guard-reset-reaction",
        "Guard-reset reaction drill",
        "defense",
        "moderate",
        ["guard", "hook"],
        ["Đích tay", "Gậy xốp"],
        { rounds: 5, roundSec: 120 },
        SHOULDERS,
        "Sau mỗi cú hook tay trước, HLV vung gậy xốp vào bên bị hở. Tay sau phải về áp má trước khi gậy tới.",
    ),
    exercise(
        "exr-kick-catch-defence",
        "Kick catch & sweep defence",
        "defense",
        "moderate",
        ["kick", "guard"],
        ["Bảo hộ ống quyển", "Bạn tập"],
        { rounds: 4, roundSec: 120 },
        [...KNEES, ...ANKLES],
        "Bạn tập đá thân ở nửa tốc độ. Bắt chân, bước ra ngoài và kéo lệch trọng tâm; khi mình bị bắt chân thì nhảy vào, chống tay để gỡ chân ra.",
    ),
    // Footwork
    exercise(
        "exr-pivot-angle-ladder",
        "Pivot-and-angle footwork ladder",
        "footwork",
        "moderate",
        ["footwork"],
        ["Thang dây", "Cọc nấm"],
        { rounds: 4, roundSec: 120 },
        [...ANKLES, ...KNEES],
        "Bước ra vào qua thang dây, rồi xoay trên chân trước sang cọc nấm ở góc 45°. Đứng trên mũi chân và giữ độ rộng thế đứng không đổi.",
    ),
    exercise(
        "exr-cage-cutting-footwork",
        "Cage-cutting footwork",
        "footwork",
        "moderate",
        ["footwork", "guard"],
        ["Lồng đấu", "Bạn tập"],
        { rounds: 4, roundSec: 180 },
        ANKLES,
        "Bạn tập chạy vòng quanh lồng; chặn đường bằng bước ngang thay vì đuổi theo, dồn bạn tập vào lưới mà không bắt chéo chân.",
    ),
    exercise(
        "exr-footwork-shadow-rounds",
        "Footwork-only shadow rounds",
        "footwork",
        "low",
        ["footwork"],
        [],
        { rounds: 4, roundSec: 120 },
        ANKLES,
        "Hai tay giữ thủ, không ra đòn. Các hiệp luân phiên thoát góc, bước ngang và đổi nhịp theo hiệu lệnh của HLV.",
    ),
    // Grappling
    exercise(
        "exr-wall-walk-shots",
        "Wall-walk wrestling shots",
        "grappling",
        "high",
        [],
        ["Đệm tường", "Thảm"],
        { sets: 4, reps: 8 },
        ["neck", "lower_back", ...KNEES],
        "Hạ trọng tâm, bước lao (penetration step) xuống gối rồi vịn tay leo tường để đứng thẳng lên. Ngẩng đầu, lưng thẳng, hông nằm dưới vai.",
    ),
    exercise(
        "exr-hip-escape-chains",
        "Hip-escape (shrimp) chains",
        "grappling",
        "moderate",
        [],
        ["Thảm"],
        { sets: 4, reps: 10 },
        ["lower_back", ...HIPS],
        "Shrimp liên tục hết chiều dài thảm, lần nào cũng chống tay vào đối thủ tưởng tượng. Kết thúc bằng lấy lại guard hoặc vào single leg.",
    ),
    exercise(
        "exr-double-leg-chain",
        "Double-leg to single-leg chain",
        "grappling",
        "high",
        [],
        ["Thảm", "Bạn tập"],
        { rounds: 5, roundSec: 180 },
        ["neck", "lower_back", ...KNEES],
        "Lao vào double leg; khi bạn tập sprawl thì chuyển sang single leg, chạy pipe hoặc ngáng cổ chân xa. Bạn tập tăng dần độ kháng cự.",
    ),
    exercise(
        "exr-guard-retention-rounds",
        "Guard retention positional rounds",
        "grappling",
        "moderate",
        [],
        ["Thảm", "Bạn tập"],
        { rounds: 6, roundSec: 240 },
        ["neck", ...HIPS, ...HAMSTRINGS],
        "Các hiệp 4 phút bắt đầu từ open guard. Người ở trên ghi điểm khi qua được guard; người ở dưới làm lại khi sweep được hoặc lấy lại guard.",
    ),
    exercise(
        "exr-pressure-passing-drill",
        "Pressure passing (knee-cut) drilling",
        "grappling",
        "low",
        [],
        ["Thảm", "Bạn tập"],
        { sets: 4, reps: 8 },
        ["neck", ...KNEES],
        "Tập chậm đòn qua guard knee-cut với bạn tập không kháng cự. Crossface nặng, giành underhook trước, giữ chắc side control rồi mới làm tiếp.",
    ),
    exercise(
        "exr-grip-fighting-uchi-mata",
        "Grip fighting & uchi-mata entries",
        "grappling",
        "moderate",
        ["footwork"],
        ["Võ phục (gi)", "Thảm", "Bạn tập"],
        { rounds: 5, roundSec: 180 },
        [...HANDS, "lower_back", ...HAMSTRINGS],
        "Thắng cuộc tranh nắm tay áo và cổ áo, rồi vào uchi-mata theo bước chân của bạn tập. Tập uchi-komi trước, quật thật ở hai hiệp cuối.",
    ),
    exercise(
        "exr-cage-wall-getups",
        "Cage wall get-ups",
        "grappling",
        "high",
        ["footwork"],
        ["Lồng đấu", "Bạn tập"],
        { rounds: 5, roundSec: 120 },
        ["lower_back", ...KNEES, "neck"],
        "Bắt đầu ngồi tựa lưới, bạn tập ôm chân. Leo tường đứng dậy, giành kiểm soát cổ tay và thoát ra khoảng trống trước khi bạn tập lao vào lại.",
    ),
    // Conditioning
    exercise(
        "exr-assault-bike-intervals",
        "Assault bike intervals",
        "conditioning",
        "high",
        [],
        ["Xe đạp gió"],
        { rounds: 10, roundSec: 30 },
        [...KNEES, ...HIPS],
        "30 giây đạp hết sức, 90 giây đạp nhẹ. Công suất mục tiêu lấy theo bài kiểm tra thể lực gần nhất của võ sĩ.",
    ),
    exercise(
        "exr-skipping-rope-rounds",
        "Skipping rope rounds",
        "conditioning",
        "moderate",
        ["footwork"],
        ["Dây nhảy"],
        { rounds: 3, roundSec: 180 },
        [...ANKLES, ...SHINS],
        "Các hiệp 3 phút xen kẽ nhảy đôi (double-under), nhảy kiểu boxer và nâng cao gối. Chân nhẹ, khép khuỷu tay.",
    ),
    exercise(
        "exr-sprawl-sprint-intervals",
        "Sprawl-and-sprint intervals",
        "conditioning",
        "high",
        ["footwork"],
        ["Thảm"],
        { rounds: 6, roundSec: 30 },
        ["lower_back", ...HIPS, ...HANDS],
        "Nghe còi thì sprawl, đứng dậy và chạy nước rút 10 mét. Lần sprawl nào hông cũng phải chạm thảm; đi bộ hồi phục hoàn toàn giữa các hiệp.",
    ),
    // Strength
    exercise(
        "exr-trap-bar-deadlift",
        "Trap-bar deadlift",
        "strength",
        "high",
        [],
        ["Thanh tạ lục giác", "Bánh tạ cao su"],
        { sets: 4, reps: 5 },
        ["lower_back", ...HAMSTRINGS, ...KNEES, ...HANDS],
        "Các set chính ở 80–85% 1RM ước tính. Gồng bụng trước mỗi lần, đạp mạnh xuống sàn và dừng khi còn dư hai lần mới tới giới hạn.",
    ),
    exercise(
        "exr-kettlebell-swings",
        "Kettlebell swings",
        "strength",
        "moderate",
        [],
        ["Tạ ấm"],
        { sets: 5, reps: 15 },
        ["lower_back", ...HAMSTRINGS, ...HANDS],
        "Gập hông dứt khoát, bật hông và để tạ bay lên ngang ngực. Duỗi hông bùng nổ, hỗ trợ trực tiếp cho đòn đá và đòn gối.",
    ),
    exercise(
        "exr-bulgarian-split-squat",
        "Bulgarian split squat",
        "strength",
        "moderate",
        [],
        ["Tạ đơn", "Ghế tập"],
        { sets: 3, reps: 8 },
        [...KNEES, ...HIPS],
        "Chân sau gác lên ghế, hạ người có kiểm soát trong 3 giây. Gối đi theo hướng các ngón chân giữa; số lần mỗi chân như nhau.",
    ),
    exercise(
        "exr-weighted-pull-ups",
        "Weighted pull-ups",
        "strength",
        "moderate",
        [],
        ["Xà đơn", "Đai đeo tạ"],
        { sets: 4, reps: 6 },
        [...SHOULDERS, ...ELBOWS, ...HANDS],
        "Từ treo thẳng tay kéo lên đến khi cằm qua xà, hạ chậm. Xây sức kéo dùng khi clinch và khi tranh nắm.",
    ),
    exercise(
        "exr-nordic-hamstring-curls",
        "Nordic hamstring curls",
        "strength",
        "moderate",
        [],
        ["Thảm", "Bạn tập hoặc chỗ móc chân"],
        { sets: 3, reps: 5 },
        [...HAMSTRINGS, ...KNEES],
        "Từ tư thế quỳ, duỗi hông và hạ người thật chậm. Bài tăng sức chịu đựng cơ đùi sau cho người hay đá và người vật.",
    ),
    exercise(
        "exr-neck-bridges-isometric",
        "Neck bridges (isometric)",
        "strength",
        "low",
        [],
        ["Thảm"],
        { sets: 3, reps: 5 },
        ["neck"],
        "Giữ cầu cổ trước và sau 20 giây mỗi lần, dồn trọng lượng lên trán và bàn chân. Tăng sức cổ để tự bảo vệ khi clinch và tranh chấp vị trí.",
    ),
    exercise(
        "exr-band-pull-aparts",
        "Band pull-aparts",
        "strength",
        "low",
        [],
        ["Dây kháng lực"],
        { sets: 3, reps: 20 },
        SHOULDERS,
        "Tay thẳng, siết hai bả vai và kéo dây về ngang ngực. Cân bằng lại khối lượng đẩy từ các đòn đấm.",
    ),
    // Mobility
    exercise(
        "exr-thoracic-mobility-flow",
        "Thoracic mobility flow",
        "mobility",
        "low",
        [],
        ["Con lăn xốp", "Thảm"],
        { sets: 2, reps: 10 },
        [],
        "Ngả lưng trên con lăn, mở sách (open book) và xoay luồn kim (thread-the-needle). Phục hồi độ xoay thân cho đòn tay sau.",
    ),
    exercise(
        "exr-hip-90-90-flow",
        "Hip 90/90 mobility flow",
        "mobility",
        "low",
        [],
        ["Thảm"],
        { sets: 2, reps: 8 },
        HIPS,
        "Chuyển tư thế ngồi 90/90, dừng ở biên độ cuối, sau đó làm hip airplane. Giữ hông mở cho đòn đá và guard.",
    ),
    exercise(
        "exr-shoulder-cars",
        "Shoulder CARs & scapular control",
        "mobility",
        "low",
        [],
        ["Thảm"],
        { sets: 2, reps: 5 },
        SHOULDERS,
        "Xoay khớp vai chậm, có kiểm soát trong toàn bộ biên độ không đau, sau đó trượt tay trên tường. Dừng ngay trước khi thấy cấn khớp.",
    ),
];

/* ────────────────────────────────────────────────────────────────────────────
 * Training plans
 * ──────────────────────────────────────────────────────────────────────────── */

const RAFAEL = "c-rafael-costa";
const ANNA = "c-anna-volkova";
const JAMES = "c-james-okafor";

interface PlanSpec extends Omit<TrainingPlan, "startDate" | "endDate" | "createdAt" | "updatedAt"> {
    /** Day offsets relative to today (negative = past). */
    startDay: number;
    endDay: number;
    updatedDay: number;
    /** Day the plan was written when it responds to an event; defaults to four days before the start. */
    createdDay?: number;
    /** Local wall-clock time of the last update; defaults to 16:45. */
    updatedTime?: { hour: number; minute: number };
}

const planSpecs: PlanSpec[] = [
    {
        id: "tp-minh-fight-camp",
        title: "Trại thi đấu — Lotus Fight Night 18",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        objective: "Đạt phong độ đỉnh cho Lotus Fight Night 18: mài sắc pha vào jab-cross và sửa lỗi thu thủ sau hook tay trước.",
        phase: "fight_camp",
        focusAreas: ["hook", "guard", "jab", "cross"],
        startDay: -28,
        endDay: 41,
        weeklySessionTarget: 7,
        status: "active",
        notes: "Arman Petrosyan đánh thế nghịch, kiểu ép sát — tập phản đòn hook tay trước hai buổi mỗi tuần. Cân nặng sinh hoạt 67,5 kg trước tuần thi đấu (dinh dưỡng làm cùng James). Đấu tập tối đa 5 × 3 phút cho đến tuần nặng cuối cùng.",
        updatedDay: -3,
    },
    {
        id: "tp-minh-build",
        title: "Giai đoạn tích luỹ — đòn thẳng và di chuyển",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        objective: "Tăng tốc độ jab và cross, chỉnh lại bước ra vào trước trại thi đấu Lotus Fight Night 18.",
        phase: "build",
        focusAreas: ["jab", "cross", "footwork"],
        startDay: -91,
        endDay: -29,
        weeklySessionTarget: 6,
        status: "completed",
        notes: "Tốc độ đỉnh của jab tăng từ 7,0 lên 7,6 m/s trong giai đoạn này. Kỹ thuật hook chuyển sang trại thi đấu làm điểm sửa chính.",
        updatedDay: -29,
    },
    {
        id: "tp-lucas-return",
        title: "Trở lại tập luyện — đùi sau trái",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        objective:
            "Xây lại khối lượng tập trong phạm vi cấp phép có hạn chế khi đùi sau trái đang lành: kỹ thuật thế trên, sức mạnh thân trên và nền tảng sức bền, không đấu tập, không đá.",
        phase: "rehab",
        focusAreas: ["guard", "footwork"],
        startDay: -20,
        endDay: 18,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Theo kế hoạch phục hồi của Dr. Thu Lê. RPE mỗi buổi tối đa 7. Dừng ngay bài nào làm đùi sau đau quá 2/10 và ghi vào ghi chú buổi tập.",
        createdDay: -23,
        updatedDay: -10,
    },
    {
        id: "tp-lucas-fight-camp",
        title: "Trại thi đấu — Jungle Fight Asia 12",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        objective: "Nối các pha vào vật với lấy lưng và giữ guard thật chắc trước đối thủ đánh nhịp cao.",
        phase: "fight_camp",
        focusAreas: ["footwork", "guard"],
        startDay: -66,
        endDay: -24,
        weeklySessionTarget: 6,
        status: "archived",
        notes: "Đã lưu trữ sau ca căng cơ đùi sau trái trong buổi đấu tập 24 ngày trước. Đã rút khỏi trận đấu.",
        updatedDay: -23,
    },
    {
        id: "tp-aigerim-camp",
        title: "Trại thi đấu — Asian Combat Series 9",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        objective:
            "Thắng Mai Hoshino bằng phản đòn: biến khả năng di chuyển đầu xuất sắc thành né - trả jab và thoát dây gọn gàng.",
        phase: "fight_camp",
        focusAreas: ["head_movement", "jab", "footwork", "combination"],
        startDay: -43,
        endDay: 27,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Hoshino đấm mật độ cao, hay đổ người vào khi ra jab đôi — đã dặn bạn tập đánh ép. Cân nặng sinh hoạt thoải mái ở 53,6 kg.",
        updatedDay: -6,
    },
    {
        id: "tp-kenji-technical",
        title: "Giai đoạn kỹ thuật — vào đòn khi đổi thế",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        objective:
            "Hoàn thiện vào đòn khi đổi thế và kỹ thuật tay sau; sau ghi nhận ở vai phải, xây lại cú cross mà vai không bị nhô lên.",
        phase: "build",
        focusAreas: ["cross", "footwork", "kick", "guard"],
        startDay: -49,
        endDay: 35,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Cập nhật sau cấp phép có hạn chế 7 ngày trước: RPE tối đa 8 và bảo vệ vai phải. Bỏ đấu tập và khối lượng cross lớn; tập trung vào đòn đá, di chuyển và tay trước cho đến lần tái khám.",
        updatedDay: -7,
    },
    {
        id: "tp-diego-build",
        title: "Giai đoạn tích luỹ — phòng thủ đánh đứng khi vào vật",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        objective:
            "Siết chặt phòng thủ đánh đứng cho một võ sĩ vật đánh ép: giữ thủ cao và đưa đầu ra khỏi trục giữa khi lao vào double leg.",
        phase: "build",
        focusAreas: ["guard", "head_movement", "footwork", "jab"],
        startDay: -45,
        endDay: 39,
        weeklySessionTarget: 4,
        status: "active",
        notes: "Tạm dừng — Chưa được phép tập sau chấn động não trong buổi đấu tập 6 ngày trước. Không xếp lại lịch tập cho đến khi Dr. Thu Lê cho phép theo quy trình trở lại từng bước.",
        updatedDay: -6,
        updatedTime: { hour: 20, minute: 5 },
    },
    {
        id: "tp-linh-championship",
        title: "Chuẩn bị giải vô địch — tay theo kịp chân",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        objective:
            "Vietnam Amateur MMA Championship: đưa đòn tay lên ngang tầm đòn đá — độ chính xác đòn đấm trên đích và phối hợp đấm - đá.",
        phase: "build",
        focusAreas: ["jab", "cross", "combination", "kick"],
        startDay: -44,
        endDay: 62,
        weeklySessionTarget: 4,
        status: "active",
        notes: "Bốn buổi mỗi tuần xếp quanh lịch học đại học, trong đó có một buổi đích chuyên boxing. Chuyển sang cấu trúc trại thi đấu khi còn sáu tuần.",
        updatedDay: -12,
    },
    {
        id: "tp-marcus-rehab-conditioning",
        title: "Gãy xương tay — thể lực và di chuyển",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        objective:
            "Giữ thể lực và di chuyển sắc trong lúc xương tay phải lành: sức mạnh thân dưới, nền tảng sức bền và di chuyển, không ra đòn.",
        phase: "rehab",
        focusAreas: ["footwork"],
        startDay: -9,
        endDay: 31,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Cấp phép có hạn chế: không bao cát, không đích, không đấu tập và không đấm. Không nắm bằng tay phải — dùng áo tạ thay cho tạ đơn.",
        createdDay: -10,
        updatedDay: -9,
    },
    {
        id: "tp-marcus-power-build",
        title: "Tích luỹ sức mạnh — kickboxing",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        objective: "Tăng lực cho cross tay phải và đá thân chân trái mà vẫn giữ mật độ đòn cao suốt năm hiệp.",
        phase: "build",
        focusAreas: ["cross", "kick", "combination"],
        startDay: -60,
        endDay: -11,
        weeklySessionTarget: 5,
        status: "archived",
        notes: "Đóng sớm: gãy xương bàn ngón 5 tay phải khi đánh bao cát 11 ngày trước.",
        updatedDay: -10,
    },
    {
        id: "tp-sofia-camp",
        title: "Trại thi đấu — Lotus Fight Night 17",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        objective:
            "Vào clinch trước Renata Lima: áp sát sau jab và kết thúc pha vào bằng đòn quật judo ở lưới.",
        phase: "fight_camp",
        focusAreas: ["jab", "footwork", "guard", "combination"],
        startDay: -47,
        endDay: 19,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Đến hạn khám trước thi đấu — cấp phép hết hạn sau 5 ngày. Giảm tải bắt đầu từ 7 ngày trước trận.",
        updatedDay: -2,
    },
    {
        id: "tp-sofia-build",
        title: "Giai đoạn tích luỹ — vào đòn đánh đứng cho võ sĩ judo",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        objective: "Xây cú jab đáng tin cậy và đường vào clinch an toàn để judo làm phần còn lại.",
        phase: "build",
        focusAreas: ["jab", "footwork", "guard"],
        startDay: -103,
        endDay: -48,
        weeklySessionTarget: 5,
        status: "completed",
        notes: "Số pha vào mở bằng jab tăng từ 3 lên 5 mỗi hiệp. Chuyển tiếp sang trại thi đấu.",
        updatedDay: -48,
    },
    {
        id: "tp-hoang-camp",
        title: "Trại thi đấu — Lotus Fight Night 17",
        fighterId: "f-hoang-long",
        coachId: ANNA,
        objective:
            "Thắng Pedro Santos ở cự ly xa: mài sắc pha vào đòn đá Vovinam trong lúc giảm cân về 56,7 kg và kiểm soát tình trạng căng lưng dưới.",
        phase: "fight_camp",
        focusAreas: ["kick", "footwork", "head_movement", "combination"],
        startDay: -47,
        endDay: 19,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Căng lưng dưới: buổi nào cũng có bài linh hoạt và không gập hông nặng đến hết trại. Bù nước mới ở mức tạm — James theo dõi cân nặng và lượng nước uống mỗi ngày.",
        updatedDay: -4,
    },
    {
        id: "tp-tariq-return",
        title: "Trở lại boxing — gối trái",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        objective:
            "Trở lại chuyên môn sau bong gân dây chằng bên trong (MCL) gối trái: xây lại khối lượng đích và bao cát với các cú xoay có kiểm soát, không đá, không đấu tập cho đến khi được cấp phép đầy đủ.",
        phase: "rehab",
        focusAreas: ["jab", "cross", "guard", "head_movement"],
        startDay: -34,
        endDay: 20,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Xoay trên chân phải; không lunge ngang sâu. Được đấm đích tay tốc độ tối đa từ khi có cấp phép có hạn chế 5 ngày trước (RPE tối đa 8).",
        updatedDay: -5,
    },
    {
        id: "tp-tariq-power-build",
        title: "Tích luỹ sức mạnh — boxing hạng nặng",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        objective: "Mài sắc jab-cross và tăng lực thân dưới mà không mất tốc độ tay ở hạng nặng.",
        phase: "build",
        focusAreas: ["jab", "cross", "head_movement"],
        startDay: -74,
        endDay: -38,
        weeklySessionTarget: 5,
        status: "archived",
        notes: "Đóng sớm: bong gân MCL gối trái khi tập sức mạnh 38 ngày trước.",
        updatedDay: -37,
    },
    {
        id: "tp-emma-build",
        title: "Giai đoạn tích luỹ — khối lượng đòn phối hợp",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        objective:
            "Thêm cú đá thân thế nghịch để kết thúc 1-2 và tăng khối lượng đòn phối hợp trước lần xếp trận tranh đai tới.",
        phase: "build",
        focusAreas: ["combination", "kick", "head_movement"],
        startDay: -48,
        endDay: 46,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Giai đoạn này đến giờ ổn định. Giữ đấu tập ở mức kỹ thuật — không đánh hiệp nặng cho đến khi trận đấu được xác nhận.",
        updatedDay: -8,
    },
    {
        id: "tp-emma-fight-camp",
        title: "Trại thi đấu — Lotus Fight Night 16",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        objective: "Thắng ở cự ly xa trước võ sĩ đánh ép: teep và xoay thoát khỏi lưới, phản đòn bằng cú thẳng tay trái.",
        phase: "fight_camp",
        focusAreas: ["kick", "footwork", "cross"],
        startDay: -118,
        endDay: -55,
        weeklySessionTarget: 6,
        status: "completed",
        notes: "Thắng điểm tuyệt đối. Một tuần hồi phục chủ động trước giai đoạn tích luỹ.",
        updatedDay: -54,
    },
    {
        id: "tp-bao-foundations",
        title: "Nền tảng — 8 tuần đầu",
        fighterId: "f-bao-nguyen",
        coachId: ANNA,
        objective:
            "Xây kỹ năng cơ bản cho võ sĩ nghiệp dư hạng bán nặng: thế đứng, jab-cross, phòng thủ sprawl và mức sức mạnh ban đầu.",
        phase: "base",
        focusAreas: ["jab", "cross", "footwork", "guard"],
        startDay: 3,
        endDay: 59,
        weeklySessionTarget: 4,
        status: "draft",
        notes: "Bản nháp — kích hoạt khi Dr. Samuel Brooks khám thể lực ban đầu xong và đã có Cấp phép y tế trong hồ sơ.",
        updatedDay: -1,
    },
    // Camps linked to the demo bouts in services/bouts.demo.ts. Listed last so sessions keep their earlier plans.
    {
        id: "tp-kenji-fight-camp",
        title: "Trại thi đấu — Pacific Invitational 4",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        objective: "Về 56 kg cho Pacific Invitational 4 mà không mất các pha vào đòn khi đổi thế; tiếp tục bảo vệ vai phải.",
        phase: "fight_camp",
        focusAreas: ["footwork", "cross", "guard"],
        startDay: -35,
        endDay: 4,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Rủi ro của trại này là cân nặng, không phải đối thủ. Sáng nào cũng lên cân và báo lại.",
        updatedDay: -2,
    },
    {
        id: "tp-emma-nordic-camp",
        title: "Trại thi đấu — Nordic Open 12",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        objective: "Đạt phong độ đỉnh cho Nordic Open 12: khối lượng đòn phối hợp nối cú đá thân thế nghịch.",
        phase: "fight_camp",
        focusAreas: ["combination", "kick"],
        startDay: -30,
        endDay: 6,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Đối thủ vẫn chờ ban tổ chức xác nhận.",
        updatedDay: -4,
    },
    {
        id: "tp-linh-fight-camp",
        title: "Trại thi đấu — Saigon Amateur Night 5",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        objective: "Trận khởi động trước giải vô địch: luyện đòn tay sau đòn đá khi bị ép.",
        phase: "fight_camp",
        focusAreas: ["jab", "cross", "kick"],
        startDay: -28,
        endDay: 0,
        weeklySessionTarget: 4,
        status: "active",
        notes: "Trận này theo luật boxing nghiệp dư: không được đá trong trận.",
        updatedDay: -5,
    },
];

export const mockTrainingPlans: TrainingPlan[] = planSpecs.map(({ startDay, endDay, updatedDay, createdDay, updatedTime, ...plan }) => ({
    ...plan,
    startDate: fromToday(startDay, 0, 0),
    endDate: fromToday(endDay, 23, 59),
    createdAt: clampPastToday(fromToday(createdDay ?? Math.min(startDay - 4, updatedDay), 14, 20)),
    updatedAt: clampPastToday(fromToday(updatedDay, updatedTime?.hour ?? 16, updatedTime?.minute ?? 45)),
}));

/** The non-draft plan covering a fighter's training day, if any. */
function planIdFor(fighterId: string, day: number): string | null {
    const plan = planSpecs.find(
        (p) => p.fighterId === fighterId && p.status !== "draft" && p.startDay <= day && day <= p.endDay,
    );
    return plan?.id ?? null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Session blueprints
 * ──────────────────────────────────────────────────────────────────────────── */

/** Which specialist runs a session. Falls back to the fighter's primary coach when not assigned. */
type CoachRole = "striking" | "grappling" | "sc";

const COACH_BY_ROLE: Record<CoachRole, string> = { striking: RAFAEL, grappling: ANNA, sc: JAMES };

function rounds(exerciseId: string, count: number, roundSec: number, notes: string | null = null): SessionExercise {
    return { exerciseId, rounds: count, roundSec, sets: null, reps: null, notes, completed: false };
}

function sets(exerciseId: string, count: number, reps: number, notes: string | null = null): SessionExercise {
    return { exerciseId, rounds: null, roundSec: null, sets: count, reps, notes, completed: false };
}

interface Blueprint {
    type: TrainingType;
    title: string;
    coach: CoachRole;
    durationMin: number;
    targetRpe: number;
    location: string;
    exercises: SessionExercise[];
    /** Coach notes used as the result summary when the session is completed. */
    summaries: string[];
}

const BLUEPRINTS = {
    muayThaiPads: {
        type: "pad_work",
        title: "Đích Thái — vào đòn jab-cross-hook",
        coach: "striking",
        durationMin: 75,
        targetRpe: 8,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-technical-shadow-boxing", 2, 180),
            rounds("exr-jab-cross-hook-pads", 6, 180),
            rounds("exr-thai-pad-kick-rounds", 3, 120),
            rounds("exr-thai-clinch-knees", 3, 120),
        ],
        summaries: [
            "Vào đòn sau jab gọn gàng. Hook tay trước vẫn kéo tay phải rời má khi thoát ra — hai hiệp cuối tập riêng phần thu thủ.",
            "Giữ nhịp tốt qua mọi hiệp. Đòn đá vào đúng nhịp sau cross; gối trong clinch mạnh nhưng buông ôm cổ quá sớm.",
            "Sắc hơn buổi trước. Tay phải giữ thủ tốt với hook đơn nhưng vẫn rơi khi ra 1-2-3 tốc độ tối đa.",
            "Đuối ở hiệp đích cuối và bắt đầu lấy đà quá nhiều cho cross. Mệt thì càng phải giữ jab liên tục.",
        ],
    },
    boxingPads: {
        type: "pad_work",
        title: "Đấm đích tay — né và phản đòn",
        coach: "striking",
        durationMin: 60,
        targetRpe: 8,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-skipping-rope-rounds", 2, 180),
            rounds("exr-jab-cross-hook-pads", 6, 180),
            rounds("exr-slip-roll-line", 3, 120),
        ],
        summaries: [
            "Né đòn trả của đích gọn và trả jab đúng lúc. Hiệp năm chân hơi bẹt, đứng cả bàn.",
            "Jab bật tốt. Cross vào đẹp nhất khi xoay gót chân sau — mệt vẫn phải giữ.",
            "Các hiệp chắc. Lần nào được hô cũng lăn dưới hook và trả lại tay phải.",
            "Hai hiệp cuối tay rơi khi thoát ra. Tay sau về cằm rồi mới bước ra.",
        ],
    },
    kickPads: {
        type: "pad_work",
        title: "Đích Thái — phối hợp đấm và đá",
        coach: "striking",
        durationMin: 60,
        targetRpe: 8,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-technical-shadow-boxing", 2, 180),
            rounds("exr-thai-pad-kick-rounds", 5, 120),
            rounds("exr-jab-cross-hook-pads", 4, 180),
        ],
        summaries: [
            "Đòn đá sắc. Jab trước cú đá còn lười — phải là đòn thật, không phải chỉ để đo khoảng cách.",
            "Các hiệp cuối vào 1-2 nối đá thân đều đặn. Thu về thế tốt.",
            "Chặn hết các cú low kick người cầm đích đá trả. Độ chính xác đòn đấm giảm khi phối hợp dài quá ba đòn.",
            "Tinh thần rất tốt. Kết thúc phối hợp bằng một bước ra khỏi trục, đừng đứng ngay trước mặt sau cú đá.",
        ],
    },
    heavyBag: {
        type: "heavy_bag",
        title: "Bao cát — các hiệp lực và khối lượng",
        coach: "striking",
        durationMin: 60,
        targetRpe: 8,
        location: "Phòng đánh đứng",
        exercises: [rounds("exr-skipping-rope-rounds", 3, 180), rounds("exr-heavy-bag-power-rounds", 6, 180)],
        summaries: [
            "Khối lượng tốt, khoảng 90 đòn mỗi hiệp. Phối hợp ngắn gọn, sau mỗi chuỗi đều di chuyển ra.",
            "Cross có lực tốt; hook vẫn hơi vòng. Hai hiệp cuối đã rút ngắn lại.",
            "Nhịp đều. Cổ tay và trục đòn tốt, kiểm soát hơi thở suốt sáu hiệp.",
            "Mật độ đòn giảm ở hiệp năm và sáu nhưng kỹ thuật vẫn giữ. Thể lực đang đúng tiến độ.",
        ],
    },
    kickBag: {
        type: "heavy_bag",
        title: "Bao cát đá — teep và đá vòng cầu",
        coach: "striking",
        durationMin: 60,
        targetRpe: 8,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-skipping-rope-rounds", 2, 180),
            rounds("exr-teep-roundhouse-bag", 5, 180),
            rounds("exr-heavy-bag-power-rounds", 3, 180),
        ],
        summaries: [
            "Đá vòng cầu rất có lực. Các hiệp đấm cuối buổi bị ẩu — khuỷu tay bật ra khi ra hook.",
            "Thời điểm ra teep rất tốt. Dùng tay mở đường cho cú đá, đừng đá khi chưa có chuẩn bị.",
            "Cú đá nào cũng xoay hông tốt và về thế nhanh. Mật độ đòn cao suốt cả tám hiệp.",
            "Teep chân trước giờ đã chạm bằng mũi bàn chân. Tay vẫn chậm hơn chân.",
        ],
    },
    sparring: {
        type: "sparring",
        title: "Đấu tập có kiểm soát — 5 × 3 phút",
        coach: "striking",
        durationMin: 60,
        targetRpe: 9,
        location: "Lồng đấu",
        exercises: [rounds("exr-technical-shadow-boxing", 2, 180), rounds("exr-controlled-sparring", 5, 180)],
        summaries: [
            "Các hiệp có kiểm soát, đúng cường độ. Thắng các pha đổi jab; hai lần dính cùng một đòn phản khi lùi thẳng ra sau.",
            "Bình tĩnh khi bị ép. Hiệp ba và bốn dùng góc thoát khỏi lưới tốt.",
            "Đánh sạch. Hai lần vòng vào phía tay mạnh của bạn tập — sẽ tập lại hướng thoát đó trên đích.",
            "Giữ kỹ thuật, không lao vào đánh loạn sau khi dính đòn. Điểm sáng là di chuyển đầu khi vào đòn.",
        ],
    },
    hookTechnique: {
        type: "technical_drilling",
        title: "Luyện kỹ thuật — thu thủ sau hook tay trước",
        coach: "striking",
        durationMin: 60,
        targetRpe: 6,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-guard-reset-reaction", 5, 120),
            rounds("exr-southpaw-lead-hook-counter", 5, 180),
            rounds("exr-pivot-angle-ladder", 3, 120),
        ],
        summaries: [
            "Tập chậm, tập trung. Cuối buổi tay sau về áp má được khoảng bốn trên năm cú hook.",
            "Đầu buổi gậy xốp đánh trúng bên hở khá nhiều, ít hẳn khi hook ngắn lại.",
            "Tập phản đòn thế nghịch sau khi gạt. Thời điểm đã gần đúng; bước ra ngoài chân trước cần sớm hơn.",
        ],
    },
    defenceTechnique: {
        type: "technical_drilling",
        title: "Luyện phòng thủ — né, lăn, phản đòn",
        coach: "striking",
        durationMin: 60,
        targetRpe: 6,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-slip-roll-line", 5, 120),
            rounds("exr-parry-catch-counter", 4, 180),
            rounds("exr-pivot-angle-ladder", 3, 120),
        ],
        summaries: [
            "Di chuyển đầu sắc, đòn phản sau khi lăn đã ra nhanh hơn.",
            "Gạt jab gọn. Đỡ cross quá cao nên bị đẩy ngửa đầu — đỡ ở ngang trán.",
            "Nhịp trên dây né rất tốt, chân luôn nằm dưới trọng tâm.",
            "Các hiệp cuối tự biến cú né thành đòn phản mà không cần nhắc.",
        ],
    },
    kickTechnique: {
        type: "technical_drilling",
        title: "Luyện kỹ thuật — vào đòn đá và chặn đá",
        coach: "striking",
        durationMin: 60,
        targetRpe: 6,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-thai-pad-kick-rounds", 4, 120),
            rounds("exr-kick-catch-defence", 4, 120),
            rounds("exr-pivot-angle-ladder", 3, 120),
        ],
        summaries: [
            "Vào đòn đá đổi chân nhanh, chặn đá lên đúng lúc.",
            "Phòng thủ bắt chân tốt. Khi bị bắt chân thì nhảy vào và chống tay sớm hơn.",
            "Đòn đá vào sau jab nhử chứ không đá khi chưa chuẩn bị. Đá thân xong về thế vẫn chậm một nhịp.",
        ],
    },
    shadowBoxing: {
        type: "shadow_boxing",
        title: "Tập bóng kỹ thuật",
        coach: "striking",
        durationMin: 45,
        targetRpe: 5,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-technical-shadow-boxing", 5, 180),
            rounds("exr-footwork-shadow-rounds", 3, 120),
            sets("exr-thoracic-mobility-flow", 2, 10),
        ],
        summaries: [
            "Các hiệp có chủ đích. Chuỗi đòn nào cũng kết thúc bằng động tác phòng thủ và đổi góc.",
            "Hình dung đối thủ tốt. Độ rộng thế đứng ổn định suốt các hiệp di chuyển.",
            "Vai thả lỏng, tay nhanh. Giữa các chuỗi đòn vẫn giữ thủ cao.",
        ],
    },
    wrestling: {
        type: "grappling",
        title: "Vật — chuỗi double leg và đứng dậy ở lưới",
        coach: "grappling",
        durationMin: 75,
        targetRpe: 8,
        location: "Lồng đấu",
        exercises: [
            sets("exr-wall-walk-shots", 4, 8),
            rounds("exr-double-leg-chain", 5, 180),
            rounds("exr-cage-wall-getups", 4, 120),
        ],
        summaries: [
            "Lao vào sâu, đầu ngẩng. Bạn tập vừa sprawl là chuyển sang single leg ngay.",
            "Đứng dậy ở lưới chắc. Giành kiểm soát cổ tay trước khi đứng, đừng để sau.",
            "Nhịp tốt ở các hiệp vật thật. Pha kết thúc ngáng cổ chân xa cần góc gắt hơn.",
        ],
    },
    bjj: {
        type: "grappling",
        title: "BJJ — các hiệp tình huống giữ guard",
        coach: "grappling",
        durationMin: 90,
        targetRpe: 7,
        location: "Thảm chính",
        exercises: [
            sets("exr-hip-escape-chains", 4, 10),
            rounds("exr-guard-retention-rounds", 6, 240),
            sets("exr-pressure-passing-drill", 3, 8),
        ],
        summaries: [
            "Giữ guard rất tốt — sáu hiệp chỉ bị qua một lần.",
            "Chống tay khi thoát hông gọn. Lần nào người ở trên vòng qua cũng lấy lại được guard.",
            "Đè ở trên tốt. Giữ chắc side control rồi mới tìm đòn khoá.",
        ],
    },
    judo: {
        type: "grappling",
        title: "Judo — tranh nắm và vào uchi-mata",
        coach: "grappling",
        durationMin: 75,
        targetRpe: 8,
        location: "Thảm chính",
        exercises: [
            rounds("exr-grip-fighting-uchi-mata", 6, 180),
            sets("exr-hip-escape-chains", 3, 10),
            rounds("exr-cage-wall-getups", 3, 120),
        ],
        summaries: [
            "Đa số hiệp thắng tranh nắm từ sớm và vào được uchi-mata theo bước chân bạn tập.",
            "Vào đòn quật nhanh. Giữ người thẳng khi bạn tập duỗi thẳng tay chặn nắm cổ áo.",
            "Buổi tập tốt. Đứng dậy ở lưới sau pha quật hỏng nhanh hơn hẳn tuần trước.",
        ],
    },
    grapplingBasics: {
        type: "grappling",
        title: "Vật nền tảng — sprawl, shrimp, đứng dậy",
        coach: "grappling",
        durationMin: 60,
        targetRpe: 6,
        location: "Thảm chính",
        exercises: [
            sets("exr-hip-escape-chains", 4, 10),
            rounds("exr-sprawl-sprint-intervals", 6, 30),
            sets("exr-wall-walk-shots", 3, 6),
        ],
        summaries: [
            "Tiếp thu nhanh. Sprawl đã thấp hơn; hông vẫn chạm thảm hơi muộn.",
            "Kỹ thuật shrimp gọn hơn nhiều. Khép khuỷu tay khi chống.",
            "Thái độ và cường độ tốt. Đứng dậy kỹ thuật vẫn chống nhầm tay.",
        ],
    },
    strength: {
        type: "strength_conditioning",
        title: "Sức mạnh — deadlift trap-bar và bài một chân",
        coach: "sc",
        durationMin: 60,
        targetRpe: 7,
        location: "Khu thể lực",
        exercises: [
            sets("exr-trap-bar-deadlift", 4, 5),
            sets("exr-bulgarian-split-squat", 3, 8),
            sets("exr-weighted-pull-ups", 4, 6),
            sets("exr-neck-bridges-isometric", 3, 5),
            sets("exr-band-pull-aparts", 3, 20),
        ],
        summaries: [
            "Hoàn thành đủ các set chính, tốc độ đẩy tạ tốt. Tăng 5 kg ở set nặng nhất của trap-bar.",
            "Buổi tập chắc. Split squat chậm lại ở set cuối — giữ nguyên mức tạ, tuần sau không tăng.",
            "Set bốn tốc độ tạ giảm nên dừng ở lần thứ ba. Vẫn còn mệt từ buổi đấu tập.",
        ],
    },
    conditioning: {
        type: "strength_conditioning",
        title: "Thể lực — đạp xe ngắt quãng và sprawl",
        coach: "sc",
        durationMin: 45,
        targetRpe: 8,
        location: "Khu thể lực",
        exercises: [
            rounds("exr-assault-bike-intervals", 10, 30),
            rounds("exr-sprawl-sprint-intervals", 6, 30),
            rounds("exr-skipping-rope-rounds", 3, 180),
        ],
        summaries: [
            "Giữ công suất mục tiêu ở cả mười lượt đạp. Nhịp tim hạ tốt giữa các lượt.",
            "Ba lượt đạp cuối công suất giảm khoảng 8%. Sprawl vẫn sắc.",
            "Buổi thể lực tốt — công suất trung bình cao nhất giai đoạn này.",
        ],
    },
    recovery: {
        type: "recovery_mobility",
        title: "Hồi phục và linh hoạt",
        coach: "sc",
        durationMin: 40,
        targetRpe: 3,
        location: "Phòng hồi phục",
        exercises: [
            sets("exr-thoracic-mobility-flow", 2, 10),
            sets("exr-hip-90-90-flow", 2, 8),
            sets("exr-shoulder-cars", 2, 5),
        ],
        summaries: [
            "Buổi giãn cơ nhẹ. Đau mỏi bình thường, ngủ 7,5 giờ.",
            "Đã làm xong bài linh hoạt. Đến set hai hông đã mở tốt.",
            "Hồi phục nhẹ sau một tuần nặng. Cuối buổi xoay thân thấy thoải mái hơn.",
        ],
    },
    taperPads: {
        type: "pad_work",
        title: "Giảm tải — các hiệp đích tay ngắn, sắc",
        coach: "striking",
        durationMin: 40,
        targetRpe: 6,
        location: "Phòng đánh đứng",
        exercises: [rounds("exr-jab-cross-hook-pads", 4, 120), rounds("exr-slip-roll-line", 2, 120)],
        summaries: ["Ngắn và sắc. Thời điểm ra đòn đã sẵn sàng thi đấu.", "Các hiệp gọn, không còn mệt tồn đọng."],
    },
    lucasTopDrilling: {
        type: "technical_drilling",
        title: "Luyện thế trên — không bật hông mạnh",
        coach: "grappling",
        durationMin: 60,
        targetRpe: 5,
        location: "Thảm chính",
        exercises: [
            sets("exr-pressure-passing-drill", 4, 8),
            sets("exr-hip-escape-chains", 3, 10, "Nhịp chậm — dừng nếu đùi sau trái bị kéo căng."),
            sets("exr-thoracic-mobility-flow", 2, 10),
        ],
        summaries: [
            "Tập knee-cut kiên nhẫn với crossface nặng. Không báo triệu chứng ở đùi sau.",
            "Buổi kỹ thuật cường độ thấp. Thoát hông nhịp chậm không đau.",
            "Tập trung tốt vào lực đè ở trên. Đùi sau trái hơi căng ở set thoát hông cuối — đã dừng set đúng kế hoạch.",
        ],
    },
    lucasUpperBody: {
        type: "strength_conditioning",
        title: "Sức mạnh thân trên và thể lực ít va chạm",
        coach: "sc",
        durationMin: 50,
        targetRpe: 6,
        location: "Khu thể lực",
        exercises: [
            sets("exr-weighted-pull-ups", 4, 6),
            sets("exr-band-pull-aparts", 3, 20),
            rounds("exr-assault-bike-intervals", 8, 30, "Ngồi đạp, lực cản vừa — không đứng đạp nước rút."),
        ],
        summaries: [
            "Kéo xà tốt. Các lượt đạp xe đều ngồi, không có triệu chứng ở đùi sau.",
            "Buổi thân trên tốt. Nền tảng sức bền vẫn giữ dù khối lượng giảm.",
            "Hoàn thành đúng kế hoạch. Nhịp tim hồi phục giữa các lượt đạp đang cải thiện.",
        ],
    },
    lucasLightGrappling: {
        type: "grappling",
        title: "BJJ — hiệp tình huống nhẹ (chỉ ở trên)",
        coach: "grappling",
        durationMin: 60,
        targetRpe: 6,
        location: "Thảm chính",
        exercises: [
            sets("exr-pressure-passing-drill", 5, 8),
            sets("exr-hip-escape-chains", 3, 10, "Chỉ tập nhịp có kiểm soát."),
            sets("exr-neck-bridges-isometric", 3, 5),
        ],
        summaries: [
            "Các hiệp chỉ ở trên với nhịp có kiểm soát. Lực đè khi qua guard đã trở lại bình thường.",
            "Tập trong giới hạn — không tranh chấp, không bật cầu mạnh. Đùi sau ổn.",
            "Buổi tập tốt. Bạn tập giữ kháng cự nhẹ như đã thống nhất.",
        ],
    },
    marcusFootwork: {
        type: "technical_drilling",
        title: "Di chuyển chân — tay giữ thủ",
        coach: "striking",
        durationMin: 50,
        targetRpe: 6,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-footwork-shadow-rounds", 5, 120, "Tay phải thả lỏng trong thế thủ — không nắm đấm."),
            rounds("exr-pivot-angle-ladder", 4, 120),
            rounds("exr-cage-cutting-footwork", 3, 180),
        ],
        summaries: [
            "Các hiệp di chuyển sắc. Chặn đường trong lồng bằng bước ngang thay vì đuổi theo.",
            "Xoay trên chân trước tốt. Độ rộng thế đứng ổn định cả khi tăng tốc.",
            "Chất lượng di chuyển cao. Không báo đau ở tay phải.",
        ],
    },
    marcusConditioning: {
        type: "strength_conditioning",
        title: "Thể lực — đạp xe ngắt quãng và sức mạnh thân dưới",
        coach: "striking",
        durationMin: 50,
        targetRpe: 7,
        location: "Khu thể lực",
        exercises: [
            rounds("exr-assault-bike-intervals", 10, 30),
            sets("exr-bulgarian-split-squat", 3, 8, "Chỉ dùng áo tạ — không nắm bằng tay phải."),
            sets("exr-nordic-hamstring-curls", 3, 5),
        ],
        summaries: [
            "Công suất đạp xe giữ tốt. Split squat với áo tạ thấy nhẹ — tuần sau tăng.",
            "Buổi tập tốt. Tay luôn nằm trong nẹp, không chịu lực lần nào.",
            "Các lượt đạp tốt, cả mười lượt đạt công suất mục tiêu.",
        ],
    },
    kenjiKickBag: {
        type: "heavy_bag",
        title: "Bao cát đá — chỉ đá",
        coach: "striking",
        durationMin: 50,
        targetRpe: 7,
        location: "Phòng đánh đứng",
        exercises: [rounds("exr-skipping-rope-rounds", 2, 180), rounds("exr-teep-roundhouse-bag", 6, 180)],
        summaries: [
            "Các hiệp chỉ đá, tay giữ thủ. Vai phải thoải mái suốt buổi.",
            "Đá vòng cầu đổi chân nhanh, nổ to trên bao. Giữ RPE dưới mức trần.",
            "Tập tốt. Thế thủ bên phải thả lỏng chứ không gồng.",
        ],
    },
    kenjiShadow: {
        type: "shadow_boxing",
        title: "Tập bóng — chỉ tay trước và đòn đá",
        coach: "striking",
        durationMin: 45,
        targetRpe: 5,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-technical-shadow-boxing", 4, 180, "Chỉ jab, hook tay trước và đòn đá — không cross."),
            rounds("exr-footwork-shadow-rounds", 3, 120),
            sets("exr-shoulder-cars", 2, 5),
        ],
        summaries: [
            "Các hiệp tay trước gọn. Xoay khớp vai (CARs) không đau trong toàn biên độ.",
            "Đổi thế sau jab tốt. Không báo khó chịu.",
        ],
    },
    kenjiLowerBody: {
        type: "strength_conditioning",
        title: "Sức mạnh thân dưới và đạp xe",
        coach: "striking",
        durationMin: 50,
        targetRpe: 7,
        location: "Khu thể lực",
        exercises: [
            sets("exr-bulgarian-split-squat", 3, 8),
            sets("exr-nordic-hamstring-curls", 3, 5),
            rounds("exr-assault-bike-intervals", 8, 30),
            sets("exr-shoulder-cars", 2, 5),
        ],
        summaries: [
            "Bài thân dưới kiểm soát tốt. Đạp xe ngắt quãng giữ dưới mức trần RPE.",
            "Buổi tập chắc; vai phải không chịu tải lúc nào.",
        ],
    },
    hoangStrength: {
        type: "strength_conditioning",
        title: "Sức mạnh — bài một chân và chuỗi cơ sau (không gập hông nặng)",
        coach: "sc",
        durationMin: 50,
        targetRpe: 6,
        location: "Khu thể lực",
        exercises: [
            sets("exr-bulgarian-split-squat", 3, 8),
            sets("exr-nordic-hamstring-curls", 3, 5),
            sets("exr-band-pull-aparts", 3, 20),
            sets("exr-hip-90-90-flow", 2, 8),
        ],
        summaries: [
            "Giữ mức tạ vừa trong lúc giảm cân. Lưng dưới ổn định suốt các set split squat.",
            "Buổi tập tốt. Năng lượng hơi thấp — cân nặng đang giảm đúng lịch.",
            "Hoàn thành đủ các set. Lưng dưới hơi căng lúc đầu, đỡ hẳn sau bài linh hoạt hông.",
        ],
    },
    tariqUpperBody: {
        type: "strength_conditioning",
        title: "Sức mạnh thân trên và đạp xe",
        coach: "sc",
        durationMin: 50,
        targetRpe: 6,
        location: "Khu thể lực",
        exercises: [
            sets("exr-weighted-pull-ups", 4, 6),
            sets("exr-band-pull-aparts", 3, 20),
            rounds("exr-assault-bike-intervals", 8, 30, "Chỉ ngồi đạp — không đứng đạp."),
        ],
        summaries: [
            "Sức mạnh thân trên giữ tốt. Đạp xe ngắt quãng không đau.",
            "Buổi tập tốt. Gối trái thoải mái khi đạp với lực cản vừa.",
        ],
    },
    tariqControlledPads: {
        type: "pad_work",
        title: "Đấm đích tay — xoay người có kiểm soát",
        coach: "striking",
        durationMin: 50,
        targetRpe: 6,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-jab-cross-hook-pads", 5, 180, "Chỉ xoay trên chân phải — hạn chế vặn gối trái."),
            rounds("exr-parry-catch-counter", 3, 180),
        ],
        summaries: [
            "Tay sắc. Di chuyển theo đường thẳng, có kiểm soát đúng kế hoạch.",
            "Nhịp trên đích tay tốt. Đứng hơi cao để bảo vệ gối — đã nhắc giữ thế.",
            "Năm hiệp nhịp có kiểm soát, gối không có triệu chứng.",
        ],
    },
    baoStriking: {
        type: "technical_drilling",
        title: "Đánh đứng nền tảng — thế đứng, jab, cross",
        coach: "striking",
        durationMin: 60,
        targetRpe: 5,
        location: "Phòng đánh đứng",
        exercises: [
            rounds("exr-technical-shadow-boxing", 4, 180, "Chỉ thế đứng và jab-cross."),
            rounds("exr-jab-cross-hook-pads", 4, 180, "Chỉ jab và cross — chưa tập hook."),
            rounds("exr-footwork-shadow-rounds", 2, 120),
        ],
        summaries: [
            "Thế đứng đã gọn và cân bằng hơn. Jab vẫn đẩy chứ chưa bật.",
            "Những hiệp đích đầu tiên tốt. Ra cross bị hếch cằm — giữ cằm khuất sau vai.",
        ],
    },
    baoStrengthBaseline: {
        type: "strength_conditioning",
        title: "Sức mạnh ban đầu — kỹ thuật và kiểm tra",
        coach: "sc",
        durationMin: 60,
        targetRpe: 6,
        location: "Khu thể lực",
        exercises: [
            sets("exr-trap-bar-deadlift", 3, 5, "Chỉ kỹ thuật và ước tính 1RM."),
            sets("exr-weighted-pull-ups", 3, 5, "Set đầu dùng trọng lượng cơ thể."),
            rounds("exr-assault-bike-intervals", 6, 30),
        ],
        summaries: [
            "Kỹ thuật gập hông tốt so với võ sĩ mới. 1RM trap-bar ước tính khoảng 180 kg.",
            "Nền tảng sức bền dưới mức trung bình của đội — thể lực sẽ là ưu tiên trong giáo án nền tảng.",
        ],
    },
} satisfies Record<string, Blueprint>;

type BlueprintKey = keyof typeof BLUEPRINTS;

/* ────────────────────────────────────────────────────────────────────────────
 * Training sessions
 * ──────────────────────────────────────────────────────────────────────────── */

const MINUTE_MS = 60_000;

function addMinutes(iso: string, minutes: number): string {
    return new Date(Date.parse(iso) + minutes * MINUTE_MS).toISOString();
}

const halfDay = (hour: number) => (hour < 13 ? "am" : "pm");

interface RegistrySessionSpec {
    id: string;
    fighterId: string;
    coachId: string;
    blueprint: BlueprintKey;
    day: number;
    hour: number;
    minute: number;
    title?: string;
    targetRpe?: number;
    exercises?: SessionExercise[];
    /** Completed sessions carry a result; cancelled ones a cancellation reason instead. */
    result?: {
        actualDurationMin: number;
        rpe: number;
        roundsCompleted: number;
        coachRating: number;
        summary: string;
        /** Exercises not finished because the session was stopped. */
        unfinishedExerciseIds?: string[];
    };
    cancellationReason?: string;
    videoIds: string[];
    notes?: string;
}

const NOT_CLEARED_CONCUSSION = "Y tế: chưa được phép tập (quy trình chấn động não)";

/** Sessions referenced by id from the video/AI, medical, notification and audit seeds. */
const registrySessionSpecs: RegistrySessionSpec[] = [
    {
        id: "s-minh-pads-2d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        blueprint: "muayThaiPads",
        day: -2,
        hour: 17,
        minute: 30,
        title: "Đích Thái — 8 hiệp, vào đòn jab-cross-hook",
        exercises: [
            rounds("exr-technical-shadow-boxing", 2, 180),
            rounds("exr-jab-cross-hook-pads", 8, 180),
            rounds("exr-guard-reset-reaction", 3, 120),
        ],
        result: {
            actualDurationMin: 78,
            rpe: 8,
            roundsCompleted: 13,
            coachRating: 4,
            summary:
                "Vào đòn jab-cross sắc suốt tám hiệp đích. Tay phải rời má sau hook tay trước, nặng nhất ở hiệp 6–8 khi bắt đầu mệt. Đã quay từ bên cạnh để AI phân tích.",
        },
        videoIds: ["v-minh-pads-2d"],
        notes: "Quay từ bên cạnh — đủ tám hiệp đích.",
    },
    {
        id: "s-minh-bag-today",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        blueprint: "heavyBag",
        day: 0,
        hour: 7,
        minute: 0,
        title: "Bao cát — các hiệp khối lượng",
        targetRpe: 7,
        result: {
            actualDurationMin: 58,
            rpe: 7,
            roundsCompleted: 9,
            coachRating: 4,
            summary:
                "6 × 3 phút bao cát đều đặn. Hook ngắn hơn và đa số lần tay phải đã về thủ — tốt hơn buổi đích hai hôm trước. Đã tải video lên để phân tích.",
        },
        videoIds: ["v-minh-bag-today"],
    },
    {
        id: "s-minh-sparring-16d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        blueprint: "sparring",
        day: -16,
        hour: 18,
        minute: 0,
        result: {
            actualDurationMin: 62,
            rpe: 9,
            roundsCompleted: 7,
            coachRating: 4,
            summary:
                "Năm hiệp có kiểm soát với bạn tập thế nghịch. Đầu buổi jab làm chủ khoảng cách, nhưng hai lần lùi thẳng ra sau và dính cú trái phản đòn. Ngoài ra giữ bình tĩnh tốt.",
        },
        videoIds: ["v-minh-sparring-16d"],
    },
    {
        id: "s-kenji-bag-9d",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        blueprint: "heavyBag",
        day: -9,
        hour: 17,
        minute: 0,
        result: {
            actualDurationMin: 60,
            rpe: 8,
            roundsCompleted: 9,
            coachRating: 3,
            summary:
                "Khối lượng tốt, nhưng từ hiệp bốn vai phải bị nhô lên khi ra cross và Kenji nói thấy căng. Bỏ cross ở hai hiệp cuối và dặn Kenji báo với Dr. Thu Lê.",
        },
        videoIds: ["v-kenji-bag-9d"],
    },
    {
        id: "s-marcus-bag-11d",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        blueprint: "heavyBag",
        day: -11,
        hour: 16,
        minute: 0,
        result: {
            actualDurationMin: 32,
            rpe: 7,
            roundsCompleted: 6,
            coachRating: 2,
            summary:
                "Dừng ở hiệp 4 bao cát — đau nhói tay phải sau một cú cross. Sưng ở khớp ngón út. Đã chườm đá, nẹp và chuyển Dr. Thu Lê chụp X-quang.",
            unfinishedExerciseIds: ["exr-heavy-bag-power-rounds"],
        },
        videoIds: ["v-marcus-bag-11d"],
        notes: "Buổi tập dừng sớm: chấn thương tay phải ở hiệp 4.",
    },
    {
        id: "s-diego-sparring-6d",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        blueprint: "sparring",
        day: -6,
        hour: 18,
        minute: 0,
        title: "Đấu tập MMA — đánh đứng nối quật ngã",
        result: {
            actualDurationMin: 38,
            rpe: 8,
            roundsCompleted: 4,
            coachRating: 2,
            summary:
                "Dừng ở hiệp 3 sau một pha trao đổi đòn nặng — Diego đứng không vững và lấy lại thủ chậm. Đã cho nghỉ tập và bắt đầu quy trình chấn động não cùng Dr. Thu Lê.",
            unfinishedExerciseIds: ["exr-controlled-sparring"],
        },
        videoIds: ["v-diego-sparring-6d"],
        notes: "Buổi tập dừng ở hiệp 3 (nghi chấn động não).",
    },
    // Cancelled the evening of the concussion (referenced by the audit log seed).
    {
        id: "s-diego-wrestling-5d",
        fighterId: "f-diego-alvarez",
        coachId: ANNA,
        blueprint: "wrestling",
        day: -5,
        hour: 17,
        minute: 0,
        cancellationReason: NOT_CLEARED_CONCUSSION,
        videoIds: [],
    },
    {
        id: "s-diego-pads-4d",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        blueprint: "boxingPads",
        day: -4,
        hour: 17,
        minute: 0,
        cancellationReason: NOT_CLEARED_CONCUSSION,
        videoIds: [],
    },
    {
        id: "s-diego-conditioning-3d",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        blueprint: "conditioning",
        day: -3,
        hour: 9,
        minute: 0,
        cancellationReason: NOT_CLEARED_CONCUSSION,
        videoIds: [],
    },
    {
        id: "s-lucas-sparring-24d",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        blueprint: "sparring",
        day: -24,
        hour: 18,
        minute: 0,
        title: "Đấu tập MMA — các hiệp thiên về vật",
        result: {
            actualDurationMin: 30,
            rpe: 8,
            roundsCompleted: 3,
            coachRating: 2,
            summary:
                "Thấy giật mạnh ở phần trên đùi sau trái khi lao single leg ở hiệp 2. Dừng ngay, chườm đá và băng ép, chuyển Dr. Thu Lê đánh giá.",
            unfinishedExerciseIds: ["exr-controlled-sparring"],
        },
        videoIds: [],
        notes: "Buổi tập dừng ở hiệp 2: đùi sau trái.",
    },
    {
        id: "s-aigerim-pads-3d",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        blueprint: "boxingPads",
        day: -3,
        hour: 16,
        minute: 30,
        result: {
            actualDurationMin: 62,
            rpe: 8,
            roundsCompleted: 11,
            coachRating: 5,
            summary:
                "Buổi di chuyển đầu tốt nhất cả trại — né được đòn trả của đích và trả ngay jab. Vài lần lăn dưới hook bị đứng thẳng hàng hai chân.",
        },
        videoIds: ["v-aigerim-pads-3d"],
    },
    {
        id: "s-linh-bag-5d",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        blueprint: "kickBag",
        day: -5,
        hour: 17,
        minute: 0,
        result: {
            actualDurationMin: 61,
            rpe: 8,
            roundsCompleted: 10,
            coachRating: 4,
            summary:
                "Các hiệp thiên về đá: đá vòng cầu rất có lực, teep vào gọn. Tay lại chậm hơn chân — các hiệp đấm cuối buổi là phần yếu nhất.",
        },
        videoIds: ["v-linh-bag-5d"],
    },
    {
        id: "s-emma-sparring-1d",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        blueprint: "sparring",
        day: -1,
        hour: 18,
        minute: 0,
        result: {
            actualDurationMin: 60,
            rpe: 8,
            roundsCompleted: 7,
            coachRating: 5,
            summary:
                "Các hiệp bình tĩnh, kỹ thuật. Liên tục lăn dưới hook rồi trả 1-2 nối đá thân. Đã quay để AI phân tích.",
        },
        videoIds: ["v-emma-sparring-1d"],
    },
    {
        id: "s-sofia-pads-8d",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        blueprint: "boxingPads",
        day: -8,
        hour: 10,
        minute: 0,
        title: "Đấm đích tay — vào clinch sau jab",
        result: {
            actualDurationMin: 60,
            rpe: 7,
            roundsCompleted: 11,
            coachRating: 4,
            summary:
                "Vào đòn mở bằng jab sắc, áp sát tốt. Tay rơi sau khi tách clinch — các hiệp cuối đã chống tay thoát ra đúng cách.",
        },
        videoIds: ["v-sofia-pads-8d"],
    },
    {
        id: "s-hoang-shadow-7d",
        fighterId: "f-hoang-long",
        coachId: ANNA,
        blueprint: "shadowBoxing",
        day: -7,
        hour: 7,
        minute: 0,
        result: {
            actualDurationMin: 44,
            rpe: 5,
            roundsCompleted: 8,
            coachRating: 3,
            summary:
                "Đòn đá cứng ở phần thân vì lưng dưới lại căng, đòn tay sau thiếu xoay. Buổi sáng sớm — ánh sáng trong phòng kém, quay không rõ.",
        },
        videoIds: ["v-hoang-shadow-7d"],
        notes: "Quay trước khi bật đèn chính.",
    },
    {
        id: "s-tariq-sc-38d",
        fighterId: "f-tariq-haddad",
        coachId: JAMES,
        blueprint: "strength",
        day: -38,
        hour: 8,
        minute: 0,
        title: "Sức mạnh — bài một chân và di chuyển ngang",
        exercises: [
            sets("exr-trap-bar-deadlift", 4, 5),
            sets("exr-bulgarian-split-squat", 3, 8),
            sets("exr-band-pull-aparts", 3, 20),
        ],
        result: {
            actualDurationMin: 35,
            rpe: 6,
            roundsCompleted: 0,
            coachRating: 2,
            summary:
                "Gối trái sụp vào trong ở set split squat thứ ba, đau mặt trong gối. Đã dừng buổi tập, chườm đá và chuyển Dr. Samuel Brooks.",
            unfinishedExerciseIds: ["exr-bulgarian-split-squat", "exr-band-pull-aparts"],
        },
        videoIds: [],
        notes: "Buổi tập dừng: chấn thương gối trái.",
    },
];

function registrySession(spec: RegistrySessionSpec): SeedSession {
    const blueprint: Blueprint = BLUEPRINTS[spec.blueprint];
    const { result } = spec;
    const authoredStart = fromToday(spec.day, spec.hour, spec.minute);
    // Sessions with a result already happened, so a session authored for today starts and ends before the anchor.
    const scheduledAt = result ? clampPastToday(authoredStart) : authoredStart;
    const unfinished = result?.unfinishedExerciseIds ?? [];
    return {
        id: spec.id,
        planId: planIdFor(spec.fighterId, spec.day),
        fighterId: spec.fighterId,
        coachId: spec.coachId,
        title: spec.title ?? blueprint.title,
        type: blueprint.type,
        scheduledAt,
        durationMin: blueprint.durationMin,
        location: blueprint.location,
        targetRpe: spec.targetRpe ?? blueprint.targetRpe,
        status: result ? "completed" : "cancelled",
        exercises: (spec.exercises ?? blueprint.exercises).map((e) => ({
            ...e,
            completed: result !== undefined && !unfinished.includes(e.exerciseId),
        })),
        result: result
            ? {
                  completedAt: clampPastToday(addMinutes(authoredStart, result.actualDurationMin)),
                  actualDurationMin: result.actualDurationMin,
                  rpe: result.rpe,
                  roundsCompleted: result.roundsCompleted,
                  coachRating: result.coachRating,
                  summary: result.summary,
              }
            : null,
        videoIds: spec.videoIds,
        cancellationReason: result ? null : (spec.cancellationReason ?? null),
        notes: spec.notes ?? null,
    };
}

/* Weekly templates: [blueprint, hour, minute] per weekday (academy local time). */

type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
type Slot = readonly [BlueprintKey, number, number];
type WeekTemplate = Partial<Record<Weekday, Slot[]>>;

const WEEKDAYS: readonly Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const MINH_CAMP: WeekTemplate = {
    mon: [["strength", 8, 0], ["muayThaiPads", 17, 30]],
    tue: [["wrestling", 17, 0]],
    wed: [["heavyBag", 7, 0], ["hookTechnique", 17, 30]],
    fri: [["sparring", 18, 0]],
    sat: [["muayThaiPads", 9, 30]],
};
const LUCAS_CAMP: WeekTemplate = {
    mon: [["bjj", 17, 0]],
    tue: [["strength", 8, 0]],
    wed: [["wrestling", 17, 0]],
    thu: [["sparring", 18, 0]],
    fri: [["conditioning", 8, 0]],
};
const LUCAS_EARLY_REHAB: WeekTemplate = {
    mon: [["lucasUpperBody", 9, 0]],
    tue: [["recovery", 10, 0]],
    thu: [["lucasTopDrilling", 17, 0]],
    fri: [["lucasUpperBody", 9, 0]],
};
const LUCAS_REHAB: WeekTemplate = {
    mon: [["lucasUpperBody", 9, 0]],
    tue: [["lucasTopDrilling", 17, 0]],
    thu: [["lucasLightGrappling", 17, 0]],
    fri: [["lucasUpperBody", 9, 0]],
    sat: [["recovery", 10, 0]],
};
const AIGERIM_CAMP: WeekTemplate = {
    mon: [["boxingPads", 16, 30]],
    tue: [["conditioning", 8, 0]],
    wed: [["defenceTechnique", 16, 30]],
    thu: [["heavyBag", 16, 30]],
    fri: [["sparring", 18, 0]],
};
const KENJI_BUILD: WeekTemplate = {
    mon: [["kickBag", 17, 0]],
    wed: [["heavyBag", 17, 0]],
    thu: [["kickTechnique", 17, 0]],
    fri: [["sparring", 18, 0]],
};
const KENJI_RESTRICTED: WeekTemplate = {
    mon: [["kenjiKickBag", 17, 0]],
    tue: [["kenjiLowerBody", 8, 0]],
    wed: [["kickTechnique", 17, 0]],
    thu: [["kenjiShadow", 7, 30]],
    fri: [["recovery", 10, 0]],
};
const DIEGO_BUILD: WeekTemplate = {
    mon: [["wrestling", 17, 0]],
    tue: [["boxingPads", 17, 0]],
    thu: [["wrestling", 17, 0]],
    fri: [["sparring", 18, 0]],
};
const LINH_BUILD: WeekTemplate = {
    mon: [["kickPads", 17, 0]],
    wed: [["boxingPads", 17, 0]],
    thu: [["kickBag", 17, 0]],
    fri: [["sparring", 18, 0]],
};
const MARCUS_BUILD: WeekTemplate = {
    mon: [["kickPads", 16, 0]],
    tue: [["strength", 8, 0]],
    wed: [["heavyBag", 16, 0]],
    thu: [["kickTechnique", 16, 0]],
    fri: [["sparring", 18, 0]],
};
const MARCUS_REHAB: WeekTemplate = {
    mon: [["marcusFootwork", 16, 0]],
    tue: [["marcusConditioning", 8, 0]],
    thu: [["marcusFootwork", 16, 0]],
    fri: [["marcusConditioning", 8, 0]],
    sat: [["recovery", 10, 0]],
};
const SOFIA_CAMP: WeekTemplate = {
    mon: [["judo", 10, 0]],
    tue: [["boxingPads", 10, 0]],
    wed: [["wrestling", 10, 0]],
    thu: [["conditioning", 8, 0]],
    fri: [["sparring", 17, 0]],
};
const HOANG_CAMP: WeekTemplate = {
    mon: [["kickPads", 17, 0]],
    tue: [["hoangStrength", 8, 0]],
    wed: [["kickTechnique", 17, 0]],
    thu: [["shadowBoxing", 7, 0]],
    fri: [["sparring", 18, 0]],
};
const FIGHT_WEEK_TAPER: WeekTemplate = {
    mon: [["taperPads", 10, 0]],
    tue: [["shadowBoxing", 10, 0]],
    wed: [["taperPads", 10, 0]],
    thu: [["recovery", 10, 0]],
    fri: [["shadowBoxing", 10, 0]],
};
const TARIQ_BUILD: WeekTemplate = {
    mon: [["boxingPads", 16, 0]],
    tue: [["strength", 8, 0]],
    wed: [["heavyBag", 16, 0]],
    thu: [["sparring", 18, 0]],
    fri: [["defenceTechnique", 16, 0]],
};
const TARIQ_EARLY_REHAB: WeekTemplate = {
    mon: [["tariqUpperBody", 9, 0]],
    wed: [["recovery", 10, 0]],
    fri: [["tariqUpperBody", 9, 0]],
};
const TARIQ_CONTROLLED_RETURN: WeekTemplate = {
    mon: [["tariqUpperBody", 9, 0]],
    tue: [["tariqControlledPads", 16, 0]],
    thu: [["tariqControlledPads", 16, 0]],
    fri: [["recovery", 10, 0]],
};
const TARIQ_SPORT_RETURN: WeekTemplate = {
    mon: [["boxingPads", 16, 0]],
    tue: [["tariqUpperBody", 8, 0]],
    wed: [["heavyBag", 16, 0]],
    thu: [["boxingPads", 16, 0]],
    fri: [["conditioning", 8, 0]],
};
const EMMA_BUILD: WeekTemplate = {
    mon: [["kickPads", 17, 0]],
    tue: [["conditioning", 8, 0]],
    wed: [["kickBag", 17, 0]],
    thu: [["defenceTechnique", 17, 0]],
    fri: [["sparring", 18, 0]],
};
const BAO_INTRO: WeekTemplate = {
    mon: [["grapplingBasics", 17, 0]],
    tue: [["baoStriking", 17, 0]],
    thu: [["baoStrengthBaseline", 8, 0]],
    sat: [["grapplingBasics", 10, 0]],
};

interface SchedulePhase {
    /** First day offset this phase applies to; it runs until the next phase starts. */
    fromDay: number;
    week: WeekTemplate;
    /** When set, every session in the phase is cancelled with this reason. */
    cancellationReason?: string;
    /** Session RPE cap from the fighter's Medical Clearance. */
    maxRpe?: number;
    notes?: string;
}

const SCHEDULES: { fighterId: string; phases: SchedulePhase[] }[] = [
    { fighterId: "f-minh-tran", phases: [{ fromDay: -60, week: MINH_CAMP }] },
    {
        fighterId: "f-lucas-ferreira",
        phases: [
            { fromDay: -60, week: LUCAS_CAMP },
            {
                fromDay: -23,
                week: LUCAS_CAMP,
                cancellationReason: "Y tế: căng cơ đùi sau trái — nghỉ cho đến khi Dr. Thu Lê đánh giá",
            },
            {
                fromDay: -20,
                week: LUCAS_EARLY_REHAB,
                maxRpe: 6,
                notes: "Giai đoạn phục hồi: không đấu tập, không đá, không bật hông mạnh.",
            },
            {
                fromDay: -10,
                week: LUCAS_REHAB,
                maxRpe: 7,
                notes: "Cấp phép có hạn chế: không đấu tập, không đá, RPE tối đa 7, bảo vệ đùi sau trái.",
            },
        ],
    },
    { fighterId: "f-aigerim-sadykova", phases: [{ fromDay: -60, week: AIGERIM_CAMP }] },
    {
        fighterId: "f-kenji-morita",
        phases: [
            { fromDay: -60, week: KENJI_BUILD },
            { fromDay: -8, week: KENJI_RESTRICTED, maxRpe: 8, notes: "Vai phải đang được theo dõi — không tập cross nhiều, không đấu tập." },
            { fromDay: -7, week: KENJI_RESTRICTED, maxRpe: 8, notes: "Cấp phép có hạn chế: RPE tối đa 8, bảo vệ vai phải." },
        ],
    },
    {
        fighterId: "f-diego-alvarez",
        phases: [
            { fromDay: -60, week: DIEGO_BUILD },
            // Days 5–3 ago are the explicitly cancelled registry sessions above.
            { fromDay: -5, week: {} },
            { fromDay: -2, week: DIEGO_BUILD, cancellationReason: NOT_CLEARED_CONCUSSION },
            { fromDay: 8, week: {} },
        ],
    },
    { fighterId: "f-linh-pham", phases: [{ fromDay: -60, week: LINH_BUILD }] },
    {
        fighterId: "f-marcus-hale",
        phases: [
            { fromDay: -60, week: MARCUS_BUILD },
            {
                fromDay: -10,
                week: MARCUS_BUILD,
                cancellationReason: "Y tế: chấn thương tay phải — chờ kết quả X-quang và cấp phép",
            },
            {
                fromDay: -9,
                week: MARCUS_REHAB,
                notes: "Cấp phép có hạn chế: không bao cát, không đích, không đấu tập; không đấm; bảo vệ tay phải.",
            },
        ],
    },
    {
        fighterId: "f-sofia-kowalski",
        phases: [
            { fromDay: -60, week: SOFIA_CAMP },
            { fromDay: 12, week: FIGHT_WEEK_TAPER, notes: "Giảm tải tuần thi đấu." },
        ],
    },
    {
        fighterId: "f-hoang-long",
        phases: [
            { fromDay: -60, week: HOANG_CAMP },
            { fromDay: 12, week: FIGHT_WEEK_TAPER, notes: "Giảm tải tuần thi đấu — đang giảm cân." },
        ],
    },
    {
        fighterId: "f-tariq-haddad",
        phases: [
            { fromDay: -60, week: TARIQ_BUILD },
            {
                fromDay: -38,
                week: TARIQ_BUILD,
                cancellationReason: "Y tế: bong gân gối trái — chờ Dr. Samuel Brooks đánh giá",
            },
            { fromDay: -34, week: TARIQ_EARLY_REHAB, maxRpe: 6, notes: "Phục hồi giai đoạn đầu: chỉ tập thể lực tư thế ngồi, không xoay người." },
            {
                fromDay: -20,
                week: TARIQ_CONTROLLED_RETURN,
                maxRpe: 7,
                notes: "Trở lại có kiểm soát: xoay trên chân phải, không đá, không đấu tập.",
            },
            {
                fromDay: -5,
                week: TARIQ_SPORT_RETURN,
                maxRpe: 8,
                notes: "Cấp phép có hạn chế: không đá, không đấu tập, RPE tối đa 8, bảo vệ gối trái.",
            },
        ],
    },
    { fighterId: "f-emma-lindqvist", phases: [{ fromDay: -60, week: EMMA_BUILD }] },
    { fighterId: "f-bao-nguyen", phases: [{ fromDay: -11, week: BAO_INTRO, notes: "Giai đoạn làm quen — chờ khám thể lực ban đầu." }] },
];

/** Generated calendar: from the Monday six weeks before the current week to two weeks ahead. */
const FIRST_DAY = mondayOffset() - 42;
const LAST_DAY = 14;

const FLOOD_DAY = -17;
const FLOOD_REASON = "Võ đường đóng cửa sớm — đường ngập sau mưa lớn";
const MISSED_RATE = 0.035;
const MISSED_NOTES = [
    "Vắng mặt — nhắn HLV sau đó (ngủ quên).",
    "Vắng: kẹt xe sau mưa lớn.",
    "Vắng: đau bụng, ở nhà nghỉ.",
];

const SESSION_ID_TYPE: Record<TrainingType, string> = {
    shadow_boxing: "shadow",
    pad_work: "pads",
    heavy_bag: "bag",
    sparring: "sparring",
    technical_drilling: "drill",
    grappling: "grappling",
    strength_conditioning: "sc",
    recovery_mobility: "recovery",
};

function weekdayOf(day: number): Weekday {
    // Local noon (UTC+7) falls on the same UTC calendar date.
    return WEEKDAYS[new Date(fromToday(day, 12, 0)).getUTCDay()];
}

function dayLabel(day: number): string {
    if (day === 0) return "today";
    return day < 0 ? `${-day}d` : `in${day}d`;
}

function generateSessions(): SeedSession[] {
    const rng = createRandom("lotus-training-calendar");
    const sessions = registrySessionSpecs.map(registrySession);
    const usedIds = new Set(sessions.map((s) => s.id));
    // A registry session replaces the template slot in the same half-day and any same-type slot that day.
    const occupiedSlots = new Set(registrySessionSpecs.map((s) => `${s.fighterId}|${s.day}|${halfDay(s.hour)}`));
    const occupiedTypes = new Set(registrySessionSpecs.map((s) => `${s.fighterId}|${s.day}|${BLUEPRINTS[s.blueprint].type}`));

    for (const schedule of SCHEDULES) {
        const fighter = mockFighters.find((f) => f.id === schedule.fighterId);
        if (!fighter) continue;
        const slug = fighter.id.split("-")[1];

        for (let day = FIRST_DAY; day <= LAST_DAY; day++) {
            const phase = [...schedule.phases].reverse().find((p) => p.fromDay <= day);
            if (!phase) continue;

            for (const [key, hour, minute] of phase.week[weekdayOf(day)] ?? []) {
                const blueprint: Blueprint = BLUEPRINTS[key];
                if (
                    occupiedSlots.has(`${fighter.id}|${day}|${halfDay(hour)}`) ||
                    occupiedTypes.has(`${fighter.id}|${day}|${blueprint.type}`)
                ) {
                    continue;
                }
                const preferredCoach = COACH_BY_ROLE[blueprint.coach];
                const targetRpe = Math.min(blueprint.targetRpe, phase.maxRpe ?? 10);
                const authoredStart = fromToday(day, hour, minute);
                // A session today only counts as past once its planned end is before the anchor.
                const isPast = day < 0 || (day === 0 && Date.parse(authoredStart) + blueprint.durationMin * MINUTE_MS <= MOCK_ANCHOR_MS);

                // Every slot draws the same random values, so the stream never depends on the time of day.
                const missedRoll = rng.chance(MISSED_RATE);
                const missedNote = rng.pick(MISSED_NOTES);
                const actualDurationMin = blueprint.durationMin + rng.int(-4, 6);
                const rpeOffset = rng.pick([-1, 0, 0, 0, 1]);
                const coachRating = rng.pick([3, 4, 4, 4, 5, 5]);
                const summary = rng.pick(blueprint.summaries);

                let status: SessionStatus;
                let cancellationReason: string | null = null;
                let notes = phase.notes ?? null;
                if (phase.cancellationReason) {
                    status = "cancelled";
                    cancellationReason = phase.cancellationReason;
                } else if (day === FLOOD_DAY && hour >= 16) {
                    status = "cancelled";
                    cancellationReason = FLOOD_REASON;
                } else if (!isPast) {
                    status = "scheduled";
                } else if (missedRoll) {
                    status = "missed";
                    notes = missedNote;
                } else {
                    status = "completed";
                }
                const happened = status === "completed" || status === "missed";
                const scheduledAt = happened ? clampPastToday(authoredStart) : authoredStart;

                const baseId = `s-${slug}-${SESSION_ID_TYPE[blueprint.type]}-${dayLabel(day)}`;
                let id = baseId;
                for (let n = 2; usedIds.has(id); n++) id = `${baseId}-${n}`;
                usedIds.add(id);

                sessions.push({
                    id,
                    planId: planIdFor(fighter.id, day),
                    fighterId: fighter.id,
                    coachId: fighter.coachIds.includes(preferredCoach) ? preferredCoach : fighter.primaryCoachId,
                    title: blueprint.title,
                    type: blueprint.type,
                    scheduledAt,
                    durationMin: blueprint.durationMin,
                    location: blueprint.location,
                    targetRpe,
                    status,
                    exercises: blueprint.exercises.map((e) => ({ ...e, completed: status === "completed" })),
                    result:
                        status === "completed"
                            ? {
                                  completedAt: clampPastToday(addMinutes(authoredStart, actualDurationMin)),
                                  actualDurationMin,
                                  rpe: Math.max(1, Math.min(phase.maxRpe ?? 10, targetRpe + rpeOffset)),
                                  roundsCompleted: blueprint.exercises.reduce((total, e) => total + (e.rounds ?? 0), 0),
                                  coachRating,
                                  summary,
                              }
                            : null,
                    videoIds: [],
                    cancellationReason,
                    notes,
                });
            }
        }
    }

    return sessions.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

/** Seed sessions always carry a coach, a planned length and a target intensity, unlike API sessions. */
export type SeedSession = TrainingSession & { coachId: string; durationMin: number; targetRpe: number };

export const mockTrainingSessions: SeedSession[] = generateSessions();

/* ────────────────────────────────────────────────────────────────────────────
 * Coach feedback
 * ──────────────────────────────────────────────────────────────────────────── */

interface FeedbackSpec {
    id: string;
    fighterId: string;
    coachId: string;
    kind: CoachFeedback["kind"];
    techniques: Technique[];
    body: string;
    /** Link to a specific session by id (registry sessions). */
    sessionId?: string;
    videoId?: string;
    /** Otherwise link to the latest completed session of this type in the 10 days up to `day`. */
    nearType?: TrainingType;
    day?: number;
}

function latestCompletedSession(fighterId: string, type: TrainingType, day: number): TrainingSession | null {
    const since = fromToday(day - 10, 0, 0);
    const until = fromToday(day, 23, 59);
    const matches = mockTrainingSessions.filter(
        (s) =>
            s.fighterId === fighterId &&
            s.type === type &&
            s.status === "completed" &&
            s.scheduledAt >= since &&
            s.scheduledAt <= until,
    );
    return matches[matches.length - 1] ?? null;
}

function buildFeedback(spec: FeedbackSpec): CoachFeedback {
    const day = spec.day ?? 0;
    let session: TrainingSession | null = null;
    if (spec.sessionId) {
        session = mockTrainingSessions.find((s) => s.id === spec.sessionId) ?? null;
        if (!session) throw new Error(`Coach feedback ${spec.id} references unknown session ${spec.sessionId}.`);
    } else if (spec.nearType) {
        session = latestCompletedSession(spec.fighterId, spec.nearType, day);
    }
    const afterSession = session
        ? shiftPastToday(session.result?.completedAt ?? session.scheduledAt, 25)
        : clampPastToday(fromToday(day, 20, 15));
    let createdAt = afterSession;
    if (spec.videoId) {
        const video = mockVideos.find((v) => v.id === spec.videoId);
        if (!video) throw new Error(`Coach feedback ${spec.id} references unknown video ${spec.videoId}.`);
        // Feedback that links footage is written once the footage has been uploaded.
        const afterUpload = shiftPastToday(video.uploadedAt, 15);
        if (afterUpload > createdAt) createdAt = afterUpload;
    }
    return {
        id: spec.id,
        fighterId: spec.fighterId,
        coachId: spec.coachId,
        sessionId: session?.id ?? null,
        videoId: spec.videoId ?? null,
        kind: spec.kind,
        body: spec.body,
        techniques: spec.techniques,
        createdAt,
    };
}

const feedbackSpecs: FeedbackSpec[] = [
    // Minh
    {
        id: "fb-minh-pads-2d-hook",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["hook", "guard"],
        sessionId: "s-minh-pads-2d",
        videoId: "v-minh-pads-2d",
        body: "Tay phải của em rời má sau hook tay trước — nặng nhất ở hiệp 6–8 khi em mệt. Kéo tay sau về thủ rồi mới bước ra, kể cả khi phải bỏ đòn tiếp theo.",
    },
    {
        id: "fb-minh-pads-2d-entries",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["jab", "cross"],
        sessionId: "s-minh-pads-2d",
        videoId: "v-minh-pads-2d",
        body: "Vào đòn jab-cross tốt nhất từ đầu trại tới giờ. Em đã bước vào sau jab chứ không với tay, và cross vào với gót chân sau xoay đúng.",
    },
    {
        id: "fb-minh-bag-today",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "note",
        techniques: ["hook", "guard"],
        sessionId: "s-minh-bag-today",
        videoId: "v-minh-bag-today",
        body: "Hôm nay hook ngắn hơn và đa số lần tay phải đã về thủ. Chờ phân tích xong xem số liệu thủ của AI có khớp không.",
    },
    {
        id: "fb-minh-sparring-16d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["footwork", "head_movement"],
        sessionId: "s-minh-sparring-16d",
        videoId: "v-minh-sparring-16d",
        body: "Đánh xong chuỗi đòn lại lùi thẳng ra sau nên hai lần bị dắt vào cú trái phản đòn. Thoát ra theo góc trên chân trước và giữ đầu ngoài trục giữa.",
    },
    {
        id: "fb-minh-shadow-9d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["footwork", "combination"],
        videoId: "v-minh-shadow-9d",
        day: -9,
        body: "Các hiệp tập bóng rất tốt — chuỗi đòn nào cũng kết thúc bằng xoay người hoặc bước ra khỏi trục. Mang thói quen đó lên đích.",
    },
    {
        id: "fb-minh-hook-mechanics-20d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["hook"],
        nearType: "technical_drilling",
        day: -20,
        body: "Hook tay trước vẫn vòng rộng khi ra sau jab. Giữ khuỷu tay thẳng hàng với nắm đấm và xoay cả chân trước, đừng chỉ xoay vai.",
    },
    {
        id: "fb-minh-body-kick-26d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["kick", "combination"],
        nearType: "pad_work",
        day: -26,
        body: "Cross nối đá thân giờ đã vào đúng nhịp. Đó là đòn kết thúc mình cần khi gặp võ sĩ thế nghịch.",
    },
    {
        id: "fb-minh-wrestling-12d",
        fighterId: "f-minh-tran",
        coachId: ANNA,
        kind: "note",
        techniques: ["footwork"],
        nearType: "grappling",
        day: -12,
        body: "Phản xạ sprawl nhanh. Chặn được cú lao rồi thì vòng ra khỏi lưới, đừng đứng dựa lưới.",
    },
    {
        id: "fb-minh-strength-6d",
        fighterId: "f-minh-tran",
        coachId: JAMES,
        kind: "note",
        techniques: [],
        nearType: "strength_conditioning",
        day: -6,
        body: "Trap-bar 4 × 5 ở 140 kg đẩy tốt. Em đang 68,9 kg — đúng tiến độ cân sinh hoạt mục tiêu, nên tiếp tục ăn tinh bột quanh giờ tập.",
    },
    // Aigerim
    {
        id: "fb-aigerim-pads-3d-head",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["head_movement", "jab"],
        sessionId: "s-aigerim-pads-3d",
        videoId: "v-aigerim-pads-3d",
        body: "Di chuyển đầu xuất sắc — né đòn trả của đích và trả ngay jab. Đúng nhịp cần có để gặp Hoshino.",
    },
    {
        id: "fb-aigerim-pads-3d-feet",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["footwork", "head_movement"],
        sessionId: "s-aigerim-pads-3d",
        videoId: "v-aigerim-pads-3d",
        body: "Em bị đứng thẳng hàng hai chân khi lăn dưới hook. Giữ gót chân sau nhẹ và giữ độ rộng thế đứng để phản đòn được ngay sau cú lăn.",
    },
    {
        id: "fb-aigerim-sparring-15d",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["jab", "head_movement"],
        nearType: "sparring",
        day: -15,
        body: "Né nhiều mà không trả đòn. Né xong phải có đòn trả — dù chỉ là jab nhử cũng đủ khiến người đấm dồn dập phải dè chừng.",
    },
    {
        id: "fb-aigerim-defence-30d",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["guard"],
        nearType: "technical_drilling",
        day: -30,
        body: "Gạt - đỡ - phản đòn rất gọn. Giờ em đã đỡ cross ở ngang trán chứ không cao hơn.",
    },
    // Kenji
    {
        id: "fb-kenji-bag-9d-shoulder",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        kind: "note",
        techniques: ["cross"],
        sessionId: "s-kenji-bag-9d",
        videoId: "v-kenji-bag-9d",
        body: "Nửa sau buổi vai phải nhô lên khi ra cross và em nói thấy căng. Báo Dr. Thu Lê trước buổi tập nặng tiếp theo — không tập cross nhiều cho đến khi bác sĩ khám.",
    },
    {
        id: "fb-kenji-switch-25d",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["footwork", "guard"],
        nearType: "sparring",
        day: -25,
        body: "Khi đổi sang thế nghịch, tay sau rời cằm lúc bước. Đổi thế sau jab để thế thủ luôn giữ nguyên.",
    },
    {
        id: "fb-kenji-kicks-4d",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["kick", "footwork"],
        nearType: "technical_drilling",
        day: -4,
        body: "Vào đòn đá đổi chân sắc, đổi thế gọn hơn. Tận dụng tốt mấy tuần bị hạn chế.",
    },
    {
        id: "fb-kenji-shadow-2d",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        kind: "note",
        techniques: ["guard", "footwork"],
        nearType: "shadow_boxing",
        day: -2,
        body: "Chỉ tay trước và đòn đá như đã thống nhất, RPE giữ ở 5. Vai ổn suốt bài CARs — nhớ báo điều này khi tái khám.",
    },
    // Diego
    {
        id: "fb-diego-sparring-6d",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        kind: "note",
        techniques: ["guard", "head_movement"],
        sessionId: "s-diego-sparring-6d",
        videoId: "v-diego-sparring-6d",
        body: "Mình dừng buổi tập ở hiệp 3 vì em đứng không vững và lấy lại thủ chậm. Không tập gì cho đến khi Dr. Thu Lê cho phép — lúc này nghỉ ngơi chính là tập.",
    },
    {
        id: "fb-diego-level-change-20d",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["guard", "head_movement"],
        nearType: "pad_work",
        day: -20,
        body: "Khi hạ trọng tâm, cằm em hếch lên và đầu vẫn nằm trên trục giữa. Giữ thủ cao và đưa đầu ra khỏi trục trước khi lao vào.",
    },
    {
        id: "fb-diego-wrestling-13d",
        fighterId: "f-diego-alvarez",
        coachId: ANNA,
        kind: "praise",
        techniques: [],
        nearType: "grappling",
        day: -13,
        body: "Chuỗi double sang single hôm nay dồn dập không ngừng. Pha kết thúc ngáng cổ chân xa rất đẹp.",
    },
    // Linh
    {
        id: "fb-linh-bag-5d-kicks",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["kick"],
        sessionId: "s-linh-bag-5d",
        videoId: "v-linh-bag-5d",
        body: "Đá vòng cầu rất có lực và em về thế nhanh. Lần nào teep cũng chạm bằng mũi bàn chân.",
    },
    {
        id: "fb-linh-bag-5d-hands",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["jab", "combination"],
        sessionId: "s-linh-bag-5d",
        videoId: "v-linh-bag-5d",
        body: "Tay lại chậm hơn chân. Mở bằng jab thật — không phải jab đo khoảng cách — và kết thúc các chuỗi đá - đấm bằng cross.",
    },
    {
        id: "fb-linh-cross-10d",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["cross"],
        nearType: "pad_work",
        day: -10,
        body: "Cross bị hụt vì chân sau không xoay. Nhấc gót, đưa hông vào, rồi thu ngay về thủ.",
    },
    {
        id: "fb-linh-combo-19d",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["combination", "kick"],
        nearType: "pad_work",
        day: -19,
        body: "1-2 nối đá thân vào gọn ở đa số lần. Đòn phối hợp này đã sẵn sàng đưa vào đấu tập.",
    },
    // Marcus
    {
        id: "fb-marcus-bag-11d",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        kind: "note",
        techniques: ["cross"],
        sessionId: "s-marcus-bag-11d",
        videoId: "v-marcus-bag-11d",
        body: "Buổi tập dừng ở hiệp 4 vì tay phải đau sau cú cross. Từ giờ mọi quyết định do bác sĩ đưa ra — trong lúc chờ, mình vẫn giữ cho chân và sức bền hoạt động.",
    },
    {
        id: "fb-marcus-conditioning-6d",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        kind: "note",
        techniques: [],
        nearType: "strength_conditioning",
        day: -6,
        body: "Đạp xe ngắt quãng trung bình 628 W — tốt lắm. Split squat chỉ dùng áo tạ; không cầm tạ đơn bằng tay phải.",
    },
    {
        id: "fb-marcus-footwork-3d",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["footwork"],
        nearType: "technical_drilling",
        day: -3,
        body: "Các hiệp di chuyển sắc — em chặn đường trong lồng bằng bước ngang thay vì đuổi theo. Giữ tay phải thả lỏng trong thế thủ, không nắm đấm.",
    },
    // Sofia
    {
        id: "fb-sofia-pads-8d-jab",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        kind: "praise",
        techniques: ["jab", "footwork"],
        sessionId: "s-sofia-pads-8d",
        videoId: "v-sofia-pads-8d",
        body: "Vào đòn mở bằng jab sắc và em áp sát ngay sau đó. Tốt hơn nhiều so với tháng trước.",
    },
    {
        id: "fb-sofia-pads-8d-guard",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        kind: "correction",
        techniques: ["guard"],
        sessionId: "s-sofia-pads-8d",
        videoId: "v-sofia-pads-8d",
        body: "Sau khi tách clinch em hạ cả hai tay. Chống cẳng tay đẩy ra và đưa thủ lên rồi mới rời ra.",
    },
    {
        id: "fb-sofia-judo-2d",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        kind: "praise",
        techniques: [],
        nearType: "grappling",
        day: -2,
        body: "Uchi-mata ở lưới đã vào được trong các hiệp thật và em thắng tranh nắm từ sớm. Kế hoạch thi đấu đang phát huy.",
    },
    {
        id: "fb-sofia-prefight-medical-1d",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        kind: "note",
        techniques: [],
        day: -1,
        body: "Cấp phép y tế của em hết hạn sau năm ngày và đã đến hạn khám trước thi đấu. Đặt lịch với Dr. Samuel Brooks trong tuần này để trại không bị gián đoạn.",
    },
    // Hoàng
    {
        id: "fb-hoang-shadow-7d",
        fighterId: "f-hoang-long",
        coachId: ANNA,
        kind: "note",
        techniques: ["kick", "footwork"],
        sessionId: "s-hoang-shadow-7d",
        videoId: "v-hoang-shadow-7d",
        body: "Sáng nay đòn đá cứng ở phần thân — lại do lưng dưới. Tuần này làm bài linh hoạt trước mỗi buổi, và buổi sau quay sau 8:00 khi đã bật đèn.",
    },
    {
        id: "fb-hoang-kicks-4d",
        fighterId: "f-hoang-long",
        coachId: ANNA,
        kind: "praise",
        techniques: ["kick", "combination"],
        nearType: "pad_work",
        day: -4,
        body: "Vào đòn đá chân trước nhanh và vào được sau jab. Giữ độ sắc đó trong suốt đợt giảm cân.",
    },
    {
        id: "fb-hoang-weight-3d",
        fighterId: "f-hoang-long",
        coachId: JAMES,
        kind: "note",
        techniques: [],
        nearType: "strength_conditioning",
        day: -3,
        body: "Sáng nay 59,8 kg. Bù nước mới ở mức tạm — uống thêm hai lít mỗi ngày cho đến khi bắt đầu cắt nước ở tuần thi đấu.",
    },
    // Tariq
    {
        id: "fb-tariq-knee-38d",
        fighterId: "f-tariq-haddad",
        coachId: JAMES,
        kind: "note",
        techniques: [],
        sessionId: "s-tariq-sc-38d",
        body: "Đã dừng buổi tập sau khi gối trái sụp ở bài split squat. Tối nay chườm đá và băng ép, sáng mai gặp Dr. Samuel Brooks ngay.",
    },
    {
        id: "fb-tariq-posture-15d",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["guard", "footwork"],
        nearType: "pad_work",
        day: -15,
        body: "Em đang bảo vệ gối trái bằng cách đứng cao và thẳng người. Giữ thế đứng — mình kiểm soát các cú xoay chứ không phải tư thế của em.",
    },
    {
        id: "fb-tariq-mitts-2d",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["jab", "cross"],
        nearType: "pad_work",
        day: -2,
        body: "Những hiệp đích tay tốc độ tối đa đầu tiên sau chấn thương. Jab đã nhanh như trước khi chấn thương và em xoay trên chân phải đúng kế hoạch.",
    },
    // Emma
    {
        id: "fb-emma-sparring-1d",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["combination", "head_movement"],
        sessionId: "s-emma-sparring-1d",
        videoId: "v-emma-sparring-1d",
        body: "Các hiệp bình tĩnh, kỹ thuật. Lần nào em cũng lăn dưới hook rồi trả 1-2 nối đá thân. Video đang chờ AI phân tích.",
    },
    {
        id: "fb-emma-body-kick-8d",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["kick"],
        nearType: "heavy_bag",
        day: -8,
        body: "Khi mệt, đá thân của em tụt xuống ngang hông. Đá xuyên qua sườn, đừng đá vào bao.",
    },
    {
        id: "fb-emma-counter-22d",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        kind: "note",
        techniques: ["guard", "cross"],
        nearType: "technical_drilling",
        day: -22,
        body: "Thử đỡ jab bằng tay sau rồi bắn ngay cú thẳng tay trái — hiện em đang gạt rồi mới về thế.",
    },
    // Lucas
    {
        id: "fb-lucas-sparring-24d",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        kind: "note",
        techniques: [],
        sessionId: "s-lucas-sparring-24d",
        body: "Dừng ngay khi thấy đùi sau có vấn đề là đúng. Tối nay chườm đá và băng ép — sáng mai Dr. Thu Lê sẽ khám cho em.",
    },
    {
        id: "fb-lucas-upper-12d",
        fighterId: "f-lucas-ferreira",
        coachId: JAMES,
        kind: "note",
        techniques: [],
        nearType: "strength_conditioning",
        day: -12,
        body: "Kéo xà mang tạ đã trở lại +20 kg với 4 × 6. Đạp xe vẫn ngồi, lực cản vừa, đùi sau không có triệu chứng.",
    },
    {
        id: "fb-lucas-passing-4d",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        kind: "praise",
        techniques: [],
        nearType: "grappling",
        day: -4,
        body: "Qua guard knee-cut kiên nhẫn và nặng. Em giữ được crossface mà không cần bật hông mạnh — đúng như giai đoạn này cần.",
    },
    // Bảo
    {
        id: "fb-bao-sprawl-4d",
        fighterId: "f-bao-nguyen",
        coachId: ANNA,
        kind: "praise",
        techniques: [],
        nearType: "grappling",
        day: -4,
        body: "Hai tuần đầu tốt. Sprawl đã thấp và nhanh hơn — giữ hông nặng và ngẩng đầu.",
    },
];

export const mockCoachFeedback: CoachFeedback[] = feedbackSpecs
    .map(buildFeedback)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/* ────────────────────────────────────────────────────────────────────────────
 * Goals
 * ──────────────────────────────────────────────────────────────────────────── */

interface GoalSpec extends Omit<Goal, "startDate" | "dueDate" | "history" | "createdAt"> {
    startDay: number;
    dueDay: number;
    decimals: number;
    /** Intermediate [day, value] points the weekly history passes through (e.g. a plateau after an injury). */
    path?: [number, number][];
}

function interpolate(points: [number, number][], day: number): number {
    for (let i = 1; i < points.length; i++) {
        const [fromDay, fromValue] = points[i - 1];
        const [toDay, toValue] = points[i];
        if (day <= toDay) {
            return toDay === fromDay ? toValue : fromValue + ((toValue - fromValue) * (day - fromDay)) / (toDay - fromDay);
        }
    }
    return points[points.length - 1][1];
}

function buildGoal({ startDay, dueDay, decimals, path = [], ...goal }: GoalSpec): Goal {
    const rng = createRandom(goal.id);
    const lastDay = Math.min(0, dueDay);
    const checkpointDays: number[] = [];
    for (let day = startDay; day <= lastDay; day += 7) checkpointDays.push(day);
    const finalDay = checkpointDays[checkpointDays.length - 1];
    const points: [number, number][] = [[startDay, goal.baseline], ...path, [finalDay, goal.current]];
    const noise = Math.abs(goal.target - goal.baseline) * 0.08;

    const history: GoalCheckpoint[] = checkpointDays.map((day, index) => {
        const isEndpoint = index === 0 || index === checkpointDays.length - 1;
        const value = interpolate(points, day) + (isEndpoint ? 0 : rng.jitter(noise));
        return { date: clampPastToday(fromToday(day, 8, 0)), value: Number(value.toFixed(decimals)) };
    });

    return {
        ...goal,
        startDate: fromToday(startDay, 0, 0),
        dueDate: fromToday(dueDay, 23, 59),
        history,
        createdAt: clampPastToday(fromToday(startDay, 11, 0)),
    };
}

function goalSpec(
    base: Omit<GoalSpec, "status" | "lowerIsBetter" | "decimals"> &
        Partial<Pick<GoalSpec, "lowerIsBetter" | "decimals">> & { status: GoalStatus },
): GoalSpec {
    return { lowerIsBetter: false, decimals: 0, ...base };
}

const goalSpecs: GoalSpec[] = [
    // Minh
    goalSpec({
        id: "g-minh-guard-uptime",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        title: "Giữ tay phải ở thủ sau hook tay trước",
        technique: "guard",
        metricLabel: "Tỉ lệ giữ thủ sau hook",
        unit: "%",
        baseline: 61,
        target: 80,
        current: 68,
        startDay: -49,
        dueDay: 35,
        status: "at_risk",
    }),
    goalSpec({
        id: "g-minh-jab-speed",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        title: "Jab nhanh hơn cho đêm thi đấu",
        technique: "jab",
        metricLabel: "Tốc độ đỉnh của jab",
        unit: "m/s",
        baseline: 7.4,
        target: 8.2,
        current: 7.9,
        startDay: -56,
        dueDay: 35,
        decimals: 1,
        status: "on_track",
    }),
    goalSpec({
        id: "g-minh-guard-recovery",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        title: "Thu thủ nhanh hơn sau hook tay trước",
        technique: "hook",
        metricLabel: "Thời gian thu thủ sau hook tay trước",
        unit: "ms",
        lowerIsBetter: true,
        baseline: 520,
        target: 380,
        current: 455,
        startDay: -42,
        dueDay: 35,
        status: "at_risk",
    }),
    goalSpec({
        id: "g-minh-walkaround-weight",
        fighterId: "f-minh-tran",
        coachId: JAMES,
        title: "Cân nặng sinh hoạt trước tuần thi đấu",
        technique: null,
        metricLabel: "Cân nặng buổi sáng",
        unit: "kg",
        lowerIsBetter: true,
        baseline: 71.2,
        target: 67.5,
        current: 68.9,
        startDay: -42,
        dueDay: 34,
        decimals: 1,
        status: "on_track",
    }),
    // Lucas
    goalSpec({
        id: "g-lucas-weekly-minutes",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        title: "Xây lại khối lượng tập mỗi tuần",
        technique: null,
        metricLabel: "Số phút tập mỗi tuần",
        unit: "phút",
        baseline: 140,
        target: 320,
        current: 250,
        startDay: -21,
        dueDay: 18,
        status: "on_track",
    }),
    goalSpec({
        id: "g-lucas-takedown-defence",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        title: "Phòng thủ quật ngã khi tập",
        technique: null,
        metricLabel: "Tỉ lệ phòng thủ quật ngã thành công khi tập",
        unit: "%",
        baseline: 62,
        target: 80,
        current: 66,
        startDay: -60,
        dueDay: 30,
        path: [[-24, 67]],
        status: "at_risk",
    }),
    goalSpec({
        id: "g-lucas-passing",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        title: "Đè ở trên mà không bật hông mạnh",
        technique: null,
        metricLabel: "Tỉ lệ qua guard thành công ở hiệp tình huống",
        unit: "%",
        baseline: 48,
        target: 65,
        current: 58,
        startDay: -20,
        dueDay: 40,
        status: "on_track",
    }),
    // Aigerim
    goalSpec({
        id: "g-aigerim-head-movement",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        title: "Đầu di chuyển nhiều hơn nữa để gặp Hoshino",
        technique: "head_movement",
        metricLabel: "Số lần di chuyển đầu mỗi phút",
        unit: "/phút",
        baseline: 14.2,
        target: 18,
        current: 17.1,
        startDay: -42,
        dueDay: 24,
        decimals: 1,
        status: "on_track",
    }),
    goalSpec({
        id: "g-aigerim-slip-counter",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        title: "Né lần nào cũng có đòn trả",
        technique: "jab",
        metricLabel: "Tỉ lệ né có phản đòn",
        unit: "%",
        baseline: 38,
        target: 60,
        current: 55,
        startDay: -42,
        dueDay: 24,
        status: "on_track",
    }),
    goalSpec({
        id: "g-aigerim-centreline",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        title: "Ra khỏi trục giữa",
        technique: "guard",
        metricLabel: "Tỉ lệ để lộ trục giữa",
        unit: "%",
        lowerIsBetter: true,
        baseline: 31,
        target: 22,
        current: 21,
        startDay: -56,
        dueDay: 20,
        status: "achieved",
    }),
    // Kenji
    goalSpec({
        id: "g-kenji-switch-kick",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        title: "Đá đổi chân nhanh hơn",
        technique: "kick",
        metricLabel: "Tốc độ đỉnh đá đổi chân",
        unit: "m/s",
        baseline: 11.8,
        target: 12.8,
        current: 12.5,
        startDay: -49,
        dueDay: 35,
        decimals: 1,
        status: "on_track",
    }),
    goalSpec({
        id: "g-kenji-stance-switches",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        title: "Đổi thế gọn",
        technique: "footwork",
        metricLabel: "Số lần đổi thế gọn mỗi hiệp",
        unit: "lần",
        baseline: 4,
        target: 7,
        current: 5.5,
        startDay: -49,
        dueDay: 35,
        decimals: 1,
        status: "at_risk",
    }),
    goalSpec({
        id: "g-kenji-cross-guard",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        title: "Tay sau về thủ sau cross",
        technique: "cross",
        metricLabel: "Tỉ lệ giữ thủ khi ra cross",
        unit: "%",
        baseline: 72,
        target: 85,
        current: 74,
        startDay: -42,
        dueDay: 35,
        path: [[-9, 76]],
        status: "at_risk",
    }),
    // Diego
    goalSpec({
        id: "g-diego-guard-entries",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        title: "Thủ cao khi vào vật",
        technique: "guard",
        metricLabel: "Tỉ lệ giữ thủ khi vào đòn",
        unit: "%",
        baseline: 58,
        target: 75,
        current: 66,
        startDay: -45,
        dueDay: 39,
        path: [[-6, 66]],
        status: "at_risk",
    }),
    goalSpec({
        id: "g-diego-head-movement",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        title: "Đưa đầu ra khỏi trục trước khi lao vào",
        technique: "head_movement",
        metricLabel: "Số lần di chuyển đầu mỗi phút",
        unit: "/phút",
        baseline: 6.1,
        target: 9,
        current: 7.4,
        startDay: -45,
        dueDay: 39,
        decimals: 1,
        path: [[-6, 7.4]],
        status: "at_risk",
    }),
    // Linh
    goalSpec({
        id: "g-linh-punch-accuracy",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        title: "Đòn tay phải trúng",
        technique: "combination",
        metricLabel: "Độ chính xác đòn đấm trên đích",
        unit: "%",
        baseline: 64,
        target: 80,
        current: 71,
        startDay: -30,
        dueDay: 55,
        status: "on_track",
    }),
    goalSpec({
        id: "g-linh-jab-output",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        title: "Ra jab nhiều hơn",
        technique: "jab",
        metricLabel: "Số jab mỗi hiệp trên bao",
        unit: "jab/hiệp",
        baseline: 18,
        target: 30,
        current: 24,
        startDay: -30,
        dueDay: 55,
        status: "on_track",
    }),
    goalSpec({
        id: "g-linh-kick-speed",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        title: "Tốc độ đá vòng cầu",
        technique: "kick",
        metricLabel: "Tốc độ đỉnh đá vòng cầu",
        unit: "m/s",
        baseline: 12.9,
        target: 13.5,
        current: 13.6,
        startDay: -60,
        dueDay: 20,
        decimals: 1,
        status: "achieved",
    }),
    // Marcus
    goalSpec({
        id: "g-marcus-bike-power",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        title: "Giữ thể lực trong lúc phục hồi tay",
        technique: null,
        metricLabel: "Công suất trung bình 30 giây trên xe đạp gió",
        unit: "W",
        baseline: 610,
        target: 680,
        current: 628,
        startDay: -9,
        dueDay: 31,
        status: "on_track",
    }),
    goalSpec({
        id: "g-marcus-pivots",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        title: "Di chuyển sắc hơn trong lúc tay lành",
        technique: "footwork",
        metricLabel: "Số lần xoay mỗi hiệp trong bài di chuyển",
        unit: "lần xoay/hiệp",
        baseline: 9,
        target: 14,
        current: 11,
        startDay: -9,
        dueDay: 31,
        status: "on_track",
    }),
    goalSpec({
        id: "g-marcus-cross-speed",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        title: "Cross tay phải bật hơn",
        technique: "cross",
        metricLabel: "Tốc độ đỉnh của cross",
        unit: "m/s",
        baseline: 8.1,
        target: 8.8,
        current: 8.3,
        startDay: -60,
        dueDay: -4,
        decimals: 1,
        path: [[-11, 8.3]],
        status: "missed",
    }),
    // Sofia
    goalSpec({
        id: "g-sofia-clinch-takedowns",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        title: "Kết thúc clinch ở lưới",
        technique: null,
        metricLabel: "Tỉ lệ clinch thành quật ngã",
        unit: "%",
        baseline: 42,
        target: 60,
        current: 58,
        startDay: -47,
        dueDay: 14,
        status: "on_track",
    }),
    goalSpec({
        id: "g-sofia-jab-entries",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        title: "Vào đòn sau jab",
        technique: "jab",
        metricLabel: "Số pha vào mở bằng jab mỗi hiệp",
        unit: "lần vào/hiệp",
        baseline: 5,
        target: 9,
        current: 8.5,
        startDay: -47,
        dueDay: 14,
        decimals: 1,
        status: "on_track",
    }),
    goalSpec({
        id: "g-sofia-walkaround-weight",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        title: "Cân nặng sinh hoạt trước tuần thi đấu",
        technique: null,
        metricLabel: "Cân nặng buổi sáng",
        unit: "kg",
        lowerIsBetter: true,
        baseline: 64.1,
        target: 62.5,
        current: 62.0,
        startDay: -47,
        dueDay: 12,
        decimals: 1,
        status: "achieved",
    }),
    // Hoàng
    goalSpec({
        id: "g-hoang-walkaround-weight",
        fighterId: "f-hoang-long",
        coachId: JAMES,
        title: "Cân nặng sinh hoạt trước tuần thi đấu",
        technique: null,
        metricLabel: "Cân nặng buổi sáng",
        unit: "kg",
        lowerIsBetter: true,
        baseline: 62.4,
        target: 58.5,
        current: 59.8,
        startDay: -47,
        dueDay: 12,
        decimals: 1,
        status: "at_risk",
    }),
    goalSpec({
        id: "g-hoang-kick-speed",
        fighterId: "f-hoang-long",
        coachId: ANNA,
        title: "Đá chân trước nhanh hơn",
        technique: "kick",
        metricLabel: "Tốc độ đỉnh đá chân trước",
        unit: "m/s",
        baseline: 11.2,
        target: 12,
        current: 11.9,
        startDay: -47,
        dueDay: 12,
        decimals: 1,
        status: "on_track",
    }),
    goalSpec({
        id: "g-hoang-head-movement",
        fighterId: "f-hoang-long",
        coachId: ANNA,
        title: "Di chuyển đầu khi vào đòn",
        technique: "head_movement",
        metricLabel: "Số lần di chuyển đầu mỗi phút",
        unit: "/phút",
        baseline: 9.5,
        target: 12,
        current: 11.6,
        startDay: -47,
        dueDay: 12,
        decimals: 1,
        status: "on_track",
    }),
    // Tariq
    goalSpec({
        id: "g-tariq-pad-rounds",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        title: "Xây lại khối lượng đích",
        technique: "combination",
        metricLabel: "Số hiệp đích tốc độ tối đa mỗi buổi",
        unit: "hiệp",
        baseline: 3,
        target: 8,
        current: 6,
        startDay: -20,
        dueDay: 20,
        status: "on_track",
    }),
    goalSpec({
        id: "g-tariq-jab-speed",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        title: "Tốc độ jab trở lại như trước chấn thương",
        technique: "jab",
        metricLabel: "Tốc độ đỉnh của jab",
        unit: "m/s",
        baseline: 6.9,
        target: 7.4,
        current: 7.1,
        startDay: -34,
        dueDay: 20,
        decimals: 1,
        status: "at_risk",
    }),
    // Emma
    goalSpec({
        id: "g-emma-combination-volume",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        title: "Khối lượng đòn phối hợp cao hơn",
        technique: "combination",
        metricLabel: "Số chuỗi đòn phối hợp mỗi hiệp trên đích",
        unit: "chuỗi/hiệp",
        baseline: 11,
        target: 15,
        current: 14.2,
        startDay: -45,
        dueDay: 40,
        decimals: 1,
        status: "on_track",
    }),
    goalSpec({
        id: "g-emma-body-kick",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        title: "Kết thúc 1-2 bằng đá thân",
        technique: "kick",
        metricLabel: "Tỉ lệ đá thân trúng sau 1-2",
        unit: "%",
        baseline: 35,
        target: 55,
        current: 49,
        startDay: -45,
        dueDay: 40,
        status: "on_track",
    }),
    goalSpec({
        id: "g-emma-head-movement",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        title: "Di chuyển đầu khi bị ép",
        technique: "head_movement",
        metricLabel: "Số lần di chuyển đầu mỗi phút",
        unit: "/phút",
        baseline: 12,
        target: 14,
        current: 14.3,
        startDay: -45,
        dueDay: 30,
        decimals: 1,
        status: "achieved",
    }),
    // Bảo
    goalSpec({
        id: "g-bao-sprawl-reaction",
        fighterId: "f-bao-nguyen",
        coachId: ANNA,
        title: "Phản xạ sprawl nhanh hơn",
        technique: null,
        metricLabel: "Thời gian phản xạ sprawl",
        unit: "ms",
        lowerIsBetter: true,
        baseline: 610,
        target: 480,
        current: 575,
        startDay: -10,
        dueDay: 50,
        status: "on_track",
    }),
];

export const mockGoals: Goal[] = goalSpecs.map(buildGoal);
