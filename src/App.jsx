import { useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths
} from "date-fns";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Header from "./components/Header";
import CalendarView from "./components/CalendarView";
import DayPanel from "./components/DayPanel";
import WorkScheduleUploadModal from "./components/WorkScheduleUploadModal";
import ConsultationView from "./components/ConsultationView";
import AccessManageModal from "./components/AccessManageModal";
import ResidentStatementView from "./components/ResidentStatementView";
import AdmissionDocumentsView from "./components/AdmissionDocumentsView";
import { createSchedule, deleteSchedule, updateSchedule, useSchedules } from "./hooks/useSchedules";
import { useAllowedEmails } from "./hooks/useAccessControl";

function CalendarApp({ readOnly }) {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState("calendar"); // "calendar" | "consultation" | "statement" | "documents"
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [accessManageOpen, setAccessManageOpen] = useState(false);

  const { gridStart, gridEnd } = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return {
      gridStart: format(startOfWeek(monthStart), "yyyy-MM-dd"),
      gridEnd: format(endOfWeek(monthEnd), "yyyy-MM-dd")
    };
  }, [currentMonth]);

  const { schedules } = useSchedules(gridStart, gridEnd);

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  // 일별 일정 목록(추가/수정/삭제 가능)은 직접 등록한 일정만, 근무현황은 별도 읽기 전용 목록으로 전달한다.
  const daySchedules = schedules.filter((s) => s.date === selectedDateStr && !s.importBatch);
  const dayWorkSchedules = schedules
    .filter((s) => s.date === selectedDateStr && s.importBatch)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleCreate = (values) =>
    createSchedule({
      ...values,
      authorUid: user.uid,
      authorName: user.displayName
    });

  const handleUpdate = (id, values) => updateSchedule(id, values);
  const handleDelete = (id) => deleteSchedule(id);

  const showConsultation = !readOnly && activeView === "consultation";
  const showStatement = !readOnly && activeView === "statement";
  const showDocuments = !readOnly && activeView === "documents";

  return (
    <div className="app">
      <Header
        readOnly={readOnly}
        activeView={activeView}
        onSwitchView={setActiveView}
        currentMonth={currentMonth}
        onPrevMonth={() => setCurrentMonth((m) => subMonths(m, 1))}
        onNextMonth={() => setCurrentMonth((m) => addMonths(m, 1))}
        onToday={() => {
          setCurrentMonth(new Date());
          setSelectedDate(new Date());
        }}
        onOpenUpload={() => setUploadOpen(true)}
        onOpenAccessManage={() => setAccessManageOpen(true)}
      />
      {uploadOpen && (
        <WorkScheduleUploadModal
          user={user}
          defaultYear={currentMonth.getFullYear()}
          defaultMonth={currentMonth.getMonth() + 1}
          onClose={() => setUploadOpen(false)}
        />
      )}
      {accessManageOpen && <AccessManageModal user={user} onClose={() => setAccessManageOpen(false)} />}
      {showConsultation ? (
        <main className="app-main app-main--single">
          <ConsultationView user={user} />
        </main>
      ) : showStatement ? (
        <main className="app-main app-main--single">
          <ResidentStatementView />
        </main>
      ) : showDocuments ? (
        <main className="app-main app-main--single">
          <AdmissionDocumentsView />
        </main>
      ) : (
        <main className="app-main">
          <CalendarView
            currentMonth={currentMonth}
            schedules={schedules}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <DayPanel
            readOnly={readOnly}
            selectedDate={selectedDate}
            schedules={daySchedules}
            workSchedules={dayWorkSchedules}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </main>
      )}
    </div>
  );
}

function Gate() {
  const { user } = useAuth();
  const allowedEmails = useAllowedEmails(!!user);

  if (user === undefined) {
    return (
      <div className="loading-screen">
        <p>불러오는 중...</p>
      </div>
    );
  }

  // 로그인하지 않은 방문자는 근무표(캘린더)를 열람만 할 수 있다.
  if (!user) {
    return <CalendarApp readOnly />;
  }

  if (allowedEmails === undefined) {
    return (
      <div className="loading-screen">
        <p>불러오는 중...</p>
      </div>
    );
  }

  const isAllowed =
    allowedEmails === null ||
    allowedEmails.map((e) => e.toLowerCase()).includes((user.email || "").toLowerCase());

  // 로그인은 했지만 허용 목록에 없는 사용자도 열람까지만 가능하다.
  return <CalendarApp readOnly={!isAllowed} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
