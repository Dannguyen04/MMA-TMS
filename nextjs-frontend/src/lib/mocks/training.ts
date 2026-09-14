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
        ["Focus mitts", "Boxing gloves", "Hand wraps"],
        { rounds: 6, roundSec: 180 },
        [...HANDS, ...SHOULDERS, ...ELBOWS],
        "Coach calls 1-2-3 off the jab. Snap the jab back to the cheek, turn the rear hip through the cross and bring the rear hand home before the lead hook lands.",
    ),
    exercise(
        "exr-southpaw-lead-hook-counter",
        "Southpaw lead-hook counter",
        "striking",
        "moderate",
        ["hook", "footwork", "guard"],
        ["Focus mitts", "Boxing gloves"],
        { rounds: 5, roundSec: 180 },
        ["left_hand", "left_elbow", "left_shoulder"],
        "Coach feeds a southpaw jab. Parry, step the lead foot outside theirs and return the lead hook, then pivot off the line before they reset.",
    ),
    exercise(
        "exr-teep-roundhouse-bag",
        "Teep & roundhouse kick bag rounds",
        "striking",
        "high",
        ["kick", "footwork"],
        ["Heavy bag", "Shin guards"],
        { rounds: 5, roundSec: 180 },
        [...KNEES, ...HAMSTRINGS, ...SHINS, ...HIPS],
        "Teep to create range, then step off and turn the hip over on the roundhouse. Return the kicking leg to stance, never leave it hanging.",
    ),
    exercise(
        "exr-heavy-bag-power-rounds",
        "Heavy bag power rounds",
        "striking",
        "high",
        ["jab", "cross", "hook", "combination"],
        ["Heavy bag", "Bag gloves", "Hand wraps"],
        { rounds: 6, roundSec: 180 },
        [...HANDS, ...SHOULDERS, ...ELBOWS],
        "Thirty seconds of committed power combinations, thirty seconds of moving jabs. Wrists straight, knuckles aligned, feet under the shots.",
    ),
    exercise(
        "exr-thai-clinch-knees",
        "Muay Thai clinch knees",
        "striking",
        "high",
        ["combination", "guard"],
        ["Kick shield", "Partner"],
        { rounds: 4, roundSec: 120 },
        [...KNEES, ...HIPS, "neck"],
        "Win inside control with a double-collar tie, off-balance the partner and drive straight knees into the shield. Keep elbows tight to stop the frame.",
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
        "Slow, deliberate rounds with a single technical theme per round. Finish every combination with a defensive move and a change of angle.",
    ),
    exercise(
        "exr-thai-pad-kick-rounds",
        "Thai pad kick & check rounds",
        "striking",
        "high",
        ["kick", "guard", "footwork"],
        ["Thai pads", "Shin guards"],
        { rounds: 5, roundSec: 120 },
        [...KNEES, ...SHINS, ...HIPS, ...HAMSTRINGS],
        "Holder alternates body and leg targets and returns low kicks. Check with the shin, land the counter kick within one beat.",
    ),
    exercise(
        "exr-controlled-sparring",
        "Controlled sparring rounds",
        "striking",
        "high",
        ["jab", "cross", "hook", "kick", "combination", "footwork", "guard", "head_movement"],
        ["16 oz gloves", "Headgear", "Shin guards", "Mouthguard"],
        { rounds: 5, roundSec: 180 },
        ["head", ...HANDS, ...SHINS, "ribs"],
        "Technical sparring at around 60% power with a coach-set theme each round. Coach stops the round for any hard exchange.",
    ),
    // Defense
    exercise(
        "exr-slip-roll-line",
        "Slip-roll line drill",
        "defense",
        "moderate",
        ["head_movement", "guard"],
        ["Slip line"],
        { rounds: 4, roundSec: 120 },
        ["neck", "lower_back"],
        "Move along the rope: slip outside the jab, roll under the hook, bend at the knees not the waist, and return a counter from each position.",
    ),
    exercise(
        "exr-parry-catch-counter",
        "Parry-catch-counter partner drill",
        "defense",
        "moderate",
        ["guard", "jab", "cross"],
        ["Boxing gloves", "Partner"],
        { rounds: 4, roundSec: 180 },
        SHOULDERS,
        "Partner throws single shots at controlled speed. Parry the jab, catch the cross on the glove and fire back the same shot before they reset.",
    ),
    exercise(
        "exr-guard-reset-reaction",
        "Guard-reset reaction drill",
        "defense",
        "moderate",
        ["guard", "hook"],
        ["Focus mitts", "Pool noodle"],
        { rounds: 5, roundSec: 120 },
        SHOULDERS,
        "After every lead hook the coach swings a pool noodle at the open side. The rear hand has to be back on the cheek before the noodle arrives.",
    ),
    exercise(
        "exr-kick-catch-defence",
        "Kick catch & sweep defence",
        "defense",
        "moderate",
        ["kick", "guard"],
        ["Shin guards", "Partner"],
        { rounds: 4, roundSec: 120 },
        [...KNEES, ...ANKLES],
        "Partner throws body kicks at half speed. Catch, step outside and off-balance; when caught yourself, hop in and frame to free the leg.",
    ),
    // Footwork
    exercise(
        "exr-pivot-angle-ladder",
        "Pivot-and-angle footwork ladder",
        "footwork",
        "moderate",
        ["footwork"],
        ["Agility ladder", "Cones"],
        { rounds: 4, roundSec: 120 },
        [...ANKLES, ...KNEES],
        "In-out steps through the ladder, then a lead-foot pivot to a cone at 45°. Stay on the balls of the feet and keep stance width constant.",
    ),
    exercise(
        "exr-cage-cutting-footwork",
        "Cage-cutting footwork",
        "footwork",
        "moderate",
        ["footwork", "guard"],
        ["Cage", "Partner"],
        { rounds: 4, roundSec: 180 },
        ANKLES,
        "Partner circles the cage; cut them off with lateral steps rather than following, and trap them against the fence without crossing the feet.",
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
        "Hands held in guard, no strikes. Rounds alternate between angle exits, lateral steps and changes of rhythm on the coach's call.",
    ),
    // Grappling
    exercise(
        "exr-wall-walk-shots",
        "Wall-walk wrestling shots",
        "grappling",
        "high",
        [],
        ["Wall pads", "Mat"],
        { sets: 4, reps: 8 },
        ["neck", "lower_back", ...KNEES],
        "Level change, penetration step to the knee and walk the hands up the wall to finish tall. Head up, back straight, hips under the shoulders.",
    ),
    exercise(
        "exr-hip-escape-chains",
        "Hip-escape (shrimp) chains",
        "grappling",
        "moderate",
        [],
        ["Mat"],
        { sets: 4, reps: 10 },
        ["lower_back", ...HIPS],
        "Continuous shrimps the length of the mat, framing on an imaginary opponent each rep. Finish by recovering guard or coming up on a single leg.",
    ),
    exercise(
        "exr-double-leg-chain",
        "Double-leg to single-leg chain",
        "grappling",
        "high",
        [],
        ["Mat", "Partner"],
        { rounds: 5, roundSec: 180 },
        ["neck", "lower_back", ...KNEES],
        "Shoot the double; when the partner sprawls, switch to the single, run the pipe or trip the far ankle. Partner gives progressive resistance.",
    ),
    exercise(
        "exr-guard-retention-rounds",
        "Guard retention positional rounds",
        "grappling",
        "moderate",
        [],
        ["Mat", "Partner"],
        { rounds: 6, roundSec: 240 },
        ["neck", ...HIPS, ...HAMSTRINGS],
        "Four-minute rounds starting from open guard. The passer scores on a pass; the bottom player resets on a sweep or re-guard.",
    ),
    exercise(
        "exr-pressure-passing-drill",
        "Pressure passing (knee-cut) drilling",
        "grappling",
        "low",
        [],
        ["Mat", "Partner"],
        { sets: 4, reps: 8 },
        ["neck", ...KNEES],
        "Slow reps of the knee-cut pass against a compliant partner. Heavy crossface, underhook first, settle side control before moving on.",
    ),
    exercise(
        "exr-grip-fighting-uchi-mata",
        "Grip fighting & uchi-mata entries",
        "grappling",
        "moderate",
        ["footwork"],
        ["Gi", "Mat", "Partner"],
        { rounds: 5, roundSec: 180 },
        [...HANDS, "lower_back", ...HAMSTRINGS],
        "Win the sleeve-and-collar grip battle, then enter uchi-mata off the partner's step. Uchi-komi reps first, live throws in the last two rounds.",
    ),
    exercise(
        "exr-cage-wall-getups",
        "Cage wall get-ups",
        "grappling",
        "high",
        ["footwork"],
        ["Cage", "Partner"],
        { rounds: 5, roundSec: 120 },
        ["lower_back", ...KNEES, "neck"],
        "Start seated against the fence with the partner in on the legs. Wall-walk up, fight for wrist control and exit to open space before they re-shot.",
    ),
    // Conditioning
    exercise(
        "exr-assault-bike-intervals",
        "Assault bike intervals",
        "conditioning",
        "high",
        [],
        ["Assault bike"],
        { rounds: 10, roundSec: 30 },
        [...KNEES, ...HIPS],
        "Thirty seconds hard, ninety seconds easy spinning. Target wattage is set from the fighter's last conditioning test.",
    ),
    exercise(
        "exr-skipping-rope-rounds",
        "Skipping rope rounds",
        "conditioning",
        "moderate",
        ["footwork"],
        ["Jump rope"],
        { rounds: 3, roundSec: 180 },
        [...ANKLES, ...SHINS],
        "Three-minute rounds mixing double-unders, boxer skips and high knees. Light on the feet, elbows in.",
    ),
    exercise(
        "exr-sprawl-sprint-intervals",
        "Sprawl-and-sprint intervals",
        "conditioning",
        "high",
        ["footwork"],
        ["Mat"],
        { rounds: 6, roundSec: 30 },
        ["lower_back", ...HIPS, ...HANDS],
        "Sprawl, back up and sprint ten metres on the whistle. Hips hit the mat on every sprawl; full recovery walk between rounds.",
    ),
    // Strength
    exercise(
        "exr-trap-bar-deadlift",
        "Trap-bar deadlift",
        "strength",
        "high",
        [],
        ["Trap bar", "Bumper plates"],
        { sets: 4, reps: 5 },
        ["lower_back", ...HAMSTRINGS, ...KNEES, ...HANDS],
        "Working sets at 80–85% of estimated 1RM. Brace before every rep, push the floor away and stop two reps short of failure.",
    ),
    exercise(
        "exr-kettlebell-swings",
        "Kettlebell swings",
        "strength",
        "moderate",
        [],
        ["Kettlebell"],
        { sets: 5, reps: 15 },
        ["lower_back", ...HAMSTRINGS, ...HANDS],
        "Hard hinge, snap the hips and let the bell float to chest height. Explosive hip extension that carries over to kicks and knees.",
    ),
    exercise(
        "exr-bulgarian-split-squat",
        "Bulgarian split squat",
        "strength",
        "moderate",
        [],
        ["Dumbbells", "Bench"],
        { sets: 3, reps: 8 },
        [...KNEES, ...HIPS],
        "Rear foot on the bench, controlled three-second lowering. Knee tracks over the middle toes; same reps each leg.",
    ),
    exercise(
        "exr-weighted-pull-ups",
        "Weighted pull-ups",
        "strength",
        "moderate",
        [],
        ["Pull-up bar", "Dip belt"],
        { sets: 4, reps: 6 },
        [...SHOULDERS, ...ELBOWS, ...HANDS],
        "Dead hang to chin over the bar with a slow lowering. Builds the pulling strength used in the clinch and on grips.",
    ),
    exercise(
        "exr-nordic-hamstring-curls",
        "Nordic hamstring curls",
        "strength",
        "moderate",
        [],
        ["Mat", "Partner or anchor"],
        { sets: 3, reps: 5 },
        [...HAMSTRINGS, ...KNEES],
        "Slow eccentric lowering from kneeling with the hips extended. Hamstring resilience work for kickers and wrestlers.",
    ),
    exercise(
        "exr-neck-bridges-isometric",
        "Neck bridges (isometric)",
        "strength",
        "low",
        [],
        ["Mat"],
        { sets: 3, reps: 5 },
        ["neck"],
        "Front and back bridge holds of 20 seconds each rep, weight on the forehead and feet. Builds the neck strength that protects in the clinch and scrambles.",
    ),
    exercise(
        "exr-band-pull-aparts",
        "Band pull-aparts",
        "strength",
        "low",
        [],
        ["Resistance band"],
        { sets: 3, reps: 20 },
        SHOULDERS,
        "Arms straight, squeeze the shoulder blades and pull the band to the chest. Balances the pressing volume from punching.",
    ),
    // Mobility
    exercise(
        "exr-thoracic-mobility-flow",
        "Thoracic mobility flow",
        "mobility",
        "low",
        [],
        ["Foam roller", "Mat"],
        { sets: 2, reps: 10 },
        [],
        "Foam-roller extensions, open books and thread-the-needle rotations. Restores trunk rotation for rear-hand strikes.",
    ),
    exercise(
        "exr-hip-90-90-flow",
        "Hip 90/90 mobility flow",
        "mobility",
        "low",
        [],
        ["Mat"],
        { sets: 2, reps: 8 },
        HIPS,
        "Seated 90/90 transitions with a pause at end range, then hip airplanes. Keeps the hips open for kicks and guard work.",
    ),
    exercise(
        "exr-shoulder-cars",
        "Shoulder CARs & scapular control",
        "mobility",
        "low",
        [],
        ["Mat"],
        { sets: 2, reps: 5 },
        SHOULDERS,
        "Slow controlled articular rotations through the full pain-free range, followed by wall slides. Stop short of any pinching.",
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
        title: "Fight camp — Lotus Fight Night 18",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        objective: "Peak for Lotus Fight Night 18: sharpen jab-cross entries and fix guard recovery after the lead hook.",
        phase: "fight_camp",
        focusAreas: ["hook", "guard", "jab", "cross"],
        startDay: -28,
        endDay: 41,
        weeklySessionTarget: 7,
        status: "active",
        notes: "Arman Petrosyan is a southpaw pressure fighter — lead-hook counter drilling twice a week. Walk-around weight 67.5 kg before fight week (nutrition with James). Sparring capped at 5 × 3 min until the last hard week.",
        updatedDay: -3,
    },
    {
        id: "tp-minh-build",
        title: "Build block — straight punches & footwork",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        objective: "Raise jab and cross speed and tidy up in-and-out footwork before the camp for Lotus Fight Night 18.",
        phase: "build",
        focusAreas: ["jab", "cross", "footwork"],
        startDay: -91,
        endDay: -29,
        weeklySessionTarget: 6,
        status: "completed",
        notes: "Jab peak speed rose from 7.0 to 7.6 m/s over the block. Hook mechanics carried into the fight camp as the main correction.",
        updatedDay: -29,
    },
    {
        id: "tp-lucas-return",
        title: "Return to training — left hamstring",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        objective:
            "Rebuild training volume inside the restricted clearance while the left hamstring heals: top-position technique, upper-body strength and aerobic base, with no sparring or kicks.",
        phase: "rehab",
        focusAreas: ["guard", "footwork"],
        startDay: -20,
        endDay: 18,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Follows the recovery plan from Dr. Thu Lê. Session RPE capped at 7. Stop any drill that brings hamstring pain above 2/10 and log it in the session notes.",
        createdDay: -23,
        updatedDay: -10,
    },
    {
        id: "tp-lucas-fight-camp",
        title: "Fight camp — Jungle Fight Asia 12",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        objective: "Chain wrestling entries into back takes and keep guard retention sharp against a high-pace opponent.",
        phase: "fight_camp",
        focusAreas: ["footwork", "guard"],
        startDay: -66,
        endDay: -24,
        weeklySessionTarget: 6,
        status: "archived",
        notes: "Archived after the left hamstring strain in sparring 24 days ago. Bout withdrawn.",
        updatedDay: -23,
    },
    {
        id: "tp-aigerim-camp",
        title: "Fight camp — Asian Combat Series 9",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        objective:
            "Beat Mai Hoshino on the counter: turn elite head movement into slip-and-return jabs and clean exits off the ropes.",
        phase: "fight_camp",
        focusAreas: ["head_movement", "jab", "footwork", "combination"],
        startDay: -43,
        endDay: 27,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Hoshino is a volume puncher who leans in on the double jab — sparring partners briefed to pressure. Weight is comfortable at 53.6 kg walking around.",
        updatedDay: -6,
    },
    {
        id: "tp-kenji-technical",
        title: "Technical block — switch-stance entries",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        objective:
            "Refine switch-stance entries and rear-hand mechanics; after the right-shoulder observation, rebuild the cross without the shoulder hitching.",
        phase: "build",
        focusAreas: ["cross", "footwork", "kick", "guard"],
        startDay: -49,
        endDay: 35,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Updated after the restricted clearance 7 days ago: max RPE 8 and protect the right shoulder. Sparring and heavy cross volume removed; kicks, footwork and lead-side work emphasised until the follow-up examination.",
        updatedDay: -7,
    },
    {
        id: "tp-diego-build",
        title: "Build block — striking defence for wrestling entries",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        objective:
            "Tighten striking defence for a pressure wrestler: keep the high guard and move the head off the centreline on entries to the double-leg.",
        phase: "build",
        focusAreas: ["guard", "head_movement", "footwork", "jab"],
        startDay: -45,
        endDay: 39,
        weeklySessionTarget: 4,
        status: "active",
        notes: "On hold — Not Cleared after the concussion in sparring 6 days ago. Do not reschedule training until Dr. Thu Lê clears him through the graded return protocol.",
        updatedDay: -6,
        updatedTime: { hour: 20, minute: 5 },
    },
    {
        id: "tp-linh-championship",
        title: "Championship build — hands to match the kicks",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        objective:
            "Vietnam Amateur MMA Championship: bring the hands up to the level of the kicks — punch accuracy on pads and punch-kick combinations.",
        phase: "build",
        focusAreas: ["jab", "cross", "combination", "kick"],
        startDay: -44,
        endDay: 62,
        weeklySessionTarget: 4,
        status: "active",
        notes: "Four sessions a week around university classes, with one boxing-focused pad session. Switch to a fight camp structure six weeks out.",
        updatedDay: -12,
    },
    {
        id: "tp-marcus-rehab-conditioning",
        title: "Hand fracture — conditioning & footwork",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        objective:
            "Keep conditioning and footwork sharp while the right hand fracture heals: lower-body strength, aerobic base and movement, with no striking.",
        phase: "rehab",
        focusAreas: ["footwork"],
        startDay: -9,
        endDay: 31,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Restricted clearance: no bag, pads or sparring and no punching. No gripping with the right hand — weight vest instead of dumbbells.",
        createdDay: -10,
        updatedDay: -9,
    },
    {
        id: "tp-marcus-power-build",
        title: "Power build — kickboxing",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        objective: "Add power to the right cross and the left body kick while keeping output high over five rounds.",
        phase: "build",
        focusAreas: ["cross", "kick", "combination"],
        startDay: -60,
        endDay: -11,
        weeklySessionTarget: 5,
        status: "archived",
        notes: "Closed early: right 5th metacarpal fracture on the heavy bag 11 days ago.",
        updatedDay: -10,
    },
    {
        id: "tp-sofia-camp",
        title: "Fight camp — Lotus Fight Night 17",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        objective:
            "Beat Renata Lima to the clinch: close distance behind the jab and finish entries with judo throws against the cage.",
        phase: "fight_camp",
        focusAreas: ["jab", "footwork", "guard", "combination"],
        startDay: -47,
        endDay: 19,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Pre-fight medical is due — clearance expires in 5 days. Taper starts 7 days out.",
        updatedDay: -2,
    },
    {
        id: "tp-sofia-build",
        title: "Build block — striking entries for a judoka",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        objective: "Build a reliable jab and a safe path into the clinch so the judo can do the rest.",
        phase: "build",
        focusAreas: ["jab", "footwork", "guard"],
        startDay: -103,
        endDay: -48,
        weeklySessionTarget: 5,
        status: "completed",
        notes: "Jab-led entries up from 3 to 5 per round. Carried into the fight camp.",
        updatedDay: -48,
    },
    {
        id: "tp-hoang-camp",
        title: "Fight camp — Lotus Fight Night 17",
        fighterId: "f-hoang-long",
        coachId: ANNA,
        objective:
            "Beat Pedro Santos at range: sharpen Vovinam kick entries while managing the cut to 56.7 kg and the low-back tightness.",
        phase: "fight_camp",
        focusAreas: ["kick", "footwork", "head_movement", "combination"],
        startDay: -47,
        endDay: 19,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Low-back tightness: mobility in every session and no heavy hinges for the rest of camp. Hydration is only fair — James is tracking daily weight and fluid intake.",
        updatedDay: -4,
    },
    {
        id: "tp-tariq-return",
        title: "Return to boxing — left knee",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        objective:
            "Sport-specific return from the left knee MCL sprain: rebuild pad and bag volume with controlled pivots, with no kicks or sparring until fully cleared.",
        phase: "rehab",
        focusAreas: ["jab", "cross", "guard", "head_movement"],
        startDay: -34,
        endDay: 20,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Pivot off the right foot; no deep lateral lunges. Full-pace mitts allowed since the restricted clearance 5 days ago (max RPE 8).",
        updatedDay: -5,
    },
    {
        id: "tp-tariq-power-build",
        title: "Power build — heavyweight boxing",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        objective: "Sharpen the jab-cross and add lower-body power without losing hand speed at heavyweight.",
        phase: "build",
        focusAreas: ["jab", "cross", "head_movement"],
        startDay: -74,
        endDay: -38,
        weeklySessionTarget: 5,
        status: "archived",
        notes: "Closed early: left knee MCL sprain during strength work 38 days ago.",
        updatedDay: -37,
    },
    {
        id: "tp-emma-build",
        title: "Build block — combination volume",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        objective:
            "Add a southpaw body-kick finish to the 1-2 and raise combination volume ahead of the next title booking.",
        phase: "build",
        focusAreas: ["combination", "kick", "head_movement"],
        startDay: -48,
        endDay: 46,
        weeklySessionTarget: 5,
        status: "active",
        notes: "Consistent block so far. Keep sparring technical — no hard rounds until a bout is confirmed.",
        updatedDay: -8,
    },
    {
        id: "tp-emma-fight-camp",
        title: "Fight camp — Lotus Fight Night 16",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        objective: "Win at range against a pressure striker: teep and pivot off the fence, counter with the straight left.",
        phase: "fight_camp",
        focusAreas: ["kick", "footwork", "cross"],
        startDay: -118,
        endDay: -55,
        weeklySessionTarget: 6,
        status: "completed",
        notes: "Won by unanimous decision. One week of active recovery before the build block.",
        updatedDay: -54,
    },
    {
        id: "tp-bao-foundations",
        title: "Foundations — first 8 weeks",
        fighterId: "f-bao-nguyen",
        coachId: ANNA,
        objective:
            "Build fundamentals for a light-heavyweight amateur: stance, jab-cross, sprawl defence and a strength baseline.",
        phase: "base",
        focusAreas: ["jab", "cross", "footwork", "guard"],
        startDay: 3,
        endDay: 59,
        weeklySessionTarget: 4,
        status: "draft",
        notes: "Draft — activate once Dr. Samuel Brooks completes the baseline physical and a Medical Clearance is on file.",
        updatedDay: -1,
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
        title: "Thai pads — jab-cross-hook entries",
        coach: "striking",
        durationMin: 75,
        targetRpe: 8,
        location: "Striking room",
        exercises: [
            rounds("exr-technical-shadow-boxing", 2, 180),
            rounds("exr-jab-cross-hook-pads", 6, 180),
            rounds("exr-thai-pad-kick-rounds", 3, 120),
            rounds("exr-thai-clinch-knees", 3, 120),
        ],
        summaries: [
            "Crisp entries behind the jab. The lead hook still pulls the right hand off the cheek on the exit — drilled the reset for the last two rounds.",
            "Good pace through every round. Kicks landed on the beat after the cross; clinch knees were strong but the tie was released too early.",
            "Sharper than last session. Right guard stayed up on single hooks but still drops on the 1-2-3 at full speed.",
            "Faded in the last pad round and started loading up on the cross. Keep the jab busy when tired.",
        ],
    },
    boxingPads: {
        type: "pad_work",
        title: "Mitt work — slip & counter",
        coach: "striking",
        durationMin: 60,
        targetRpe: 8,
        location: "Striking room",
        exercises: [
            rounds("exr-skipping-rope-rounds", 2, 180),
            rounds("exr-jab-cross-hook-pads", 6, 180),
            rounds("exr-slip-roll-line", 3, 120),
        ],
        summaries: [
            "Slipped the mitt counters cleanly and returned the jab on time. Feet went a little flat in round five.",
            "Good snap on the jab. The cross lands best with the rear heel turned — hold on to that when tired.",
            "Strong rounds. Rolled under the hook and came back with the right hand every time it was called.",
            "Hands dropped on the exits in the last two rounds. Rear hand back to the chin before stepping out.",
        ],
    },
    kickPads: {
        type: "pad_work",
        title: "Thai pads — punch-kick combinations",
        coach: "striking",
        durationMin: 60,
        targetRpe: 8,
        location: "Striking room",
        exercises: [
            rounds("exr-technical-shadow-boxing", 2, 180),
            rounds("exr-thai-pad-kick-rounds", 5, 120),
            rounds("exr-jab-cross-hook-pads", 4, 180),
        ],
        summaries: [
            "Kicks were sharp. The jab before the kick was lazy — it has to be a real shot, not a range-finder.",
            "Landed the 1-2 into the body kick consistently in the final rounds. Good return to stance.",
            "Checked every low kick the holder returned. Punch accuracy dropped once combinations went past three strikes.",
            "Great energy. Finish combinations with a step off the line instead of standing in front after the kick.",
        ],
    },
    heavyBag: {
        type: "heavy_bag",
        title: "Heavy bag — power & volume rounds",
        coach: "striking",
        durationMin: 60,
        targetRpe: 8,
        location: "Striking room",
        exercises: [rounds("exr-skipping-rope-rounds", 3, 180), rounds("exr-heavy-bag-power-rounds", 6, 180)],
        summaries: [
            "Solid volume, roughly 90 strikes a round. Combinations stayed short with a move off after each one.",
            "Good power on the cross; the hook still loops a little. Shortened it over the last two rounds.",
            "Steady pace. Wrists and alignment good, breathing controlled through all six rounds.",
            "Work rate dipped in rounds five and six but technique held. Conditioning is on track.",
        ],
    },
    kickBag: {
        type: "heavy_bag",
        title: "Kick bag rounds — teep & roundhouse",
        coach: "striking",
        durationMin: 60,
        targetRpe: 8,
        location: "Striking room",
        exercises: [
            rounds("exr-skipping-rope-rounds", 2, 180),
            rounds("exr-teep-roundhouse-bag", 5, 180),
            rounds("exr-heavy-bag-power-rounds", 3, 180),
        ],
        summaries: [
            "Roundhouse power is excellent. Punch rounds at the end got sloppy — the elbow flares on the hook.",
            "Teep timing was great. Set the kick up with the hands instead of throwing it cold.",
            "Good hip turn on every kick and a quick return to stance. Output stayed high in all eight rounds.",
            "Lead-leg teep is landing with the ball of the foot now. Hands still trail behind the kicks.",
        ],
    },
    sparring: {
        type: "sparring",
        title: "Controlled sparring — 5 × 3 min",
        coach: "striking",
        durationMin: 60,
        targetRpe: 9,
        location: "Cage",
        exercises: [rounds("exr-technical-shadow-boxing", 2, 180), rounds("exr-controlled-sparring", 5, 180)],
        summaries: [
            "Controlled rounds at the right intensity. Won the jab exchanges; caught by the same counter twice when exiting straight back.",
            "Good composure under pressure. Used angles off the fence well in rounds three and four.",
            "Clean work. Circled into the partner's power hand twice — we'll drill that exit on pads.",
            "Stayed technical and didn't brawl after getting tagged. Head movement on the entries was the highlight.",
        ],
    },
    hookTechnique: {
        type: "technical_drilling",
        title: "Technical drilling — guard reset after the lead hook",
        coach: "striking",
        durationMin: 60,
        targetRpe: 6,
        location: "Striking room",
        exercises: [
            rounds("exr-guard-reset-reaction", 5, 120),
            rounds("exr-southpaw-lead-hook-counter", 5, 180),
            rounds("exr-pivot-angle-ladder", 3, 120),
        ],
        summaries: [
            "Slow, focused reps. Rear hand back on the cheek on about four out of five hooks by the end.",
            "The noodle caught the open side early on, much less once the hook got shorter.",
            "Worked the southpaw counter off the parry. Timing is getting there; the step outside the lead foot needs to come earlier.",
        ],
    },
    defenceTechnique: {
        type: "technical_drilling",
        title: "Defensive drilling — slip, roll, counter",
        coach: "striking",
        durationMin: 60,
        targetRpe: 6,
        location: "Striking room",
        exercises: [
            rounds("exr-slip-roll-line", 5, 120),
            rounds("exr-parry-catch-counter", 4, 180),
            rounds("exr-pivot-angle-ladder", 3, 120),
        ],
        summaries: [
            "Head movement was sharp and the counters after the roll are coming faster.",
            "Parries were clean on the jab. The cross was caught too high and pushed the head back — catch it at the forehead.",
            "Excellent rhythm on the slip line with the feet under the body the whole time.",
            "Turned slips into counters in the last rounds without being prompted.",
        ],
    },
    kickTechnique: {
        type: "technical_drilling",
        title: "Technical drilling — kick entries & checks",
        coach: "striking",
        durationMin: 60,
        targetRpe: 6,
        location: "Striking room",
        exercises: [
            rounds("exr-thai-pad-kick-rounds", 4, 120),
            rounds("exr-kick-catch-defence", 4, 120),
            rounds("exr-pivot-angle-ladder", 3, 120),
        ],
        summaries: [
            "Switch-kick entries were quick and the checks came up on time.",
            "Good kick-catch defence. Hop in and frame sooner when the leg gets caught.",
            "Kicks landed off the jab feint, not cold. Return to stance still a beat slow on the body kick.",
        ],
    },
    shadowBoxing: {
        type: "shadow_boxing",
        title: "Technical shadow boxing",
        coach: "striking",
        durationMin: 45,
        targetRpe: 5,
        location: "Striking room",
        exercises: [
            rounds("exr-technical-shadow-boxing", 5, 180),
            rounds("exr-footwork-shadow-rounds", 3, 120),
            sets("exr-thoracic-mobility-flow", 2, 10),
        ],
        summaries: [
            "Deliberate rounds. Every combination finished with a defensive move and an angle change.",
            "Good visualisation work. Stance width stayed consistent through the footwork rounds.",
            "Relaxed shoulders and quick hands. Guard stayed high between combinations.",
        ],
    },
    wrestling: {
        type: "grappling",
        title: "Wrestling — double-leg chains & cage get-ups",
        coach: "grappling",
        durationMin: 75,
        targetRpe: 8,
        location: "Cage",
        exercises: [
            sets("exr-wall-walk-shots", 4, 8),
            rounds("exr-double-leg-chain", 5, 180),
            rounds("exr-cage-wall-getups", 4, 120),
        ],
        summaries: [
            "Shots were deep with the head up. Switched to the single as soon as the partner sprawled.",
            "Cage get-ups were strong. Win the wrist control before standing, not after.",
            "Good pace in the live rounds. The finish on the far-ankle trip needs a sharper angle.",
        ],
    },
    bjj: {
        type: "grappling",
        title: "BJJ — guard retention positional rounds",
        coach: "grappling",
        durationMin: 90,
        targetRpe: 7,
        location: "Main mat",
        exercises: [
            sets("exr-hip-escape-chains", 4, 10),
            rounds("exr-guard-retention-rounds", 6, 240),
            sets("exr-pressure-passing-drill", 3, 8),
        ],
        summaries: [
            "Guard retention was excellent — only passed once in six rounds.",
            "Framing on the hip escapes is clean. Recovered guard every time the passer went around.",
            "Good pressure on top. Settle side control before hunting the submission.",
        ],
    },
    judo: {
        type: "grappling",
        title: "Judo — grip fighting & uchi-mata entries",
        coach: "grappling",
        durationMin: 75,
        targetRpe: 8,
        location: "Main mat",
        exercises: [
            rounds("exr-grip-fighting-uchi-mata", 6, 180),
            sets("exr-hip-escape-chains", 3, 10),
            rounds("exr-cage-wall-getups", 3, 120),
        ],
        summaries: [
            "Won the grip battle early in most rounds and hit uchi-mata off the partner's step.",
            "Throw entries were fast. Keep the posture tall when the partner stiff-arms the collar grip.",
            "Strong session. Cage get-ups after the throw attempt were much quicker than last week.",
        ],
    },
    grapplingBasics: {
        type: "grappling",
        title: "Grappling fundamentals — sprawl, shrimp, stand-up",
        coach: "grappling",
        durationMin: 60,
        targetRpe: 6,
        location: "Main mat",
        exercises: [
            sets("exr-hip-escape-chains", 4, 10),
            rounds("exr-sprawl-sprint-intervals", 6, 30),
            sets("exr-wall-walk-shots", 3, 6),
        ],
        summaries: [
            "Learning fast. Sprawls are getting lower; the hips still land a little late.",
            "Shrimping mechanics are much cleaner. Keep the elbows tight while framing.",
            "Good attitude and work rate. Technical stand-up still comes up on the wrong hand.",
        ],
    },
    strength: {
        type: "strength_conditioning",
        title: "Strength — trap-bar deadlift & single-leg work",
        coach: "sc",
        durationMin: 60,
        targetRpe: 7,
        location: "S&C floor",
        exercises: [
            sets("exr-trap-bar-deadlift", 4, 5),
            sets("exr-bulgarian-split-squat", 3, 8),
            sets("exr-weighted-pull-ups", 4, 6),
            sets("exr-neck-bridges-isometric", 3, 5),
            sets("exr-band-pull-aparts", 3, 20),
        ],
        summaries: [
            "All working sets completed with good bar speed. Added 5 kg to the trap-bar top set.",
            "Solid session. Split squats slowed on the last set — kept the load, no increase next week.",
            "Bar speed dropped on set four so the set was cut at three reps. Recovery from sparring still showing.",
        ],
    },
    conditioning: {
        type: "strength_conditioning",
        title: "Conditioning — bike intervals & sprawls",
        coach: "sc",
        durationMin: 45,
        targetRpe: 8,
        location: "S&C floor",
        exercises: [
            rounds("exr-assault-bike-intervals", 10, 30),
            rounds("exr-sprawl-sprint-intervals", 6, 30),
            rounds("exr-skipping-rope-rounds", 3, 180),
        ],
        summaries: [
            "Held target power on all ten bike intervals. Heart rate came down well between efforts.",
            "Last three bike intervals dropped about 8% in power. Sprawls stayed sharp.",
            "Strong conditioning day — best average power this block.",
        ],
    },
    recovery: {
        type: "recovery_mobility",
        title: "Recovery & mobility",
        coach: "sc",
        durationMin: 40,
        targetRpe: 3,
        location: "Recovery room",
        exercises: [
            sets("exr-thoracic-mobility-flow", 2, 10),
            sets("exr-hip-90-90-flow", 2, 8),
            sets("exr-shoulder-cars", 2, 5),
        ],
        summaries: [
            "Easy flow session. Reported normal soreness, sleep 7.5 h.",
            "Mobility work done. Hips opened up well by the second set.",
            "Light recovery after a hard week. Trunk rotation felt freer by the end.",
        ],
    },
    taperPads: {
        type: "pad_work",
        title: "Taper — short sharp mitt rounds",
        coach: "striking",
        durationMin: 40,
        targetRpe: 6,
        location: "Striking room",
        exercises: [rounds("exr-jab-cross-hook-pads", 4, 120), rounds("exr-slip-roll-line", 2, 120)],
        summaries: ["Short and sharp. Timing looks fight-ready.", "Crisp rounds, no fatigue carried over."],
    },
    lucasTopDrilling: {
        type: "technical_drilling",
        title: "Top-position drilling — no explosive hip extension",
        coach: "grappling",
        durationMin: 60,
        targetRpe: 5,
        location: "Main mat",
        exercises: [
            sets("exr-pressure-passing-drill", 4, 8),
            sets("exr-hip-escape-chains", 3, 10, "Slow tempo — stop if the left hamstring pulls."),
            sets("exr-thoracic-mobility-flow", 2, 10),
        ],
        summaries: [
            "Patient knee-cut reps with a heavy crossface. No hamstring symptoms reported.",
            "Technical session at low intensity. Hip escapes pain-free at slow tempo.",
            "Good focus on top pressure. Mild tightness in the left hamstring on the last hip-escape set — stopped the set as planned.",
        ],
    },
    lucasUpperBody: {
        type: "strength_conditioning",
        title: "Upper-body strength & low-impact conditioning",
        coach: "sc",
        durationMin: 50,
        targetRpe: 6,
        location: "S&C floor",
        exercises: [
            sets("exr-weighted-pull-ups", 4, 6),
            sets("exr-band-pull-aparts", 3, 20),
            rounds("exr-assault-bike-intervals", 8, 30, "Seated, moderate resistance — no standing sprints."),
        ],
        summaries: [
            "Pull-ups moving well. Bike intervals stayed seated with no hamstring symptoms.",
            "Good upper-body session. Aerobic base holding up despite the lower volume.",
            "Completed as planned. Heart rate recovery between bike intervals improving.",
        ],
    },
    lucasLightGrappling: {
        type: "grappling",
        title: "BJJ — light positional rounds (top only)",
        coach: "grappling",
        durationMin: 60,
        targetRpe: 6,
        location: "Main mat",
        exercises: [
            sets("exr-pressure-passing-drill", 5, 8),
            sets("exr-hip-escape-chains", 3, 10, "Controlled tempo only."),
            sets("exr-neck-bridges-isometric", 3, 5),
        ],
        summaries: [
            "Top-only rounds at controlled pace. Passing pressure is back to normal.",
            "Stayed inside the limits — no scrambles, no explosive bridging. Hamstring felt fine.",
            "Good session. Partner kept resistance light as agreed.",
        ],
    },
    marcusFootwork: {
        type: "technical_drilling",
        title: "Footwork & movement — hands in guard",
        coach: "striking",
        durationMin: 50,
        targetRpe: 6,
        location: "Striking room",
        exercises: [
            rounds("exr-footwork-shadow-rounds", 5, 120, "Right hand relaxed in the guard — no fist."),
            rounds("exr-pivot-angle-ladder", 4, 120),
            rounds("exr-cage-cutting-footwork", 3, 180),
        ],
        summaries: [
            "Sharp footwork rounds. Cut the cage with lateral steps instead of following.",
            "Good pivots off the lead foot. Stance width stayed consistent at pace.",
            "Movement quality is high. No pain reported in the right hand.",
        ],
    },
    marcusConditioning: {
        type: "strength_conditioning",
        title: "Conditioning — bike intervals & lower-body strength",
        coach: "striking",
        durationMin: 50,
        targetRpe: 7,
        location: "S&C floor",
        exercises: [
            rounds("exr-assault-bike-intervals", 10, 30),
            sets("exr-bulgarian-split-squat", 3, 8, "Weight vest only — no gripping with the right hand."),
            sets("exr-nordic-hamstring-curls", 3, 5),
        ],
        summaries: [
            "Bike power holding well. Split squats with the weight vest felt easy — progress next week.",
            "Good session. Hand stayed in the splint and was never loaded.",
            "Strong intervals, all ten at target power.",
        ],
    },
    kenjiKickBag: {
        type: "heavy_bag",
        title: "Kick bag rounds — kicks only",
        coach: "striking",
        durationMin: 50,
        targetRpe: 7,
        location: "Striking room",
        exercises: [rounds("exr-skipping-rope-rounds", 2, 180), rounds("exr-teep-roundhouse-bag", 6, 180)],
        summaries: [
            "Kicks-only rounds with the hands in guard. Right shoulder comfortable throughout.",
            "Switch roundhouse is fast and loud on the bag. Kept the RPE under the cap.",
            "Good work. Guard stayed relaxed rather than tense on the right side.",
        ],
    },
    kenjiShadow: {
        type: "shadow_boxing",
        title: "Shadow boxing — lead side & kicks only",
        coach: "striking",
        durationMin: 45,
        targetRpe: 5,
        location: "Striking room",
        exercises: [
            rounds("exr-technical-shadow-boxing", 4, 180, "Jab, lead hook and kicks only — no cross."),
            rounds("exr-footwork-shadow-rounds", 3, 120),
            sets("exr-shoulder-cars", 2, 5),
        ],
        summaries: [
            "Lead-side rounds were clean. Shoulder CARs pain-free through the full range.",
            "Good stance switching behind the jab. No discomfort reported.",
        ],
    },
    kenjiLowerBody: {
        type: "strength_conditioning",
        title: "Lower-body strength & bike",
        coach: "striking",
        durationMin: 50,
        targetRpe: 7,
        location: "S&C floor",
        exercises: [
            sets("exr-bulgarian-split-squat", 3, 8),
            sets("exr-nordic-hamstring-curls", 3, 5),
            rounds("exr-assault-bike-intervals", 8, 30),
            sets("exr-shoulder-cars", 2, 5),
        ],
        summaries: [
            "Lower-body work done with good control. Bike intervals kept under the RPE cap.",
            "Solid session; the right shoulder was not loaded at any point.",
        ],
    },
    hoangStrength: {
        type: "strength_conditioning",
        title: "Strength — single-leg & posterior chain (no heavy hinges)",
        coach: "sc",
        durationMin: 50,
        targetRpe: 6,
        location: "S&C floor",
        exercises: [
            sets("exr-bulgarian-split-squat", 3, 8),
            sets("exr-nordic-hamstring-curls", 3, 5),
            sets("exr-band-pull-aparts", 3, 20),
            sets("exr-hip-90-90-flow", 2, 8),
        ],
        summaries: [
            "Kept the load moderate during the cut. Low back felt stable through the split squats.",
            "Good session. Energy a little low — weight is coming down on schedule.",
            "Completed all sets. Some low-back tightness at the start eased after the hip flow.",
        ],
    },
    tariqUpperBody: {
        type: "strength_conditioning",
        title: "Upper-body strength & bike",
        coach: "sc",
        durationMin: 50,
        targetRpe: 6,
        location: "S&C floor",
        exercises: [
            sets("exr-weighted-pull-ups", 4, 6),
            sets("exr-band-pull-aparts", 3, 20),
            rounds("exr-assault-bike-intervals", 8, 30, "Seated only — no standing efforts."),
        ],
        summaries: [
            "Upper-body strength holding well. Bike intervals pain-free.",
            "Good session. Left knee comfortable on the bike at moderate resistance.",
        ],
    },
    tariqControlledPads: {
        type: "pad_work",
        title: "Mitt work — controlled pivots",
        coach: "striking",
        durationMin: 50,
        targetRpe: 6,
        location: "Striking room",
        exercises: [
            rounds("exr-jab-cross-hook-pads", 5, 180, "Pivot on the right foot only — minimal twist on the left knee."),
            rounds("exr-parry-catch-counter", 3, 180),
        ],
        summaries: [
            "Hands are sharp. Movement stayed linear and controlled as planned.",
            "Good rhythm on the mitts. Stood a little tall to protect the knee — reminded to stay in stance.",
            "Five rounds at controlled pace, no knee symptoms.",
        ],
    },
    baoStriking: {
        type: "technical_drilling",
        title: "Striking fundamentals — stance, jab, cross",
        coach: "striking",
        durationMin: 60,
        targetRpe: 5,
        location: "Striking room",
        exercises: [
            rounds("exr-technical-shadow-boxing", 4, 180, "Stance and jab-cross only."),
            rounds("exr-jab-cross-hook-pads", 4, 180, "Jab and cross only — no hooks yet."),
            rounds("exr-footwork-shadow-rounds", 2, 120),
        ],
        summaries: [
            "Stance is getting narrower and more balanced. The jab still pushes rather than snaps.",
            "Good first pad rounds. Chin comes up on the cross — keep it tucked behind the shoulder.",
        ],
    },
    baoStrengthBaseline: {
        type: "strength_conditioning",
        title: "Strength baseline — technique & testing",
        coach: "sc",
        durationMin: 60,
        targetRpe: 6,
        location: "S&C floor",
        exercises: [
            sets("exr-trap-bar-deadlift", 3, 5, "Technique and estimated 1RM only."),
            sets("exr-weighted-pull-ups", 3, 5, "Bodyweight first set."),
            rounds("exr-assault-bike-intervals", 6, 30),
        ],
        summaries: [
            "Good hinge pattern for a new athlete. Estimated trap-bar 1RM around 180 kg.",
            "Aerobic base is below the team average — conditioning will be a priority in the foundations plan.",
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

const NOT_CLEARED_CONCUSSION = "Medical: not cleared (concussion protocol)";

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
        title: "Thai pads — 8 rounds, jab-cross-hook entries",
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
                "Sharp jab-cross entries through all eight pad rounds. Right hand drifts off the cheek after the lead hook, worst in rounds 6–8 as fatigue set in. Filmed from the side for AI review.",
        },
        videoIds: ["v-minh-pads-2d"],
        notes: "Filmed from the side — all eight pad rounds.",
    },
    {
        id: "s-minh-bag-today",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        blueprint: "heavyBag",
        day: 0,
        hour: 7,
        minute: 0,
        title: "Heavy bag — volume rounds",
        targetRpe: 7,
        result: {
            actualDurationMin: 58,
            rpe: 7,
            roundsCompleted: 9,
            coachRating: 4,
            summary:
                "Steady 6 × 3 min on the bag. Hook kept shorter and the right hand came home on most reps — better than on pads two days ago. Footage uploaded for analysis.",
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
                "Five controlled rounds with a southpaw partner. The jab won the range early, but he exited straight back twice and ate the counter left. Good composure otherwise.",
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
                "Good volume, but the right shoulder hitched up on the cross from round four and Kenji described it as tight. Dropped the cross for the last two rounds and asked him to raise it with Dr. Thu Lê.",
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
                "Stopped in round 4 of bag work — sharp pain in the right hand after a cross landed. Swelling over the little-finger knuckle. Iced, splinted and sent to Dr. Thu Lê for an X-ray.",
            unfinishedExerciseIds: ["exr-heavy-bag-power-rounds"],
        },
        videoIds: ["v-marcus-bag-11d"],
        notes: "Session cut short: right hand injury in round 4.",
    },
    {
        id: "s-diego-sparring-6d",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        blueprint: "sparring",
        day: -6,
        hour: 18,
        minute: 0,
        title: "MMA sparring — strikes to takedowns",
        result: {
            actualDurationMin: 38,
            rpe: 8,
            roundsCompleted: 4,
            coachRating: 2,
            summary:
                "Stopped in round 3 after a hard exchange — Diego was unsteady on his feet and slow to recover his guard. Removed from the session and concussion protocol started with Dr. Thu Lê.",
            unfinishedExerciseIds: ["exr-controlled-sparring"],
        },
        videoIds: ["v-diego-sparring-6d"],
        notes: "Session stopped in round 3 (suspected concussion).",
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
        title: "MMA sparring — wrestling-heavy rounds",
        result: {
            actualDurationMin: 30,
            rpe: 8,
            roundsCompleted: 3,
            coachRating: 2,
            summary:
                "Felt a sharp pull high in the left hamstring on a single-leg shot in round 2. Stopped immediately, ice and compression applied, referred to Dr. Thu Lê for assessment.",
            unfinishedExerciseIds: ["exr-controlled-sparring"],
        },
        videoIds: [],
        notes: "Session stopped in round 2: left hamstring.",
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
                "Best head-movement session of the camp — slipped the mitt counters and came straight back with the jab. Feet squared up on a few rolls under the hook.",
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
                "Kick-heavy rounds: roundhouse power excellent and the teep landing clean. Hands trailed behind the kicks again — the punch rounds at the end were the weakest part.",
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
                "Composed, technical rounds. Rolled under the hook and came back with the 1-2 to the body kick again and again. Filmed for AI review.",
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
        title: "Mitt work — jab entries to the clinch",
        result: {
            actualDurationMin: 60,
            rpe: 7,
            roundsCompleted: 11,
            coachRating: 4,
            summary:
                "Jab-led entries were sharp and closed the distance well. Hands dropped after breaking the clinch — framed out properly in the last rounds.",
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
                "Kicks looked stiff through the trunk with the low-back tightness back again, and rear-hand strikes lacked rotation. Early session — lighting in the room was poor for filming.",
        },
        videoIds: ["v-hoang-shadow-7d"],
        notes: "Filmed before the main lights were switched on.",
    },
    {
        id: "s-tariq-sc-38d",
        fighterId: "f-tariq-haddad",
        coachId: JAMES,
        blueprint: "strength",
        day: -38,
        hour: 8,
        minute: 0,
        title: "Strength — single-leg & lateral work",
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
                "Left knee buckled inward on the third set of split squats with pain on the inside of the knee. Stopped the session, iced and referred to Dr. Samuel Brooks.",
            unfinishedExerciseIds: ["exr-bulgarian-split-squat", "exr-band-pull-aparts"],
        },
        videoIds: [],
        notes: "Session stopped: left knee injury.",
    },
];

