import { useState } from "react";
import { parseAdmissionInfoFile, downloadAdmissionDocuments } from "../utils/admissionDocuments";
import { isChunkLoadError, reloadForFreshVersion } from "../utils/reloadOnChunkError";

export default function AdmissionDocumentsView() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [message, setMessage] = useState("");

  const handleGenerate = async () => {
    if (!file) {
      setStatus("error");
      setMessage("입소자정보 엑셀 파일을 업로드해주세요.");
      return;
    }
    setStatus("working");
    setMessage("파일을 읽는 중...");

    try {
      const fieldValues = await parseAdmissionInfoFile(file);
      if (!fieldValues["수급자이름"]) {
        setStatus("error");
        setMessage('입소자정보 파일에서 값을 찾지 못했습니다. "머지데이터" 시트 2행에 값이 채워져 있는지 확인해주세요.');
        return;
      }

      const { missingFields } = await downloadAdmissionDocuments(fieldValues);
      setStatus("done");
      const warningText = missingFields.length
        ? `\n주의: 다음 항목이 비어있어 빈 칸으로 생성됐습니다 — ${missingFields.join(", ")}`
        : "";
      setMessage(`이용표준약관, 종합입소동의서 파일을 생성했습니다.${warningText}`);
    } catch (err) {
      if (isChunkLoadError(err) && reloadForFreshVersion()) return;
      setStatus("error");
      setMessage(err.message || "생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="statement-view">
      <div className="statement-view-header">
        <h2>입소서류</h2>
      </div>

      <p className="modal-hint" style={{ whiteSpace: "pre-wrap" }}>
        {`사용안내
1. 입소자정보 엑셀 파일(머지데이터 시트 2행에 값이 입력된 파일)을 업로드하세요.
2. [입소서류 생성] 버튼을 누르면 이용표준약관, 종합입소동의서 두 파일이 각각 다운로드됩니다.`}
      </p>

      <label className="form-field">
        <span>입소자정보</span>
        <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>

      {message && (
        <p className={`modal-message modal-message--${status}`} style={{ whiteSpace: "pre-wrap" }}>
          {message}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn--primary" onClick={handleGenerate} disabled={status === "working"}>
          {status === "working" ? "생성 중..." : "입소서류 생성"}
        </button>
      </div>
    </div>
  );
}
