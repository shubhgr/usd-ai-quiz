// USD Knowledge Challenge — Google Sheets backend
//
// TWO WRITES ONLY:
//   1. register  → Registration tab (user details)
//   2. saveAnswers → Responses tab (one answer string + score when done)
//
// Registration: pid, name, email, phone, workExperience, domain, status,
//                registeredAt, lastActivityAt, completionTimeSeconds, completedAt
// Responses:    pid, name, email, answers, score
//
// Deploy: Deploy > New deployment > Web app
//   Execute as: Me | Who has access: Anyone
// Set Script Property API_KEY to match GAS_API_KEY in Next.js (.env.local)

var TOTAL_QUESTIONS = 28;
// Must match lib/answerKey.ts (q8=a, q18=a, all others=b)
var CORRECT_KEY = "bbbbbbbabbbbbbbbbabbbbbbbbbb";

var REG_HEADERS = [
  "pid", "name", "email", "phone", "workExperience", "domain",
  "status", "registeredAt", "lastActivityAt", "completionTimeSeconds", "completedAt",
];
var RESP_HEADERS = ["pid", "name", "email", "answers", "score"];

var REG_STATUS = 7;
var REG_LAST = 9;
var REG_TIME = 10;
var REG_COMPLETED = 11;
var RESP_ANSWERS = 4;
var RESP_SCORE = 5;

function doGet(e) {
  return handle(e);
}

function doPost(e) {
  return handle(e);
}

function handle(e) {
  var params = e.parameter || {};
  var action = String(params.action || "");
  var lock = null;
  // Read-only actions skip the exclusive lock so Continue/leaderboard
  // aren't stuck behind register/saveAnswers (which can take 30s+).
  var needsLock =
    action === "register" ||
    action === "saveAnswers" ||
    action === "clearResponses" ||
    action === "submit";
  if (needsLock) {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(8000)) {
      return json({
        ok: false,
        code: "BUSY",
        error: "Server busy, please retry in a moment.",
      });
    }
  }
  try {
    ensureSetup();
    var authErr = checkAuth(params);
    if (authErr) return json(authErr);

    var result;
    switch (action) {
      case "register":       result = actionRegister(params); break;
      case "resume":         result = actionResume(params); break;
      case "getProgress":    result = actionGetProgress(params); break;
      case "saveAnswers":    result = actionSaveAnswers(params); break;
      case "clearResponses": result = actionClearResponses(params); break;
      case "submit":         result = actionSubmit(params); break;
      case "leaderboard":    result = actionLeaderboard(params); break;
      default:
        result = { ok: false, code: "UNKNOWN_ACTION", error: "Unknown action: " + action };
    }
    return json(result);
  } catch (err) {
    return json({ ok: false, code: "ERROR", error: String(err) });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function checkAuth(params) {
  var expected = PropertiesService.getScriptProperties().getProperty("API_KEY");
  if (!expected) return null;
  if (String(params.key || "") !== expected) {
    return { ok: false, code: "UNAUTHORIZED", error: "Invalid API key" };
  }
  return null;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- Setup & schema ----

function ensureSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reg = ss.getSheetByName("Registration");
  if (!reg) reg = ss.insertSheet("Registration");
  ensureHeader(reg, REG_HEADERS);

  migrateResponsesSheetIfNeeded(ss);
  var resp = ss.getSheetByName("Responses");
  if (!resp) resp = ss.insertSheet("Responses");
  ensureHeader(resp, RESP_HEADERS);
}

/** Old deployments used q1..q28 columns. Archive that tab and start fresh. */
function migrateResponsesSheetIfNeeded(ss) {
  var resp = ss.getSheetByName("Responses");
  if (!resp || resp.getLastRow() === 0) return;

  var col4Header = String(resp.getRange(1, 4).getValue()).trim();
  if (col4Header === "answers") return;

  // Old format (q1, q2, …) or unknown — archive so headers stay clean.
  if (col4Header === "q1" || resp.getLastColumn() > RESP_HEADERS.length) {
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    resp.setName("Responses_old_" + stamp);
  }
}

function ensureHeader(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  var first = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var ok = first.length === headers.length;
  if (ok) {
    for (var i = 0; i < headers.length; i++) {
      if (String(first[i]) !== headers[i]) { ok = false; break; }
    }
  }
  if (!ok) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  // Trim stray columns from old layouts (q1..q28 headers left over).
  var extra = sheet.getLastColumn() - headers.length;
  if (extra > 0) {
    sheet.deleteColumns(headers.length + 1, extra);
  }
}

// ---- Lookups ----

function findRow(sheet, col, value) {
  var data = sheet.getDataRange().getValues();
  var needle = String(value).toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var cell = data[i][col - 1];
    if (cell !== null && cell !== undefined && String(cell).toLowerCase() === needle) {
      return { row: i + 1, values: data[i] };
    }
  }
  return null;
}

