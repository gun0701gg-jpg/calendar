// 병합된 수급자 데이터를 "입소비 집계표" 시트(연번~경관식)로 만든다. 수급자별 명세서와 한 파일에
// 시트로 같이 들어가야 해서, write-excel-file 대신 명세서 양식과 같은 원시 OOXML로 직접 만든다.
// 셀 서식(글꼴/테두리/배경색/회계 숫자서식)은 새로 정의하지 않고 명세서 양식 파일(styles.xml)에
// 이미 있는 항목을 최대한 재사용하고, 없는 것(회색 머리글 배경/경관식 강조 노란색)만 새로 추가한다.
// 새로 추가되는 스타일은 항상 기존 styles.xml 뒤에 "이어 붙이기"만 해서(기존 번호는 바꾸지 않음)
// 수급자별 명세서 시트가 쓰는 기존 스타일 번호와 절대 겹치지 않는다. 실제로 어디에 이어 붙이는지는
// residentStatement.js의 combinedWorkbook 조립 코드가 담당한다.

// 명세서 양식 styles.xml의 cellXfs는 0~71번까지 있다(72개). 이 시트 전용 스타일은 72번부터
// 이어 붙인다.
const CELL_XF_BASE = 72;
export const AGG_STYLE = {
  title: CELL_XF_BASE, // 굵고 큰 글씨(제목행)
  header: CELL_XF_BASE + 1, // 굵은 글씨 + 회색 배경 + 테두리 + 가운데 정렬
  text: CELL_XF_BASE + 2, // 일반 글씨 + 테두리 + 가운데 정렬
  textHighlight: CELL_XF_BASE + 3, // text와 동일 + 경관식 강조 노란 배경
  numberAccounting: CELL_XF_BASE + 4, // 회계서식(천단위 구분, 0은 "-") + 테두리
  numberAccountingCentered: CELL_XF_BASE + 5, // numberAccounting + 가운데 정렬(일수 열)
  footnote: CELL_XF_BASE + 6 // 일반 글씨, 테두리 없음(맨 아래 주기용)
};

// 새로 추가되는 fill 2개(머리글 회색, 경관식 강조 노란색). 명세서 양식의 fills는 0~5번까지
// 있어서(6개) 6번부터 이어 붙인다.
const FILL_BASE = 6;
const HEADER_FILL_ID = FILL_BASE; // #E5E7EB
const HIGHLIGHT_FILL_ID = FILL_BASE + 1; // #FEF08A

export function buildAggregateStyleAdditions() {
  const fillsXml =
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFEF08A"/><bgColor indexed="64"/></patternFill></fill>';

  // 글꼴: 26번(굵은 Noto Sans KR 11pt), 28번(일반 Noto Sans KR 11pt), 23번(굵은 Noto Sans KR
  // 18pt, 제목용) — 모두 명세서 양식에 이미 있는 글꼴을 재사용한다. 테두리는 1번(사방 실선)을
  // 재사용한다.
  const cellXfsXml =
    `<xf numFmtId="0" fontId="23" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `<xf numFmtId="0" fontId="26" fillId="${HEADER_FILL_ID}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="28" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
    `<xf numFmtId="0" fontId="28" fillId="${HIGHLIGHT_FILL_ID}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
    `<xf numFmtId="41" fontId="28" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>` +
    `<xf numFmtId="41" fontId="28" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
    `<xf numFmtId="0" fontId="28" fillId="0" borderId="0" xfId="0" applyFont="1"/>`;

  return { fillsXml, fillsAdded: 2, cellXfsXml, cellXfsAdded: 7 };
}

function escapeXmlText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"];
const COLUMN_WIDTHS = [6, 8, 10, 8, 10, 6, ...Array(14).fill(12)];

