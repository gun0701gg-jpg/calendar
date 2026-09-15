import { format } from "date-fns";
import { useAuth } from "../contexts/AuthContext";
import BrandMark from "./BrandMark";

export default function Header({
  readOnly,
  activeView,
  onSwitchView,
  currentMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
  onOpenUpload,
  onOpenAccessManage
}) {
  const { user, login, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header-title">
        <BrandMark size="sm" />
        <span className="app-header-divider" />
        <h1>위드온빌리지</h1>
      </div>

      {!readOnly && (
        <div className="app-header-tabs">
          <button
            className={`chip ${activeView === "calendar" ? "chip--active" : ""}`}
            onClick={() => onSwitchView("calendar")}
          >
            캘린더
          </button>
          <button className="chip" onClick={onOpenUpload}>
            근무표
          </button>
          <button
            className={`chip ${activeView === "consultation" ? "chip--active" : ""}`}
            onClick={() => onSwitchView("consultation")}
          >
            입소상담
          </button>
          <button
            className={`chip ${activeView === "statement" ? "chip--active" : ""}`}
            onClick={() => onSwitchView("statement")}
          >
            수급자 명세서
          </button>
          <button
            className={`chip ${activeView === "documents" ? "chip--active" : ""}`}
            onClick={() => onSwitchView("documents")}
          >
            입소서류
          </button>
        </div>
      )}

      {(readOnly || activeView === "calendar") && (
        <div className="app-header-nav">
          <button className="btn btn--ghost btn--sm" onClick={onPrevMonth}>
            ‹
          </button>
          <span className="app-header-month">{format(currentMonth, "yyyy년 M월")}</span>
          <button className="btn btn--ghost btn--sm" onClick={onNextMonth}>
            ›
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onToday}>
            오늘
          </button>
        </div>
      )}

      <div className="app-header-user">
        {user ? (
          <>
            {user.photoURL && <img className="app-header-avatar" src={user.photoURL} alt="" />}
            <span className="app-header-name">{user.displayName}</span>
            {!readOnly && (
              <button className="btn btn--ghost btn--sm" onClick={onOpenAccessManage}>
                접근 관리
              </button>
            )}
            <button className="btn btn--ghost btn--sm" onClick={logout}>
              로그아웃
            </button>
          </>
        ) : (
          <button className="btn btn--primary btn--sm" onClick={login}>
            Google 로그인
          </button>
        )}
      </div>
    </header>
  );
}