function findRegistrationByPid(ss, pid) {
  return findRow(ss.getSheetByName("Registration"), 1, pid);
}

function findRegistrationByEmail(ss, email) {
  return findRow(ss.getSheetByName("Registration"), 3, email);
}

function findResponseRowByPid(ss, pid) {
  return findRow(ss.getSheetByName("Responses"), 1, pid);
}

function iso(v) {
  try {
    if (v === null || v === undefined || v === "") return null;
    var d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toISOString();
  } catch (e) {
    return String(v);
  }
}

function ensureResponseRow(ss, reg) {
  var sheet = ss.getSheetByName("Responses");
  var pid = String(reg.values[0]);
  var resp = findResponseRowByPid(ss, pid);
  if (!resp) {
    sheet.appendRow([pid, String(reg.values[1]), String(reg.values[2]), "", ""]);
    resp = findResponseRowByPid(ss, pid);
  }
  return { sheet: sheet, resp: resp };
}

// ---- Answer string helpers ----

function questionIdAt(index) {
  return "q" + (index + 1);
}

function normalizeAnswers(raw) {
  return String(raw || "").trim().toLowerCase();
}

function validateAnswers(answers) {
  if (!answers) return "answers is required";
  if (answers.length > TOTAL_QUESTIONS) return "answers string is too long";
  if (!/^[abcd]+$/.test(answers)) return "answers must be only a, b, c, or d";
  return null;
}

function scoreFromAnswers(answers) {
  var total = 0;
  for (var i = 0; i < answers.length && i < TOTAL_QUESTIONS; i++) {
    if (answers.charAt(i) === CORRECT_KEY.charAt(i)) total++;
  }
  return total;
}

function responsesFromString(answerStr) {
  var out = [];
  for (var i = 0; i < answerStr.length && i < TOTAL_QUESTIONS; i++) {
    out.push({
      questionId: questionIdAt(i),
      answer: answerStr.charAt(i),
      answeredAt: null,
    });
  }
  return out;
}

function markCompleted(reg, rowInfo, answers) {
  var now = new Date();
  var totalScore = scoreFromAnswers(answers);
  var startedAt = reg.values[7];
  var startMs = startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime();
  var completionTimeSeconds = Math.max(0, Math.round((now.getTime() - startMs) / 1000));

  rowInfo.sheet.getRange(rowInfo.resp.row, RESP_SCORE).setValue(totalScore);

  var rs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Registration");
  rs.getRange(reg.row, REG_STATUS).setValue("completed");
  rs.getRange(reg.row, REG_LAST).setValue(now);
  rs.getRange(reg.row, REG_TIME).setValue(completionTimeSeconds);
  rs.getRange(reg.row, REG_COMPLETED).setValue(now);

  return {
    ok: true,
    completed: true,
    totalScore: totalScore,
    completionTimeSeconds: completionTimeSeconds,
    completedAt: now.toISOString(),
  };
}

// ---- Actions ----

