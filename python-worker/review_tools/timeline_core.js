/* Logic thuần của công cụ gán nhãn toàn timeline (không đụng DOM).
 *
 * Nhúng vào club_timeline.html khi import buổi quay; test bằng Node
 * (test_club_timeline_core.py) và đối chiếu với review_timeline.py.
 * Khoảng là nửa mở [start, end): hai khoảng liền nhau không bị tính chồng.
 * Không có hàm nào tự điền khoảng hở thành background hay tự đặt cờ HLV/gold.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TimelineCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Dung sai bằng đúng độ phân giải 3 chữ số thập phân của mốc thời gian (ms).
  const EPS = 0.0015;
  const DURATION_SLACK_MS = 0.01;
  const STRIKES = ['jab', 'cross', 'lead_hook', 'rear_hook', 'lead_uppercut', 'rear_uppercut'];
  const TECHNIQUES = STRIKES.concat(['background', 'unclear']);
  const LEAD_REAR = ['lead', 'rear', 'not_applicable'];
  const STANCES = ['orthodox', 'southpaw'];
  const BACKGROUND_TYPES = ['standing_still', 'footwork', 'guard_change', 'glove_adjust', 'block',
    'parry', 'feint', 'slip_bob', 'stance_switch', 'other'];
  const QUALITY_FLAGS = ['occluded', 'out_of_frame', 'multiple_people', 'motion_blur',
    'low_light', 'camera_shift', 'track_lost', 'poor_pose'];
  const UNCLEAR_REASONS = QUALITY_FLAGS.concat(['other']);
  const CERTAINTY = ['certain', 'uncertain'];
  const EXPECTED_SIDE = {jab: 'lead', cross: 'rear', lead_hook: 'lead', rear_hook: 'rear',
    lead_uppercut: 'lead', rear_uppercut: 'rear'};
  const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
  const ANNOTATION_SCHEMA = 'club_timeline_annotation_v1';

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const isId = (v) => typeof v === 'string' && ID_PATTERN.test(v);
  const blank = (v) => v === null || v === undefined || v === '';
  const toNumber = (v) => (blank(v) ? null : (typeof v === 'number' ? v : Number(v)));
  const round3 = (v) => (isNum(v) ? Math.round(v * 1000) / 1000 : v);

  function normalizeInterval(raw) {
    const technique = blank(raw.technique) ? null : raw.technique;
    const strike = STRIKES.includes(technique);
    const out = {
      intervalId: raw.intervalId,
      technique: technique,
      startTimeMs: round3(toNumber(raw.startTimeMs)),
      endTimeMs: round3(toNumber(raw.endTimeMs)),
      peakTimeMs: strike ? round3(toNumber(raw.peakTimeMs)) : null,
      leadRear: strike ? (blank(raw.leadRear) ? null : raw.leadRear) : null,
      // Thế thủ của background/unclear để trống nếu người gán không điền: chưa có quyết định chung.
      stance: blank(raw.stance) ? null : raw.stance,
      backgroundType: technique === 'background' && !blank(raw.backgroundType) ? raw.backgroundType : null,
      unclearReason: technique === 'unclear' && !blank(raw.unclearReason) ? raw.unclearReason : null,
      qualityFlags: Array.isArray(raw.qualityFlags) ? raw.qualityFlags.slice().sort() : [],
      certainty: blank(raw.certainty) ? 'certain' : raw.certainty,
      note: typeof raw.note === 'string' ? raw.note.trim() : '',
    };
    return out;
  }

  function validateInterval(iv, durationMs) {
    const issues = [];
    const add = (code, message, severity) =>
      issues.push({code: code, severity: severity || 'error', intervalIds: [iv.intervalId], message: message});
    if (!TECHNIQUES.includes(iv.technique)) {
      add('UNKNOWN_TECHNIQUE', 'Nhãn kỹ thuật không hợp lệ.');
      return issues;
    }
    const s = iv.startTimeMs, e = iv.endTimeMs;
    if (!isNum(s) || !isNum(e)) add('TIME_NOT_FINITE', 'Mốc bắt đầu/kết thúc phải là số.');
    else {
      if (s < 0) add('OUT_OF_VIDEO_RANGE', 'Bắt đầu trước 0 ms.');
      if (e <= s) add('START_NOT_BEFORE_END', 'Kết thúc phải sau bắt đầu.');
      if (isNum(durationMs) && e > durationMs + DURATION_SLACK_MS)
        add('OUT_OF_VIDEO_RANGE', 'Kết thúc vượt thời lượng video đã giải mã.');
    }
    const strike = STRIKES.includes(iv.technique);
    if (strike) {
      if (!STANCES.includes(iv.stance)) add('STRIKE_STANCE_REQUIRED', 'Đòn cần thế thủ orthodox hoặc southpaw.');
      if (iv.leadRear !== 'lead' && iv.leadRear !== 'rear')
        add('STRIKE_LEAD_REAR_REQUIRED', 'Đòn cần ghi tay trước (lead) hoặc tay sau (rear).');
      else if (EXPECTED_SIDE[iv.technique] !== iv.leadRear)
        add('LEAD_REAR_CLASS_MISMATCH', 'Tay lead/rear không khớp tên lớp đòn; cần phân xử.', 'warning');
      if (!blank(iv.backgroundType) || !blank(iv.unclearReason))
        add('FIELD_NOT_APPLICABLE', 'Loại background / lý do không rõ không áp dụng cho đòn.');
      if (!blank(iv.peakTimeMs)) {
        if (!isNum(iv.peakTimeMs) || (isNum(s) && iv.peakTimeMs < s - EPS) || (isNum(e) && iv.peakTimeMs > e + EPS))
          add('PEAK_OUTSIDE_INTERVAL', 'Peak phải nằm trong [start, end] của đòn.');
      }
    } else {
      if (!blank(iv.peakTimeMs)) add('PEAK_ONLY_FOR_STRIKE', 'Peak chỉ áp dụng cho đòn.');
      if (!blank(iv.leadRear) && iv.leadRear !== 'not_applicable')
        add('FIELD_NOT_APPLICABLE', 'Lead/rear chỉ áp dụng cho đòn.');
      if (!blank(iv.stance) && !STANCES.includes(iv.stance))
        add('INVALID_STANCE', 'Thế thủ chỉ nhận orthodox, southpaw hoặc để trống.');
      if (iv.technique === 'background') {
        if (!blank(iv.unclearReason)) add('FIELD_NOT_APPLICABLE', 'Lý do không rõ không áp dụng cho background.');
        if (blank(iv.backgroundType))
          add('BACKGROUND_TYPE_MISSING', 'Background chưa ghi loại (đứng yên, footwork, ...).', 'warning');
        else if (!BACKGROUND_TYPES.includes(iv.backgroundType))
          add('UNKNOWN_BACKGROUND_TYPE', 'Loại background không hợp lệ.');
      } else {
        if (!blank(iv.backgroundType)) add('FIELD_NOT_APPLICABLE', 'Loại background không áp dụng cho khoảng không rõ.');
        if (blank(iv.unclearReason) || !UNCLEAR_REASONS.includes(iv.unclearReason))
          add('UNCLEAR_REASON_REQUIRED', 'Khoảng không rõ phải kèm lý do hợp lệ.');
        else if (iv.unclearReason === 'other' && !(typeof iv.note === 'string' && iv.note.trim()))
          add('UNCLEAR_REASON_NOTE_REQUIRED', 'Lý do "other" cần ghi chú giải thích.');
      }
    }
    if (!Array.isArray(iv.qualityFlags) || iv.qualityFlags.some((f) => !QUALITY_FLAGS.includes(f)))
      add('UNKNOWN_QUALITY_FLAG', 'Cờ chất lượng không hợp lệ.');
    if (!CERTAINTY.includes(iv.certainty)) add('INVALID_CERTAINTY', 'Mức chắc chắn không hợp lệ.');
    return issues;
  }

  function validTime(iv) {
    return isNum(iv.startTimeMs) && isNum(iv.endTimeMs) && iv.endTimeMs > iv.startTimeMs;
  }

  function coverageOf(intervals, durationMs) {
    const spans = intervals.filter(validTime).map((iv) => [iv.startTimeMs, iv.endTimeMs])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const gaps = [];
    let cursor = 0, covered = 0;
    const limit = isNum(durationMs) ? durationMs : null;
    for (const [s, e] of spans) {
      if (s > cursor + EPS) gaps.push({startTimeMs: round3(cursor), endTimeMs: round3(s)});
      const from = Math.max(s, cursor), to = limit === null ? e : Math.min(e, limit);
      if (to > from) covered += to - from;
      if (e > cursor) cursor = e;
    }
    if (limit !== null && limit > cursor + EPS) gaps.push({startTimeMs: round3(cursor), endTimeMs: round3(limit)});
    const counts = {};
    for (const iv of intervals) counts[iv.technique] = (counts[iv.technique] || 0) + 1;
    let unclearMs = 0;
    for (const iv of intervals) if (iv.technique === 'unclear' && validTime(iv)) unclearMs += iv.endTimeMs - iv.startTimeMs;
    return {
      durationMs: limit, coveredMs: round3(covered), gapMs: limit === null ? null : round3(limit - covered),
      gaps: gaps, gapCount: gaps.length, intervalCount: intervals.length, countsByTechnique: counts,
      unclearMs: round3(unclearMs), fullyCovered: limit !== null && gaps.length === 0 && spans.length > 0,
    };
  }

  /** Trả {errors, warnings, coverage}. Chồng lấn luôn là error, không bị bỏ qua. */
  function validateTimeline(intervals, options) {
    const opts = options || {};
    const durationMs = isNum(opts.durationMs) ? opts.durationMs : null;
    const issues = [];
    const seen = new Set();
    for (const iv of intervals) {
      if (typeof iv.intervalId !== 'string' || !iv.intervalId || seen.has(iv.intervalId))
        issues.push({code: 'DUPLICATE_INTERVAL_ID', severity: 'error', intervalIds: [iv.intervalId],
          message: 'Mã khoảng thiếu hoặc bị trùng.'});
      seen.add(iv.intervalId);
      for (const issue of validateInterval(iv, durationMs)) issues.push(issue);
    }
    const timed = intervals.filter(validTime).sort((a, b) => a.startTimeMs - b.startTimeMs || a.endTimeMs - b.endTimeMs);
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        // Đã sắp theo start: từ đây trở đi không còn khoảng nào chồng với timed[i].
        if (timed[j].startTimeMs >= timed[i].endTimeMs - EPS) break;
        const overlapMs = Math.min(timed[i].endTimeMs, timed[j].endTimeMs) - timed[j].startTimeMs;
        if (overlapMs > EPS)
          issues.push({code: 'OVERLAPPING_INTERVALS', severity: 'error',
            intervalIds: [timed[i].intervalId, timed[j].intervalId], overlapMs: round3(overlapMs),
            message: 'Hai khoảng chồng nhau ' + round3(overlapMs) + ' ms; sửa mốc hoặc tách khoảng.'});
      }
    }
    const coverage = coverageOf(intervals, durationMs);
    if (opts.declaredComplete === true) {
      const hasError = issues.some((i) => i.severity === 'error');
      if (coverage.gapCount > 0 || coverage.durationMs === null || coverage.intervalCount === 0)
        issues.push({code: 'DECLARED_COMPLETE_WITH_GAPS', severity: 'error', intervalIds: [],
          message: 'Đã khai timeline hoàn chỉnh nhưng còn khoảng hở chưa gán.'});
      if (hasError)
        issues.push({code: 'DECLARED_COMPLETE_WITH_ERRORS', severity: 'error', intervalIds: [],
          message: 'Đã khai timeline hoàn chỉnh nhưng còn lỗi kiểm tra.'});
    }
    return {
      errors: issues.filter((i) => i.severity === 'error'),
      warnings: issues.filter((i) => i.severity === 'warning'),
      coverage: coverage,
    };
  }

  const sortIntervals = (list) => list.slice().sort((a, b) =>
    (a.startTimeMs - b.startTimeMs) || (a.endTimeMs - b.endTimeMs) || String(a.intervalId).localeCompare(String(b.intervalId)));

  function nextIntervalId(list) {
    let max = 0;
    for (const iv of list) {
      const m = /^I(\d+)$/.exec(String(iv.intervalId));
      if (m) max = Math.max(max, Number(m[1]));
    }
    return 'I' + String(max + 1).padStart(4, '0');
  }

  function addInterval(list, raw) {
    const iv = normalizeInterval(Object.assign({}, raw, {intervalId: nextIntervalId(list)}));
    return {list: sortIntervals(list.concat([iv])), interval: iv};
  }

  function updateInterval(list, id, raw) {
    if (!list.some((iv) => iv.intervalId === id)) throw new Error('Không có khoảng ' + id);
    const iv = normalizeInterval(Object.assign({}, raw, {intervalId: id}));
    return {list: sortIntervals(list.map((x) => (x.intervalId === id ? iv : x))), interval: iv};
  }

  const removeInterval = (list, id) => list.filter((iv) => iv.intervalId !== id);

  /** Tách một khoảng thành hai tại atMs. Mọi trường được giữ; peak chỉ ở nửa chứa nó. */
  function splitInterval(list, id, atMs) {
    const iv = list.find((x) => x.intervalId === id);
    if (!iv) throw new Error('Không có khoảng ' + id);
    if (!isNum(atMs) || !(atMs > iv.startTimeMs + EPS) || !(atMs < iv.endTimeMs - EPS))
      throw new Error('Điểm tách phải nằm bên trong khoảng.');
    const at = round3(atMs);
    const peak = iv.peakTimeMs;
    const first = Object.assign({}, iv, {endTimeMs: at, peakTimeMs: isNum(peak) && peak <= at ? peak : null});
    const secondId = nextIntervalId(list);
    const second = Object.assign({}, iv, {intervalId: secondId, startTimeMs: at,
      peakTimeMs: isNum(peak) && peak > at ? peak : null});
    return {list: sortIntervals(list.map((x) => (x.intervalId === id ? first : x)).concat([second])),
      ids: [id, secondId]};
  }

  /** Bản xuất luôn chưa xác thực: không có đường nào đặt coachConfirmed/goldEligible = true. */
  function buildExport(input) {
    if (!isId(input.annotatorId)) throw new Error('Mã người gán chỉ gồm chữ, số, ".", "_", "-" (tối đa 64 ký tự).');
    const pack = input.pack, video = pack.video;
    const intervals = sortIntervals(input.intervals);
    const declared = input.declaredComplete === true;
    const validation = validateTimeline(intervals, {durationMs: video.durationMs, declaredComplete: declared});
    return {
      schemaVersion: ANNOTATION_SCHEMA,
      packId: pack.packId,
      sourceVideoId: video.sourceVideoId,
      videoSha256: video.sha256,
      fighterId: video.fighterId,
      sessionId: video.sessionId,
      fps: video.fps,
      decodedFrames: video.decodedFrames,
      durationMs: video.durationMs,
      annotatorId: input.annotatorId,
      annotatorIdentityVerified: false,
      actorType: 'declared_human_annotator',
      guideVersion: blank(input.guideVersion) ? null : String(input.guideVersion).trim(),
      status: 'LOCAL_REVIEW_UNVERIFIED',
      reviewerAuthenticated: false,
      coachConfirmed: false,
      goldEligible: false,
      annotationCoverage: 'unverified',
      annotatorDeclaredTimelineComplete: declared,
      revision: input.revision,
      exportedAt: input.exportedAt,
      intervals: intervals,
      validation: validation,
    };
  }

  /**
   * Phím tắt (bỏ qua khi đang gõ trong ô nhập). Trả về {type, value} hoặc null.
   * Chuỗi ngắn để gán một đòn: 1-6 (lớp), f/b (lead/rear), o/s (thế thủ), [ ] (mốc), Enter.
   */
  function keyAction(ev) {
    if (ev.typing || ev.ctrlKey || ev.metaKey || ev.altKey) {
      if ((ev.ctrlKey || ev.metaKey) && !ev.typing && (ev.key === 'z' || ev.key === 'Z')) return {type: 'undo'};
      return null;
    }
    const k = ev.key;
    const classKeys = {'1': 'jab', '2': 'cross', '3': 'lead_hook', '4': 'rear_hook',
      '5': 'lead_uppercut', '6': 'rear_uppercut', '0': 'background', 'u': 'unclear'};
    if (Object.prototype.hasOwnProperty.call(classKeys, k)) return {type: 'technique', value: classKeys[k]};
    switch (k) {
      case ' ': return {type: 'toggle_play'};
      case ',': return {type: 'step', value: ev.shiftKey ? -10 : -1};
      case '.': return {type: 'step', value: ev.shiftKey ? 10 : 1};
      case '<': return {type: 'step', value: -10};
      case '>': return {type: 'step', value: 10};
      case '[': return {type: 'set_start'};
      case ']': return {type: 'set_end'};
      case 'p': return {type: 'set_peak'};
      case 'f': return {type: 'lead_rear', value: 'lead'};
      case 'b': return {type: 'lead_rear', value: 'rear'};
      case 'o': return {type: 'stance', value: 'orthodox'};
      case 's': return {type: 'stance', value: 'southpaw'};
      case 'Enter': return {type: 'commit'};
      case 'n': return {type: 'new_interval'};
      case 'x': return {type: 'split'};
      case 'Delete': return {type: 'delete'};
      case 'ArrowDown': return {type: 'select_next'};
      case 'ArrowUp': return {type: 'select_prev'};
      case 'ArrowLeft': return {type: 'step', value: ev.shiftKey ? -10 : -1};
      case 'ArrowRight': return {type: 'step', value: ev.shiftKey ? 10 : 1};
      case '?': return {type: 'help'};
      default: return null;
    }
  }

  return {
    EPS: EPS, STRIKES: STRIKES, TECHNIQUES: TECHNIQUES, LEAD_REAR: LEAD_REAR, STANCES: STANCES,
    BACKGROUND_TYPES: BACKGROUND_TYPES, QUALITY_FLAGS: QUALITY_FLAGS, UNCLEAR_REASONS: UNCLEAR_REASONS,
    CERTAINTY: CERTAINTY, EXPECTED_SIDE: EXPECTED_SIDE, ID_PATTERN_SOURCE: ID_PATTERN.source,
    ANNOTATION_SCHEMA: ANNOTATION_SCHEMA,
    isId: isId, normalizeInterval: normalizeInterval, validateInterval: validateInterval,
    validateTimeline: validateTimeline, coverageOf: coverageOf, sortIntervals: sortIntervals,
    nextIntervalId: nextIntervalId, addInterval: addInterval, updateInterval: updateInterval,
    removeInterval: removeInterval, splitInterval: splitInterval, buildExport: buildExport,
    keyAction: keyAction,
  };
});
