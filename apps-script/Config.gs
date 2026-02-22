// ===========================
// Configuration
// ===========================

const EMAIL_CONFIG = {
  // Donor data sheet (the spreadsheet this script is bound to)
  DONOR_SHEET_ID: '1COGTThZLcbrNPafAuqjLTgNus_DN3rzJN8F3QPhg_dg',
  MASTER_SHEET: 'Master',
  BMS_TRACKER: 'BMS Tracker',
  LEADERSHIP_TRACKER: 'Leadership Tracker',

  // Email lookup sheet (separate spreadsheet)
  EMAIL_SHEET_ID: '1Ca03tfQPmgGm02AHJdwA_rWJ_S3JpM82iREE6d6QqwI',
  EMAIL_TAB: 'Email Stats',
  EMAIL_ROLL_COL: 7,    // Column G
  EMAIL_ADDR_COL: 12,   // Column L
  UNSUB_TAB: 'Unsubscribed',
  UNSUB_ROLL_COL: 1,    // Column A
  MEMBERSHIP_TAB: 'Membership Status',
  MEMBERSHIP_ROLL_COL: 9,    // Column I
  MEMBERSHIP_STATUS_COL: 2,  // Column B

  // Email log (tab in donor sheet)
  LOG_TAB: 'Email Log',

  // Batch queue (tab in donor sheet for multi-day campaign state)
  BATCH_TAB: 'Batch Queue',

  // Column mappings (Master tab, 1-based)
  COL_DESIGNATION: 3,   // C
  COL_ROLL: 4,          // D
  COL_FIRST_NAME: 5,    // E
  COL_LAST_NAME: 6,     // F
  COL_DECADE: 10,       // J
  COL_TOTAL: 152,       // EV

  // Dynamic year-based donor column (matches js/config.js logic)
  YEAR_DONOR_BASE_YEAR: 2026,
  YEAR_DONOR_BASE_COL: 101,  // CW = column 101 (Total for 2026)
  YEAR_DONOR_COL_STEP: 6,

  // Fund column offsets from the year's Total column (negative = left of Total)
  // 2026: Scholarship=CR(96), Leadership=CS(97), BMS=CT(98), RLC=CU(99), Direct=CV(100), Total=CW(101)
  FUND_OFFSET_SCHOLARSHIP: -5,
  FUND_OFFSET_LEADERSHIP: -4,
  FUND_OFFSET_BMS: -3,
  FUND_OFFSET_RLC: -2,
  FUND_OFFSET_DIRECT: -1,

  // Streak tracker columns
  TRACKER_FIRST_COL: 3,   // C
  TRACKER_LAST_COL: 4,    // D
  TRACKER_STREAK_COL: 5,  // E
  TRACKER_START_ROW: 4,
  TRACKER_END_ROW: 50,

  // Sender info
  SENDER_NAME: 'MI Theta Money Club',
  DAILY_LIMIT: 95,      // Stay under 100 with buffer
  SITE_URL: 'https://tfak23.github.io/MIThetaMoneyClub/',

  // Donate links
  DONATE_BMS: 'https://give.sigep.org/give/211213/#!/donation/checkout?designation=155554',
  DONATE_LEADERSHIP: 'https://give.sigep.org/give/211213/#!/donation/checkout?designation=155555'
};

/**
 * Get the column number (1-based) for a given year's donor data.
 */
function getYearDonorCol(year) {
  const offset = year - EMAIL_CONFIG.YEAR_DONOR_BASE_YEAR;
  return EMAIL_CONFIG.YEAR_DONOR_BASE_COL + (offset * EMAIL_CONFIG.YEAR_DONOR_COL_STEP);
}

/**
 * Get current year donor column number.
 */
function getCurrentYearDonorCol() {
  return getYearDonorCol(new Date().getFullYear());
}

/**
 * Get previous year donor column number.
 */
function getPreviousYearDonorCol() {
  return getYearDonorCol(new Date().getFullYear() - 1);
}