function actionRegister(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pid = String(params.pid || "");
  var email = String(params.email || "").trim().toLowerCase();
  if (!pid || !email) {
    return { ok: false, code: "BAD_REQUEST", error: "pid and email are required" };
  }

  var existing = findRegistrationByEmail(ss, email);
  if (existing) {
    return {
      ok: true,
      existing: true,
      pid: String(existing.values[0]),
      name: String(existing.values[1]),
      email: String(existing.values[2]),
      status: String(existing.values[6]),
      registeredAt: iso(existing.values[7]),
      lastActivityAt: iso(existing.values[8]),
    };
  }

  var now = new Date();
  ss.getSheetByName("Registration").appendRow([
    pid,
    String(params.name || ""),
    email,
    String(params.phone || ""),
    String(params.workExperience || ""),
    String(params.domain || ""),
    "not_started",
    now,
    now,
  ]);

  return {
    ok: true,
    existing: false,
    pid: pid,
    name: String(params.name || ""),
    email: email,
    status: "not_started",
    registeredAt: now.toISOString(),
    lastActivityAt: now.toISOString(),
  };
}

function actionResume(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var email = String(params.email || "").trim().toLowerCase();
  if (!email) return { ok: false, code: "BAD_REQUEST", error: "Email is required" };

  var found = findRegistrationByEmail(ss, email);
  if (!found) {
    return { ok: false, code: "NOT_FOUND", error: "No registration found for this email." };
  }

  return {
    ok: true,
    pid: String(found.values[0]),
    name: String(found.values[1]),
    email: String(found.values[2]),
    status: String(found.values[6]),
    registeredAt: iso(found.values[7]),
    lastActivityAt: iso(found.values[8]),
  };
}

function actionGetProgress(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pid = String(params.pid || "");
  if (!pid) return { ok: false, code: "BAD_REQUEST", error: "pid is required" };

  var reg = findRegistrationByPid(ss, pid);
  if (!reg) return { ok: false, code: "NOT_FOUND", error: "Participant not found" };

  var responses = [];
  var score = null;
  var resp = findResponseRowByPid(ss, pid);

  if (resp) {
    var answerStr = normalizeAnswers(resp.values[RESP_ANSWERS - 1]);
    responses = responsesFromString(answerStr);

    var sc = resp.values[RESP_SCORE - 1];
    if (sc !== "" && sc !== null && sc !== undefined) {
      score = {
        totalScore: Number(sc),
        completionTimeSeconds: Number(reg.values[REG_TIME - 1] || 0),
        completedAt: iso(reg.values[REG_COMPLETED - 1]),
      };
    }
  }

  return {
    ok: true,
    pid: pid,
    name: String(reg.values[1]),
    email: String(reg.values[2]),
    status: String(reg.values[6]),
    registeredAt: iso(reg.values[7]),
    lastActivityAt: iso(reg.values[8]),
    responses: responses,
    score: score,
  };
}

function actionSaveAnswers(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pid = String(params.pid || "");
  var answers = normalizeAnswers(params.answers);

  if (!pid) return { ok: false, code: "BAD_REQUEST", error: "pid is required" };

  var err = validateAnswers(answers);
  if (err) return { ok: false, code: "BAD_REQUEST", error: err };

  var reg = findRegistrationByPid(ss, pid);
  if (!reg) return { ok: false, code: "NOT_FOUND", error: "Participant not found" };
  if (String(reg.values[6]) === "completed") {
    return { ok: false, code: "ALREADY_COMPLETED", error: "Quiz already completed" };
  }

  var rowInfo = ensureResponseRow(ss, reg);
  var now = new Date();
  rowInfo.sheet.getRange(rowInfo.resp.row, RESP_ANSWERS).setValue(answers);

  var rs = ss.getSheetByName("Registration");
  rs.getRange(reg.row, REG_STATUS).setValue("in_progress");
  rs.getRange(reg.row, REG_LAST).setValue(now);

  if (answers.length === TOTAL_QUESTIONS) {
    return markCompleted(reg, rowInfo, answers);
  }

  return { ok: true, completed: false };
}

