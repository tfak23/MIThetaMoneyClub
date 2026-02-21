// ===========================
// Data Reader — reads from both Google Sheets
// ===========================

/**
 * Get email lookup map from the Email Stats sheet.
 * @returns {Map<string, string>} roll number → email address
 */
function getEmailLookup() {
  const ss = SpreadsheetApp.openById(EMAIL_CONFIG.EMAIL_SHEET_ID);
  const sheet = ss.getSheetByName(EMAIL_CONFIG.EMAIL_TAB);
  if (!sheet) throw new Error('Email Stats tab not found');

  const data = sheet.getDataRange().getValues();
  const lookup = new Map();

  for (let i = 1; i < data.length; i++) {
    const roll = String(data[i][EMAIL_CONFIG.EMAIL_ROLL_COL - 1] || '').trim();
    const email = String(data[i][EMAIL_CONFIG.EMAIL_ADDR_COL - 1] || '').trim().toLowerCase();
    if (roll && email && email.includes('@')) {
      lookup.set(roll, email);
    }
  }

  return lookup;
}

/**
 * Get set of unsubscribed roll numbers.
 * @returns {Set<string>}
 */
function getUnsubscribed() {
  const ss = SpreadsheetApp.openById(EMAIL_CONFIG.EMAIL_SHEET_ID);
  const sheet = ss.getSheetByName(EMAIL_CONFIG.UNSUB_TAB);
  if (!sheet) return new Set();

  const data = sheet.getDataRange().getValues();
  const unsub = new Set();

  for (let i = 1; i < data.length; i++) {
    const roll = String(data[i][EMAIL_CONFIG.UNSUB_ROLL_COL - 1] || '').trim();
    if (roll) unsub.add(roll);
  }

  return unsub;
}

/**
 * Read Master tab and return donor objects.
 */
function getMasterData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EMAIL_CONFIG.MASTER_SHEET);
  if (!sheet) throw new Error('Master tab not found');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, EMAIL_CONFIG.COL_TOTAL).getValues();

  const currentYearCol = getCurrentYearDonorCol();
  const prevYearCol = getPreviousYearDonorCol();

  const donors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const designation = String(row[EMAIL_CONFIG.COL_DESIGNATION - 1] || '').trim().toLowerCase();
    if (designation !== 'brother') continue;

    let firstName = String(row[EMAIL_CONFIG.COL_FIRST_NAME - 1] || '').trim();
    let lastName = String(row[EMAIL_CONFIG.COL_LAST_NAME - 1] || '').trim();

    // Strip deceased markers
    firstName = firstName.replace(/\*+$/, '').trim();
    lastName = lastName.replace(/\*+$/, '').trim();

    if (!firstName && !lastName) continue;

    const roll = String(row[EMAIL_CONFIG.COL_ROLL - 1] || '').trim();
    if (!roll) continue;

    const totalDonations = parseAmount(row[EMAIL_CONFIG.COL_TOTAL - 1]);
    const currentYearAmt = currentYearCol <= row.length ? parseAmount(row[currentYearCol - 1]) : 0;
    const prevYearAmt = prevYearCol <= row.length ? parseAmount(row[prevYearCol - 1]) : 0;
    const decade = String(row[EMAIL_CONFIG.COL_DECADE - 1] || '').trim();

    donors.push({
      roll: roll,
      firstName: firstName,
      lastName: lastName,
      fullName: firstName + ' ' + lastName,
      totalDonations: totalDonations,
      currentYearAmt: currentYearAmt,
      prevYearAmt: prevYearAmt,
      decade: decade
    });
  }

  return donors;
}

/**
 * Parse a dollar amount from a cell value.
 */
function parseAmount(val) {
  if (typeof val === 'number') return val;
  return parseFloat(String(val || '0').replace(/[$,]/g, '')) || 0;
}

/**
 * Read monthly streaks from BMS and Leadership tracker tabs.
 * @returns {Map<string, {streak: number, fund: string}>} keyed by "FirstName LastName"
 */
function getMonthlyStreaks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const merged = new Map();

  function readTracker(tabName, fundLabel) {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    const startRow = EMAIL_CONFIG.TRACKER_START_ROW;
    const endRow = Math.min(EMAIL_CONFIG.TRACKER_END_ROW, sheet.getLastRow());
    if (endRow < startRow) return;

    const range = sheet.getRange(startRow, 1, endRow - startRow + 1, EMAIL_CONFIG.TRACKER_STREAK_COL);
    const data = range.getValues();

    for (let i = 0; i < data.length; i++) {
      let first = String(data[i][EMAIL_CONFIG.TRACKER_FIRST_COL - 1] || '').trim().replace(/\*+$/, '');
      let last = String(data[i][EMAIL_CONFIG.TRACKER_LAST_COL - 1] || '').trim().replace(/\*+$/, '');
      const streak = parseInt(String(data[i][EMAIL_CONFIG.TRACKER_STREAK_COL - 1] || '0').replace(/[^0-9]/g, ''), 10) || 0;

      if (!first || !last || streak <= 1) continue;

      const name = first + ' ' + last;
      if (merged.has(name)) {
        const existing = merged.get(name);
        existing.fund = 'Both';
        existing.streak = Math.max(existing.streak, streak);
      } else {
        merged.set(name, { streak: streak, fund: fundLabel });
      }
    }
  }

  readTracker(EMAIL_CONFIG.BMS_TRACKER, 'BMS');
  readTracker(EMAIL_CONFIG.LEADERSHIP_TRACKER, 'Leadership');

  return merged;
}

