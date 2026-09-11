import { useState } from "react";
import { VISIT_TITLE_PATTERN } from "../utils/colors";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const FLOORS = ["3", "4", "5", "6"];

// 입소상담은 면회(이름/층)처럼 "입소상담 "을 제목 앞에 붙여서 저장한다(캘린더에는 시간 다음에
// 제목을 그대로 보여주기 때문에, 이렇게 해야 면회와 똑같이 "시간 입소상담 ..." 형태로 보인다).
const CONSULT_TITLE_PREFIX = "입소상담 ";

export default function ScheduleForm({ initial, onSubmit, onCancel }) {
  const visitMatch = initial?.title?.match(VISIT_TITLE_PATTERN);
  const initialCategory = visitMatch ? "visit" : initial?.category === "consult" ? "consult" : "schedule";

  const [category, setCategory] = useState(initialCategory);
  const [title, setTitle] = useState(
    visitMatch
      ? ""
      : initialCategory === "consult"
      ? (initial?.title || "").replace(new RegExp(`^${CONSULT_TITLE_PREFIX}\\s*`), "")
      : initial?.title || ""
  );
  const [name, setName] = useState(visitMatch ? visitMatch[1] : "");
  const [floor, setFloor] = useState(visitMatch ? visitMatch[2] : "3");
  const [hasTime, setHasTime] = useState(initialCategory === "visit" || !!initial?.time);
  const [hour, setHour] = useState(initial?.time ? initial.time.split(":")[0] : "09");
  const [minute, setMinute] = useState(initial?.time ? initial.time.split(":")[1] : "00");
  const [memo, setMemo] = useState(initialCategory === "visit" ? "" : initial?.memo || "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareText = `${hour}:${minute} 면회(${name.trim() || "이름"}/${floor}층)`;

  const handleCopyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("아래 문구를 직접 복사해주세요.", shareText);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let finalTitle = title.trim();
    if (category === "visit") {
      if (!name.trim()) return;
      finalTitle = `면회(${name.trim()}/${floor}층)`;
    } else {
      if (!finalTitle) return;
      if (category === "consult") {
        finalTitle = `${CONSULT_TITLE_PREFIX}${finalTitle}`;
      }
    }

    setSaving(true);
    try {
      await onSubmit({
        title: finalTitle,
        time: hasTime ? `${hour}:${minute}` : "",
        memo: category === "visit" ? "" : memo.trim(),
        category: category === "consult" ? "consult" : null
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="schedule-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <div className="form-field-checkbox-row">
          <label className="form-field-checkbox-label">
            <input
              type="checkbox"
              checked={category === "schedule"}
              onChange={() => setCategory("schedule")}
            />
            <span>일정</span>
          </label>
          <label className="form-field-checkbox-label">
            <input type="checkbox" checked={category === "visit"} onChange={() => setCategory("visit")} />
            <span>면회</span>
          </label>
          <label className="form-field-checkbox-label">
            <input
              type="checkbox"
              checked={category === "consult"}
              onChange={() => setCategory("consult")}
            />
            <span>입소상담</span>
          </label>
        </div>
      </div>

      {category === "visit" ? (
        <label className="form-field">
          <span>이름</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            autoFocus
            required
          />
        </label>
      ) : (
        <label className="form-field">
          <span>제목</span>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="일정 제목"
            rows={2}
            autoFocus
            required
          />
        </label>
      )}

      <div className="form-field">
        {category !== "visit" && (
          <label className="form-field-checkbox-label">
            <input
              type="checkbox"
              checked={hasTime}
              onChange={(e) => setHasTime(e.target.checked)}
            />
            <span>시간</span>
          </label>
        )}
        {(hasTime || category === "visit") && (
          <div className="time-select-row">
            <select value={hour} onChange={(e) => setHour(e.target.value)}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}시
                </option>
              ))}
            </select>
            <select value={minute} onChange={(e) => setMinute(e.target.value)}>
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m}분
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {category === "visit" ? (
        <>
          <label className="form-field">
            <span>층수</span>
            <select value={floor} onChange={(e) => setFloor(e.target.value)}>
              {FLOORS.map((f) => (
                <option key={f} value={f}>
                  {f}층
                </option>
              ))}
            </select>
          </label>
          <div className="form-field">
            <span>공유 문구</span>
            <div className="visit-share-row">
              <input type="text" value={shareText} readOnly onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleCopyShareText}>
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <label className="form-field">
          <span>메모 (선택)</span>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} />
        </label>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}