function textXml(ref, style, value) {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXmlText(value)}</t></is></c>`;
}

function numberXml(ref, style, value) {
  return `<c r="${ref}" s="${style}"><v>${Number(value) || 0}</v></c>`;
}

function formulaXml(ref, style, formula) {
  return `<c r="${ref}" s="${style}"><f>${escapeXmlText(formula)}</f></c>`;
}

function rowXml(r, cells) {
  return `<row r="${r}">${cells.join("")}</row>`;
}

const HEADERS = [
  "연번",
  "수급현황",
  "수급자명",
  "등급",
  "본인부담률",
  "일수",
  "공단부담금",
  "본인부담금",
  "식사재료비",
  "상급침실비",
  "진료약제비",
  "계약의사진찰비",
  "가정간호비",
  "등급외",
  "부담금합계",
  "이전미납액",
  "선납적용액",
  "총청구액",
  "당월입금액",
  "경관식"
];

// 시트 이름과 별개로, 시트 첫 줄에 "N월 입소비 집계표"라는 제목을 넣는다.
function titleText(billingMonth) {
  const monthNumber = Number(billingMonth.split("-")[1]);
  return `${monthNumber}월 입소비 집계표`;
}

// 공단부담금/본인부담금/식사재료비는 계산 과정을 표에서 그대로 확인/검증할 수 있도록 값이 아닌
// 수식으로 넣는다(등급 D열/본인부담률 E열/일수 F열/경관식 T열을 참조). 기초수급자는 본인부담률이
// 0%인 사람으로 본다. 다만 이번 달이 시작되기 전에 이미 퇴소한 사람은 애초에 청구 대상이 아니라
// 수식으로 표현할 근거 열이 없어서, 그 경우만 예외적으로 0을 값 그대로 넣는다.
// 등급별 1일 단가: 1등급 93,070 / 2등급 86,340 / 3~5등급 81,540 (residentDataMerge.js의
// GRADE_DAILY_RATE와 동일한 값).
function gradeRateFormula(row) {
  return (
    `IF(D${row}="1등급",93070,IF(D${row}="2등급",86340,` +
    `IF(OR(D${row}="3등급",D${row}="4등급",D${row}="5등급"),81540,0)))`
  );
}

function rateFractionFormula(row) {
  return `IFERROR(VALUE(SUBSTITUTE(E${row},"%",""))/100,0)`;
}

function baseAmountFormula(row) {
  return `${gradeRateFormula(row)}*F${row}`;
}

function mealBaseFormula(row) {
  return `(4300*3*F${row})+IF(T${row}="O",0,1000*F${row})`;
}

export function buildAggregateSheetXml(residents, billingMonth, warnings = []) {
  const colsXml = COLUMN_WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join(
    ""
  );

  const rows = [];
  rows.push(rowXml(1, [textXml("A1", AGG_STYLE.title, titleText(billingMonth))]));
  rows.push(rowXml(2, HEADERS.map((h, i) => textXml(`${COLS[i]}2`, AGG_STYLE.header, h))));

  const firstDataRow = 3;
  residents.forEach((r, i) => {
    const row = firstDataRow + i;
    const nameStyle = r.isTubeFeeding ? AGG_STYLE.textHighlight : AGG_STYLE.text;

    // 공단부담금은 총산출금액(등급별금액*일수)*(1-본인부담률)을 원 단위(일의 자리)에서 올림하고,
    // 본인부담금은 총산출금액에서 그 공단부담금을 뺀 나머지로 계산해서 둘의 합이 항상
    // 총산출금액과 정확히 같게 한다.
    const insurancePayCell = r.alreadyGone
      ? numberXml(`G${row}`, AGG_STYLE.numberAccounting, 0)
      : formulaXml(
          `G${row}`,
          AGG_STYLE.numberAccounting,
          `IF(D${row}="등급외",0,ROUNDUP(${baseAmountFormula(row)}*(1-${rateFractionFormula(row)}),0))`
        );
    const selfPayCell = r.alreadyGone
      ? numberXml(`H${row}`, AGG_STYLE.numberAccounting, 0)
      : formulaXml(`H${row}`, AGG_STYLE.numberAccounting, `IF(D${row}="등급외",0,${baseAmountFormula(row)}-G${row})`);
    const mealCostCell = r.alreadyGone
      ? numberXml(`I${row}`, AGG_STYLE.numberAccounting, 0)
      : formulaXml(
          `I${row}`,
          AGG_STYLE.numberAccounting,
          `IF(E${row}="0%",MAX(0,${mealBaseFormula(row)}-426741),${mealBaseFormula(row)})`
        );

    rows.push(
      rowXml(row, [
        numberXml(`A${row}`, AGG_STYLE.text, r.seq),
        textXml(`B${row}`, AGG_STYLE.text, r.status),
        textXml(`C${row}`, nameStyle, r.name),
        textXml(`D${row}`, AGG_STYLE.text, r.grade),
        textXml(`E${row}`, AGG_STYLE.text, r.selfPayRate),
        numberXml(`F${row}`, AGG_STYLE.numberAccountingCentered, r.days),
        insurancePayCell,
        selfPayCell,
        mealCostCell,
        numberXml(`J${row}`, AGG_STYLE.numberAccounting, r.roomUpgradeCost),
        numberXml(`K${row}`, AGG_STYLE.numberAccounting, r.pharmacyCost),
        numberXml(`L${row}`, AGG_STYLE.numberAccounting, r.doctorFeeCost),
        numberXml(`M${row}`, AGG_STYLE.numberAccounting, r.nursingCost),
        numberXml(`N${row}`, AGG_STYLE.numberAccounting, r.gradeExemptAmount),
        formulaXml(`O${row}`, AGG_STYLE.numberAccounting, `SUM(H${row}:N${row})`),
        numberXml(`P${row}`, AGG_STYLE.numberAccounting, 0),
        numberXml(`Q${row}`, AGG_STYLE.numberAccounting, 0),
        formulaXml(`R${row}`, AGG_STYLE.numberAccounting, `O${row}+P${row}-Q${row}`),
        numberXml(`S${row}`, AGG_STYLE.numberAccounting, 0),
        textXml(`T${row}`, AGG_STYLE.text, r.isTubeFeeding ? "O" : "")
      ])
    );
  });

  const lastDataRow = firstDataRow + residents.length - 1;
  const blankRowNum = lastDataRow + 1;
  const totalRowNum = blankRowNum + 1;
  rows.push(rowXml(blankRowNum, []));
  rows.push(
    rowXml(totalRowNum, [
      textXml(`A${totalRowNum}`, AGG_STYLE.text, "합계"),
      ...["G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S"].map((col) =>
        formulaXml(`${col}${totalRowNum}`, AGG_STYLE.numberAccounting, `SUM(${col}${firstDataRow}:${col}${lastDataRow})`)
      ),
      textXml(`T${totalRowNum}`, AGG_STYLE.text, "")
    ])
  );

  let nextRow = totalRowNum + 1;
  const hasTubeFeeding = residents.some((r) => r.isTubeFeeding);
  if (hasTubeFeeding) {
    rows.push(rowXml(nextRow, [textXml(`A${nextRow}`, AGG_STYLE.footnote, "※ 음영 표시: 경관식 대상자")]));
    nextRow += 1;
  }
  warnings.forEach((w) => {
    rows.push(rowXml(nextRow, [textXml(`A${nextRow}`, AGG_STYLE.footnote, `※ ${w}`)]));
    nextRow += 1;
  });

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<cols>${colsXml}</cols>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    "</worksheet>"
  );
}