/**
 * Build complete donor profiles by merging Master data, email lookup, streaks, and unsubscribe list.
 * @returns {Object[]} Array of donor profile objects
 */
function buildDonorProfiles() {
  const masterData = getMasterData();
  const emailLookup = getEmailLookup();
  const unsubscribed = getUnsubscribed();
  const streaks = getMonthlyStreaks();

  const profiles = [];

  for (const donor of masterData) {
    const email = emailLookup.get(donor.roll);
    if (!email) continue; // No email on file — skip
    if (unsubscribed.has(donor.roll)) continue; // Unsubscribed — skip

    // Look up streak by full name
    const streakInfo = streaks.get(donor.fullName);
    const streak = streakInfo ? streakInfo.streak : 0;
    const fund = streakInfo ? streakInfo.fund : '';

    // Determine segment
    let segment;
    if (donor.currentYearAmt > 0 && donor.prevYearAmt === 0 && Math.abs(donor.totalDonations - donor.currentYearAmt) < 1) {
      segment = 'new-donor';
    } else if (donor.currentYearAmt > 0) {
      segment = 'current-year-donor';
    } else if (donor.totalDonations > 0) {
      segment = 'past-donor';
    } else {
      segment = 'non-donor';
    }

    profiles.push({
      roll: donor.roll,
      firstName: donor.firstName,
      lastName: donor.lastName,
      fullName: donor.fullName,
      email: email,
      totalDonations: donor.totalDonations,
      currentYearAmt: donor.currentYearAmt,
      prevYearAmt: donor.prevYearAmt,
      streak: streak,
      fund: fund,
      decade: donor.decade,
      segment: segment,
      isMonthlyDonor: streak > 1
    });
  }

  return profiles;
}

// ===========================
// Email Log
// ===========================

/**
 * Get or create the Email Log sheet.
 */
function getLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EMAIL_CONFIG.LOG_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(EMAIL_CONFIG.LOG_TAB);
    sheet.appendRow(['Roll Number', 'Email Type', 'Date Sent', 'Previous Streak', 'Email Address']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Get all email log entries.
 * @returns {Object[]} Array of {roll, type, date, prevStreak}
 */
function getEmailLog() {
  const sheet = getLogSheet();
  const data = sheet.getDataRange().getValues();
  const entries = [];

  for (let i = 1; i < data.length; i++) {
    entries.push({
      roll: String(data[i][0] || '').trim(),
      type: String(data[i][1] || '').trim(),
      date: data[i][2],
      prevStreak: parseInt(data[i][3] || '0', 10) || 0
    });
  }

  return entries;
}

/**
 * Log that an email was sent.
 */
function logEmailSent(roll, type, prevStreak, email) {
  const sheet = getLogSheet();
  sheet.appendRow([roll, type, new Date(), prevStreak || 0, email || '']);
}

// ===========================
// Batch Queue
// ===========================

/**
 * Get or create the Batch Queue sheet (for multi-day campaign state).
 */
function getBatchSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EMAIL_CONFIG.BATCH_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(EMAIL_CONFIG.BATCH_TAB);
    sheet.appendRow(['Roll Number', 'Email', 'Email Type', 'Status', 'Date Queued']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Queue a batch of recipients for multi-day sending.
 */
function queueBatch(recipients, emailType) {
  const sheet = getBatchSheet();
  const rows = recipients.map(r => [r.roll, r.email, emailType, 'pending', new Date()]);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }
}

/**
 * Get pending items from the batch queue.
 * @returns {Object[]} Array of {row, roll, email, type}
 */
function getPendingBatch() {
  const sheet = getBatchSheet();
  const data = sheet.getDataRange().getValues();
  const pending = [];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]).trim().toLowerCase() === 'pending') {
      pending.push({
        row: i + 1, // 1-based sheet row
        roll: String(data[i][0]).trim(),
        email: String(data[i][1]).trim(),
        type: String(data[i][2]).trim()
      });
    }
  }

  return pending;
}

/**
 * Mark a batch row as sent.
 */
function markBatchSent(rowNumber) {
  const sheet = getBatchSheet();
  sheet.getRange(rowNumber, 4).setValue('sent');
}

/**
 * Clear all completed batch entries.
 */
function clearCompletedBatch() {
  const sheet = getBatchSheet();
  const data = sheet.getDataRange().getValues();

  // Delete from bottom to top to avoid row shift issues
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][3]).trim().toLowerCase() === 'sent') {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * Get count of emails sent today (from Email Log).
 */
function getEmailsSentToday() {
  const log = getEmailLog();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return log.filter(entry => {
    const d = new Date(entry.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;
}