function actionClearResponses(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pid = String(params.pid || "");
  var resp = findResponseRowByPid(ss, pid);

  if (resp) {
    var sheet = ss.getSheetByName("Responses");
    sheet.getRange(resp.row, RESP_ANSWERS).setValue("");
    sheet.getRange(resp.row, RESP_SCORE).setValue("");
  }

  var reg = findRegistrationByPid(ss, pid);
  if (reg) {
    var rs = ss.getSheetByName("Registration");
    rs.getRange(reg.row, REG_STATUS).setValue("not_started");
    rs.getRange(reg.row, REG_LAST).setValue(new Date());
    rs.getRange(reg.row, REG_TIME).setValue("");
    rs.getRange(reg.row, REG_COMPLETED).setValue("");
  }

  return { ok: true };
}

function actionSubmit(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pid = String(params.pid || "");
  var reg = findRegistrationByPid(ss, pid);
  if (!reg) return { ok: false, code: "NOT_FOUND", error: "Participant not found" };

  var resp = findResponseRowByPid(ss, pid);
  if (!resp) return { ok: false, code: "INCOMPLETE", error: "Not all questions have been answered" };

  var sc = resp.values[RESP_SCORE - 1];
  if (String(reg.values[6]) === "completed" && sc !== "" && sc !== null && sc !== undefined) {
    return {
      ok: true,
      alreadyCompleted: true,
      totalScore: Number(sc),
      completionTimeSeconds: Number(reg.values[REG_TIME - 1] || 0),
      completedAt: iso(reg.values[REG_COMPLETED - 1]),
    };
  }

  var answerStr = normalizeAnswers(resp.values[RESP_ANSWERS - 1]);
  if (answerStr.length < TOTAL_QUESTIONS) {
    return { ok: false, code: "INCOMPLETE", error: "Not all questions have been answered" };
  }

  var rowInfo = { sheet: ss.getSheetByName("Responses"), resp: resp };
  var result = markCompleted(reg, rowInfo, answerStr);
  result.alreadyCompleted = false;
  return result;
}

function actionLeaderboard(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pid = String(params.pid || "");
  var limit = Math.min(100, Math.max(1, Math.trunc(Number(params.limit || 20))));

  var respSheet = ss.getSheetByName("Responses");
  var regSheet = ss.getSheetByName("Registration");
  var respLast = respSheet.getLastRow();
  if (respLast < 2) {
    return { ok: true, topEntries: [], me: null };
  }

  var respRows = respLast - 1;
  var respData = respSheet.getRange(2, 1, respRows, 5).getValues();

  var regByPid = {};
  var regLast = regSheet.getLastRow();
  if (regLast >= 2) {
    var regData = regSheet.getRange(2, 1, regLast - 1, 11).getValues();
    for (var i = 0; i < regData.length; i++) {
      regByPid[String(regData[i][0])] = regData[i];
    }
  }

  var entries = [];
  for (var i = 0; i < respData.length; i++) {
    var r = respData[i];
    var sc = r[RESP_SCORE - 1];
    if (sc === "" || sc === null || sc === undefined) continue;
    var reg = regByPid[String(r[0])] || null;
    entries.push({
      pid: String(r[0]),
      name: String(r[1]),
      totalScore: Number(sc),
      completionTimeSeconds: reg ? Number(reg[REG_TIME - 1] || 0) : 0,
      completedAt: reg ? iso(reg[REG_COMPLETED - 1]) : null,
    });
  }

  entries.sort(function (a, b) {
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
    if (a.completionTimeSeconds !== b.completionTimeSeconds) {
      return a.completionTimeSeconds - b.completionTimeSeconds;
    }
    if (a.completedAt < b.completedAt) return -1;
    if (a.completedAt > b.completedAt) return 1;
    return 0;
  });

  var topEntries = entries.slice(0, limit);
  var me = null;
  if (pid) {
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].pid === pid) {
        var e = entries[j];
        me = {
          rank: j + 1,
          totalScore: e.totalScore,
          completionTimeSeconds: e.completionTimeSeconds,
          completedAt: e.completedAt,
        };
        break;
      }
    }
  }

  return { ok: true, topEntries: topEntries, me: me };
}