function registrySession(spec: RegistrySessionSpec): TrainingSession {
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
                cancellationReason: "Medical: left hamstring strain — rest until assessed by Dr. Thu Lê",
            },
            {
                fromDay: -20,
                week: LUCAS_EARLY_REHAB,
                maxRpe: 6,
                notes: "Recovery phase: no sparring, no kicks, no explosive hip extension.",
            },
            {
                fromDay: -10,
                week: LUCAS_REHAB,
                maxRpe: 7,
                notes: "Restricted clearance: no sparring, no kicks, max RPE 7, protect the left hamstring.",
            },
        ],
    },
    { fighterId: "f-aigerim-sadykova", phases: [{ fromDay: -60, week: AIGERIM_CAMP }] },
    {
        fighterId: "f-kenji-morita",
        phases: [
            { fromDay: -60, week: KENJI_BUILD },
            { fromDay: -8, week: KENJI_RESTRICTED, maxRpe: 8, notes: "Right shoulder under review — no cross volume or sparring." },
            { fromDay: -7, week: KENJI_RESTRICTED, maxRpe: 8, notes: "Restricted clearance: max RPE 8, protect the right shoulder." },
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
                cancellationReason: "Medical: right hand injury — awaiting X-ray results and clearance",
            },
            {
                fromDay: -9,
                week: MARCUS_REHAB,
                notes: "Restricted clearance: no bag, pads or sparring; no punching; protect the right hand.",
            },
        ],
    },
    {
        fighterId: "f-sofia-kowalski",
        phases: [
            { fromDay: -60, week: SOFIA_CAMP },
            { fromDay: 12, week: FIGHT_WEEK_TAPER, notes: "Fight-week taper." },
        ],
    },
    {
        fighterId: "f-hoang-long",
        phases: [
            { fromDay: -60, week: HOANG_CAMP },
            { fromDay: 12, week: FIGHT_WEEK_TAPER, notes: "Fight-week taper — weight cut in progress." },
        ],
    },
    {
        fighterId: "f-tariq-haddad",
        phases: [
            { fromDay: -60, week: TARIQ_BUILD },
            {
                fromDay: -38,
                week: TARIQ_BUILD,
                cancellationReason: "Medical: left knee sprain — awaiting assessment by Dr. Samuel Brooks",
            },
            { fromDay: -34, week: TARIQ_EARLY_REHAB, maxRpe: 6, notes: "Early rehab: seated conditioning only, no pivoting." },
            {
                fromDay: -20,
                week: TARIQ_CONTROLLED_RETURN,
                maxRpe: 7,
                notes: "Controlled return: pivot off the right foot, no kicks or sparring.",
            },
            {
                fromDay: -5,
                week: TARIQ_SPORT_RETURN,
                maxRpe: 8,
                notes: "Restricted clearance: no kicks, no sparring, max RPE 8, protect the left knee.",
            },
        ],
    },
    { fighterId: "f-emma-lindqvist", phases: [{ fromDay: -60, week: EMMA_BUILD }] },
    { fighterId: "f-bao-nguyen", phases: [{ fromDay: -11, week: BAO_INTRO, notes: "Intro block — baseline physical pending." }] },
];

