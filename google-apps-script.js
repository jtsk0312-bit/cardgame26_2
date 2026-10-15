/**
 * 카드 맞추기 게임 결과 저장 및 TOP 3 랭킹 조회 Google Apps Script
 * 스프레드시트 ID: 1v4uWNrPS7tamEnLpEOr5M9qGT2cB1wBp2iVK8IxBfrg
 */

const SPREADSHEET_ID = "1v4uWNrPS7tamEnLpEOr5M9qGT2cB1wBp2iVK8IxBfrg";
const SHEET_NAME = "시트1";

/**
 * 시간 문자열("00:23", "01:15" 또는 Google 시트 날짜 객체)을 초 단위 숫자로 변환
 */
function parseTimeToSeconds(val) {
  if (!val) return 999999;

  // 구글 시트가 날짜 객체(Date)로 읽은 경우
  if (val instanceof Date) {
    return val.getHours() * 3600 + val.getMinutes() * 60 + val.getSeconds();
  }

  const str = String(val).trim();

  // "Sat Dec 30 1899 00:23:00 GMT..." 형태 대응
  if (str.includes("GMT") || str.includes("1899")) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    }
  }

  // "01:23" 형태 대응
  if (str.includes(":")) {
    const parts = str.split(":");
    if (parts.length >= 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      return mins * 60 + secs;
    }
  }

  const num = parseInt(str.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? 999999 : num;
}

/**
 * 시간 값을 화면 표시용 "mm:ss" 문자열로 포맷팅
 */
function formatDisplayTime(val) {
  const totalSec = parseTimeToSeconds(val);
  if (totalSec >= 999999) return "00:00";
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return (mins < 10 ? "0" + mins : mins) + ":" + (secs < 10 ? "0" + secs : secs);
}

/**
 * 구글 시트에서 종료시간(finishtime) 오름차순 기준 TOP 3 랭킹 추출
 */
function getTop3Rankings() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME) 
                || SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  // A열:timestamp, B열:name, C열:score, D열:finishtime
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const records = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const timestamp = row[0];
    const name = row[1];
    const score = row[2];
    const finishtime = row[3];

    if (name && finishtime) {
      records.push({
        name: String(name),
        score: Number(score) || 0,
        finishtime: formatDisplayTime(finishtime),
        seconds: parseTimeToSeconds(finishtime)
      });
    }
  }

  // 1순위: 소요 시간(초) 오름차순, 2순위: 시도 횟수 오름차순
  records.sort(function(a, b) {
    if (a.seconds !== b.seconds) {
      return a.seconds - b.seconds;
    }
    return a.score - b.score;
  });

  return records.slice(0, 3).map(function(item, idx) {
    return {
      rank: idx + 1,
      name: item.name,
      score: item.score,
      finishtime: item.finishtime
    };
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME) 
                  || SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["timestamp", "name", "score", "finishtime"]);
      sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
    }

    let data;
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    } else {
      throw new Error("전달된 데이터가 없습니다.");
    }

    const now = new Date();
    const formattedTimestamp = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    const name = data.name || "익명";
    const score = data.score !== undefined ? data.score : 0;
    const finishtime = data.finishtime || "00:00";

    // 문자열 강제 지정을 위해 작은따옴표를 붙이거나 텍스트로 저장
    sheet.appendRow([formattedTimestamp, name, score, "'" + finishtime]);

    const top3 = getTop3Rankings();

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        top3: top3
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    const top3 = getTop3Rankings();
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        top3: top3
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
