// 입소서류(이용표준약관/종합입소동의서) 생성.
// 실제 기관 승인 최종본(public/templates/*.docx)을 그대로 복제하고, 문서 안에 «필드명»으로
// 표시된 자리(원래 Word 메일머지용으로 만들어진 자리)만 업로드한 입소자정보 엑셀의 값으로
// 바꿔치기한다. 그 외 글꼴·표·페이지 설정 등은 원본과 완전히 동일하게 유지된다.
const ADMISSION_CONSENT_TEMPLATE_URL = "/templates/admission-consent-template.docx";
const USAGE_AGREEMENT_TEMPLATE_URL = "/templates/usage-agreement-template.docx";

// 입소자정보 엑셀의 "머지데이터" 시트 구조: 1행=필드명, 2행=입력값.
async function readWorkbook(file) {
  const { sanitizeXlsxFile } = await import("./xlsxSanitize.js");
  const readXlsxFile = (await import("read-excel-file/browser")).default;
  const safeFile = await sanitizeXlsxFile(file);
  return readXlsxFile(safeFile);
}

function formatCellValue(v) {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}.${m}.${d}`;
  }
  if (v == null) return "";
  return String(v).trim();
}

export async function parseAdmissionInfoFile(file) {
  const sheets = await readWorkbook(file);
  const target = sheets.find((s) => s.sheet === "머지데이터") || sheets[0];
  const data = target?.data || [];
  const headers = data[0] || [];
  const values = data[1] || [];

  const fieldValues = {};
  headers.forEach((h, i) => {
    if (typeof h === "string" && h.trim()) {
      fieldValues[h.trim()] = formatCellValue(values[i]);
    }
  });
  return fieldValues;
}

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MERGE_FIELD_PATTERN = /«([^»]+)»/;

// «필드명» 자리는 원래 Word 메일머지용 텍스트라, 실제 파일을 열어보면 워드가 저장하면서
// "«" / 필드명 / "»"이 여러 개의 <w:t> 런(run)으로 쪼개져 있는 경우가 많다(맞춤법 검사 등으로
// 워드가 런을 재분할하기 때문). 그래서 <w:t> 텍스트를 단순 문자열로 이어붙여 regex로 바꾸면
// 런 사이의 XML 태그까지 같이 지워져 파일이 깨진다. 대신 XML을 실제로 파싱해서, 이어붙인
// 전체 텍스트에서 «필드명»의 위치를 찾은 뒤, 그 위치가 걸쳐있는 <w:t> 노드들만 정확히
// 잘라내어 값으로 바꾼다(태그 구조는 전혀 건드리지 않음). 한 번 바꿀 때마다 문서 상태가
// 바뀌므로, 매번 처음부터 다시 스캔해서 항상 최신 상태 기준으로 위치를 찾는다.
function fillMergeFieldsInXmlDoc(xmlDoc, fieldValues, missingFields) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tNodes = Array.from(xmlDoc.getElementsByTagNameNS(WORD_NS, "t"));
    let fullText = "";
    const charMap = [];
    tNodes.forEach((node) => {
      const text = node.textContent || "";
      for (let i = 0; i < text.length; i++) charMap.push({ node, offset: i });
      fullText += text;
    });

    const match = MERGE_FIELD_PATTERN.exec(fullText);
    if (!match) break;

    const field = match[1];
    const value = fieldValues[field];
    if (!value) missingFields.add(field);

    const start = match.index;
    const end = match.index + match[0].length;

    const nodesInSpan = [];
    for (let i = start; i < end; i++) {
      const node = charMap[i].node;
      if (nodesInSpan[nodesInSpan.length - 1] !== node) nodesInSpan.push(node);
    }
    const firstNode = nodesInSpan[0];
    const lastNode = nodesInSpan[nodesInSpan.length - 1];
    const startOffsetInFirst = charMap[start].offset;
    const endOffsetInLast = charMap[end - 1].offset + 1;

    const before = firstNode.textContent.slice(0, startOffsetInFirst);
    const after = lastNode.textContent.slice(endOffsetInLast);

    if (firstNode === lastNode) {
      firstNode.textContent = before + (value || "") + after;
    } else {
      firstNode.textContent = before + (value || "");
      lastNode.textContent = after;
      for (let i = 1; i < nodesInSpan.length - 1; i++) {
        nodesInSpan[i].textContent = "";
      }
    }
  }
}

// 서식 파일의 word/document.xml 안에 있는 «필드명» 자리를 실제 값으로 바꾼다. 값이 없는
// 필드는 빈 칸으로 채우고, 어떤 필드가 비어있었는지 missingFields에 기록해서 나중에
// 안내할 수 있게 한다.
async function fillDocxTemplate(templateUrl, fieldValues, missingFields) {
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import("fflate");

  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error("입소서류 양식 파일을 불러오지 못했습니다.");
  }
  const templateBytes = new Uint8Array(await response.arrayBuffer());
  const files = unzipSync(templateBytes);

  const xml = strFromU8(files["word/document.xml"]);
  const xmlDoc = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = xmlDoc.getElementsByTagName("parsererror")[0];
  if (parseError) {
    throw new Error("입소서류 양식 파일(document.xml)을 읽는 중 오류가 발생했습니다.");
  }

  fillMergeFieldsInXmlDoc(xmlDoc, fieldValues, missingFields);

  const serialized = new XMLSerializer().serializeToString(xmlDoc);
  const withDeclaration = serialized.startsWith("<?xml")
    ? serialized
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${serialized}`;
  files["word/document.xml"] = strToU8(withDeclaration);

  const zipped = zipSync(files);
  return new Blob([zipped], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 이용표준약관, 종합입소동의서 두 파일을 각각 만들어 다운로드한다.
export async function downloadAdmissionDocuments(fieldValues) {
  const missingFields = new Set();

  const [consentBlob, agreementBlob] = await Promise.all([
    fillDocxTemplate(ADMISSION_CONSENT_TEMPLATE_URL, fieldValues, missingFields),
    fillDocxTemplate(USAGE_AGREEMENT_TEMPLATE_URL, fieldValues, missingFields)
  ]);

  const nameSuffix = fieldValues["수급자이름"] ? `_${fieldValues["수급자이름"]}` : "";
  downloadBlob(consentBlob, `종합입소동의서${nameSuffix}.docx`);
  downloadBlob(agreementBlob, `이용표준약관${nameSuffix}.docx`);

  return { missingFields: [...missingFields] };
}