/** Generated calendar: from the Monday six weeks before the current week to two weeks ahead. */
const FIRST_DAY = mondayOffset() - 42;
const LAST_DAY = 14;

const FLOOD_DAY = -17;
const FLOOD_REASON = "Academy closed early — street flooding after heavy rain";
const MISSED_RATE = 0.035;
const MISSED_NOTES = [
    "No-show — messaged the coach afterwards (overslept).",
    "Missed: stuck in traffic after heavy rain.",
    "Missed: stomach bug, stayed home to recover.",
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

function generateSessions(): TrainingSession[] {
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

export const mockTrainingSessions: TrainingSession[] = generateSessions();

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
        body: "Your right hand drifts off your cheek after the lead hook — worst in rounds 6–8 when you tired. Reset the rear hand to guard before you step out, even if it costs you the follow-up shot.",
    },
    {
        id: "fb-minh-pads-2d-entries",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["jab", "cross"],
        sessionId: "s-minh-pads-2d",
        videoId: "v-minh-pads-2d",
        body: "Jab-cross entries were the best they've looked this camp. You're stepping in behind the jab instead of reaching, and the cross lands with the rear heel turned.",
    },
    {
        id: "fb-minh-bag-today",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "note",
        techniques: ["hook", "guard"],
        sessionId: "s-minh-bag-today",
        videoId: "v-minh-bag-today",
        body: "Shorter hook today and the right hand came home on most reps. Let's see whether the AI guard numbers agree once the analysis finishes.",
    },
    {
        id: "fb-minh-sparring-16d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["footwork", "head_movement"],
        sessionId: "s-minh-sparring-16d",
        videoId: "v-minh-sparring-16d",
        body: "Exiting straight back after your combination let him walk you onto the counter left twice. Take the exit at an angle off the lead foot and keep your head off the centreline.",
    },
    {
        id: "fb-minh-shadow-9d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["footwork", "combination"],
        videoId: "v-minh-shadow-9d",
        day: -9,
        body: "Great shadow rounds — every combination finished with a pivot or a step off the line. Take that habit onto the pads.",
    },
    {
        id: "fb-minh-hook-mechanics-20d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["hook"],
        nearType: "technical_drilling",
        day: -20,
        body: "The lead hook still loops wide when you throw it off the jab. Keep the elbow in line with the fist and turn the lead foot, not just the shoulder.",
    },
    {
        id: "fb-minh-body-kick-26d",
        fighterId: "f-minh-tran",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["kick", "combination"],
        nearType: "pad_work",
        day: -26,
        body: "Cross to body kick is landing on the beat now. That's the finish we want against a southpaw.",
    },
    {
        id: "fb-minh-wrestling-12d",
        fighterId: "f-minh-tran",
        coachId: ANNA,
        kind: "note",
        techniques: ["footwork"],
        nearType: "grappling",
        day: -12,
        body: "Sprawl reactions are sharp. After you stuff the shot, circle off the cage instead of staying on the fence.",
    },
    {
        id: "fb-minh-strength-6d",
        fighterId: "f-minh-tran",
        coachId: JAMES,
        kind: "note",
        techniques: [],
        nearType: "strength_conditioning",
        day: -6,
        body: "Trap-bar 4 × 5 at 140 kg moved well. You're at 68.9 kg — on schedule for the walk-around target, so keep the carbs around training.",
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
        body: "Head movement was outstanding — slipping the mitt counters and coming straight back with the jab. That's exactly the rhythm for Hoshino.",
    },
    {
        id: "fb-aigerim-pads-3d-feet",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["footwork", "head_movement"],
        sessionId: "s-aigerim-pads-3d",
        videoId: "v-aigerim-pads-3d",
        body: "You square your feet when you roll under the hook. Keep the rear heel light and your stance width so you can counter straight from the roll.",
    },
    {
        id: "fb-aigerim-sparring-15d",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["jab", "head_movement"],
        nearType: "sparring",
        day: -15,
        body: "Too many slips without a return. Every slip needs a shot back — even a pawing jab keeps a volume puncher honest.",
    },
    {
        id: "fb-aigerim-defence-30d",
        fighterId: "f-aigerim-sadykova",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["guard"],
        nearType: "technical_drilling",
        day: -30,
        body: "Parry-catch-counter was crisp. You're catching the cross at the forehead now instead of above it.",
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
        body: "Your right shoulder was hitching up on the cross in the second half and you said it felt tight. Tell Dr. Thu Lê before your next hard session — no cross volume until she has examined it.",
    },
    {
        id: "fb-kenji-switch-25d",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["footwork", "guard"],
        nearType: "sparring",
        day: -25,
        body: "When you switch to southpaw the rear hand leaves your chin as you step. Switch behind the jab so the guard stays set.",
    },
    {
        id: "fb-kenji-kicks-4d",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["kick", "footwork"],
        nearType: "technical_drilling",
        day: -4,
        body: "Switch-kick entries are sharp and your stance switches are cleaner. Good use of the restricted weeks.",
    },
    {
        id: "fb-kenji-shadow-2d",
        fighterId: "f-kenji-morita",
        coachId: RAFAEL,
        kind: "note",
        techniques: ["guard", "footwork"],
        nearType: "shadow_boxing",
        day: -2,
        body: "Lead side and kicks only, as agreed, and RPE kept at 5. Shoulder felt fine through the CARs — mention that at your follow-up exam.",
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
        body: "We stopped the session in round 3 because you were unsteady and slow to get the guard back. No training until Dr. Thu Lê clears you — rest is the training right now.",
    },
    {
        id: "fb-diego-level-change-20d",
        fighterId: "f-diego-alvarez",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["guard", "head_movement"],
        nearType: "pad_work",
        day: -20,
        body: "Your chin comes up and your head stays on the centreline as you level-change. Keep the high guard and move the head off the line before you shoot.",
    },
    {
        id: "fb-diego-wrestling-13d",
        fighterId: "f-diego-alvarez",
        coachId: ANNA,
        kind: "praise",
        techniques: [],
        nearType: "grappling",
        day: -13,
        body: "Double-to-single chain was relentless today. Great finish on the far-ankle trip.",
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
        body: "Roundhouse power is excellent and your return to stance is quick. The teep is landing with the ball of the foot every time.",
    },
    {
        id: "fb-linh-bag-5d-hands",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["jab", "combination"],
        sessionId: "s-linh-bag-5d",
        videoId: "v-linh-bag-5d",
        body: "Hands trailed behind the kicks again. Lead with a real jab — not a range-finder — and finish the kick-punch combinations with the cross.",
    },
    {
        id: "fb-linh-cross-10d",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["cross"],
        nearType: "pad_work",
        day: -10,
        body: "Your cross falls short because the rear foot isn't turning. Heel up, hip through, then straight back to guard.",
    },
    {
        id: "fb-linh-combo-19d",
        fighterId: "f-linh-pham",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["combination", "kick"],
        nearType: "pad_work",
        day: -19,
        body: "1-2 into the body kick landed clean on most reps. That combination is ready for sparring.",
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
        body: "Session stopped in round 4 with pain in the right hand after the cross. The doctor makes the call on everything from here — we'll keep your legs and lungs working in the meantime.",
    },
    {
        id: "fb-marcus-conditioning-6d",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        kind: "note",
        techniques: [],
        nearType: "strength_conditioning",
        day: -6,
        body: "Bike intervals averaged 628 W — good work. Split squats with the weight vest only; no gripping dumbbells with the right hand.",
    },
    {
        id: "fb-marcus-footwork-3d",
        fighterId: "f-marcus-hale",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["footwork"],
        nearType: "technical_drilling",
        day: -3,
        body: "Footwork rounds were sharp — you cut the cage with lateral steps instead of chasing. Keep the right hand relaxed in the guard, no fist.",
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
        body: "Jab-led entries were sharp and you closed the distance behind them. Much better than last month.",
    },
    {
        id: "fb-sofia-pads-8d-guard",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        kind: "correction",
        techniques: ["guard"],
        sessionId: "s-sofia-pads-8d",
        videoId: "v-sofia-pads-8d",
        body: "After the clinch break you drop both hands. Frame out with the forearms and bring the guard up before you disengage.",
    },
    {
        id: "fb-sofia-judo-2d",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        kind: "praise",
        techniques: [],
        nearType: "grappling",
        day: -2,
        body: "Uchi-mata entries off the cage landed in live rounds and you won the grips early. That's the fight plan working.",
    },
    {
        id: "fb-sofia-prefight-medical-1d",
        fighterId: "f-sofia-kowalski",
        coachId: ANNA,
        kind: "note",
        techniques: [],
        day: -1,
        body: "Your Medical Clearance expires in five days and the pre-fight medical is due. Book it with Dr. Samuel Brooks this week so camp isn't interrupted.",
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
        body: "Kicks looked stiff through the trunk this morning — the low back again. Do the mobility flow before every session this week, and film the next one after 8:00 when the lights are on.",
    },
    {
        id: "fb-hoang-kicks-4d",
        fighterId: "f-hoang-long",
        coachId: ANNA,
        kind: "praise",
        techniques: ["kick", "combination"],
        nearType: "pad_work",
        day: -4,
        body: "Lead-leg kick entries were fast and landed off the jab. Keep that sharpness through the cut.",
    },
    {
        id: "fb-hoang-weight-3d",
        fighterId: "f-hoang-long",
        coachId: JAMES,
        kind: "note",
        techniques: [],
        nearType: "strength_conditioning",
        day: -3,
        body: "59.8 kg this morning. Hydration was only fair — add two litres a day until the water cut starts in fight week.",
    },
    // Tariq
    {
        id: "fb-tariq-knee-38d",
        fighterId: "f-tariq-haddad",
        coachId: JAMES,
        kind: "note",
        techniques: [],
        sessionId: "s-tariq-sc-38d",
        body: "Stopped the session after the left knee buckled on the split squat. Ice and compression tonight, and see Dr. Samuel Brooks first thing tomorrow.",
    },
    {
        id: "fb-tariq-posture-15d",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["guard", "footwork"],
        nearType: "pad_work",
        day: -15,
        body: "You're protecting the left knee by standing tall and square. Stay in your stance — we control the pivots, not your posture.",
    },
    {
        id: "fb-tariq-mitts-2d",
        fighterId: "f-tariq-haddad",
        coachId: RAFAEL,
        kind: "praise",
        techniques: ["jab", "cross"],
        nearType: "pad_work",
        day: -2,
        body: "First full-pace mitt rounds back. The jab looked like pre-injury speed and you pivoted off the right foot as planned.",
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
        body: "Composed, technical rounds. You rolled under the hook and came back with the 1-2 to the body kick every time. The footage is queued for AI review.",
    },
    {
        id: "fb-emma-body-kick-8d",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        kind: "correction",
        techniques: ["kick"],
        nearType: "heavy_bag",
        day: -8,
        body: "The body kick drops to hip height when you're tired. Kick through the ribs, not at the bag.",
    },
    {
        id: "fb-emma-counter-22d",
        fighterId: "f-emma-lindqvist",
        coachId: RAFAEL,
        kind: "note",
        techniques: ["guard", "cross"],
        nearType: "technical_drilling",
        day: -22,
        body: "Try catching the jab with the rear hand and firing the straight left straight away — right now you parry and reset.",
    },
    // Lucas
    {
        id: "fb-lucas-sparring-24d",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        kind: "note",
        techniques: [],
        sessionId: "s-lucas-sparring-24d",
        body: "Right call stopping the moment you felt the hamstring. Ice and compression tonight — Dr. Thu Lê will see you tomorrow morning.",
    },
    {
        id: "fb-lucas-upper-12d",
        fighterId: "f-lucas-ferreira",
        coachId: JAMES,
        kind: "note",
        techniques: [],
        nearType: "strength_conditioning",
        day: -12,
        body: "Weighted pull-ups back to +20 kg for 4 × 6. Bike stayed seated at moderate resistance with no hamstring symptoms.",
    },
    {
        id: "fb-lucas-passing-4d",
        fighterId: "f-lucas-ferreira",
        coachId: ANNA,
        kind: "praise",
        techniques: [],
        nearType: "grappling",
        day: -4,
        body: "Knee-cut passing was patient and heavy. You're keeping the crossface without needing explosive hip drive — exactly right for this phase.",
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
        body: "Good first two weeks. Your sprawl is getting lower and faster — keep the hips heavy and the head up.",
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
        title: "Keep the right hand home after the lead hook",
        technique: "guard",
        metricLabel: "Guard uptime after hooks",
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
        title: "Faster jab for fight night",
        technique: "jab",
        metricLabel: "Jab peak speed",
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
        title: "Faster guard recovery after the lead hook",
        technique: "hook",
        metricLabel: "Guard recovery time after the lead hook",
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
        title: "Walk-around weight before fight week",
        technique: null,
        metricLabel: "Morning body weight",
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
        title: "Rebuild weekly training volume",
        technique: null,
        metricLabel: "Weekly training minutes",
        unit: "min",
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
        title: "Takedown defence in drilling",
        technique: null,
        metricLabel: "Takedown defence drill success",
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
        title: "Top pressure without explosive hips",
        technique: null,
        metricLabel: "Passes completed in positional rounds",
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
        title: "Even busier head for Hoshino",
        technique: "head_movement",
        metricLabel: "Head movements per minute",
        unit: "/min",
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
        title: "Make every slip pay",
        technique: "jab",
        metricLabel: "Slips returned with a counter",
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
        title: "Stay off the centreline",
        technique: "guard",
        metricLabel: "Centreline exposure",
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
        title: "Faster switch kick",
        technique: "kick",
        metricLabel: "Switch-kick peak speed",
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
        title: "Clean stance switches",
        technique: "footwork",
        metricLabel: "Clean stance switches per round",
        unit: "switches",
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
        title: "Rear hand back after the cross",
        technique: "cross",
        metricLabel: "Guard maintained on crosses",
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
        title: "High guard on wrestling entries",
        technique: "guard",
        metricLabel: "Guard uptime on entries",
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
        title: "Head off the line before the shot",
        technique: "head_movement",
        metricLabel: "Head movements per minute",
        unit: "/min",
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
        title: "Hands that land",
        technique: "combination",
        metricLabel: "Punch accuracy on pads",
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
        title: "Busier jab",
        technique: "jab",
        metricLabel: "Jabs per round on the bag",
        unit: "jabs/round",
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
        title: "Roundhouse speed",
        technique: "kick",
        metricLabel: "Roundhouse kick peak speed",
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
        title: "Hold conditioning during the hand rehab",
        technique: null,
        metricLabel: "Assault bike 30-second average power",
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
        title: "Sharper footwork while the hand heals",
        technique: "footwork",
        metricLabel: "Pivots per round in footwork drills",
        unit: "pivots/round",
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
        title: "More snap on the right cross",
        technique: "cross",
        metricLabel: "Cross peak speed",
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
        title: "Finish the clinch on the cage",
        technique: null,
        metricLabel: "Clinch-to-takedown conversion",
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
        title: "Enter behind the jab",
        technique: "jab",
        metricLabel: "Jab-led entries per round",
        unit: "entries/round",
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
        title: "Walk-around weight before fight week",
        technique: null,
        metricLabel: "Morning body weight",
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
        title: "Walk-around weight before fight week",
        technique: null,
        metricLabel: "Morning body weight",
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
        title: "Faster lead-leg kick",
        technique: "kick",
        metricLabel: "Lead-leg kick peak speed",
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
        title: "Move the head on the way in",
        technique: "head_movement",
        metricLabel: "Head movements per minute",
        unit: "/min",
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
        title: "Rebuild pad volume",
        technique: "combination",
        metricLabel: "Full-pace pad rounds per session",
        unit: "rounds",
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
        title: "Jab speed back to pre-injury level",
        technique: "jab",
        metricLabel: "Jab peak speed",
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
        title: "Higher combination volume",
        technique: "combination",
        metricLabel: "Combinations per round on pads",
        unit: "combos/round",
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
        title: "Finish the 1-2 with the body kick",
        technique: "kick",
        metricLabel: "Body kicks landed after the 1-2",
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
        title: "Head movement under pressure",
        technique: "head_movement",
        metricLabel: "Head movements per minute",
        unit: "/min",
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
        title: "Faster sprawl reaction",
        technique: null,
        metricLabel: "Sprawl reaction time",
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
