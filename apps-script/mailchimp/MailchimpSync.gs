// ===========================
// Mailchimp Sync — email sync, campaign tracking, open rates
// ===========================

/**
 * Sync emails from Mailchimp — flags mismatches in columns M and N.
 * Does NOT overwrite column L. Returns summary for the dashboard.
 * @returns {Object} { total, matches, mismatches, notInMailchimp, mismatchList }
 */
function syncEmails() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MC_CONFIG.EMAIL_STATS_TAB);
  if (!sheet) throw new Error('Email Stats tab not found');

  // Fetch all Mailchimp members
  var mcMembers = mcGetAllMembers();

  // Build lookup by roll number → email
  var mcByRoll = {};
  for (var i = 0; i < mcMembers.length; i++) {
    var m = mcMembers[i];
    if (m.roll) {
      mcByRoll[m.roll] = m.email;
    }
  }

  // Read sheet data
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { total: 0, matches: 0, mismatches: 0, notInMailchimp: 0, mismatchList: [] };

  var rollRange = sheet.getRange(2, MC_CONFIG.ROLL_COL, lastRow - 1, 1).getValues();
  var emailRange = sheet.getRange(2, MC_CONFIG.EMAIL_COL, lastRow - 1, 1).getValues();

  var mcEmails = [];     // Column M values
  var syncStatuses = []; // Column N values
  var mismatchList = [];
  var matches = 0;
  var mismatches = 0;
  var notInMc = 0;

  for (var r = 0; r < rollRange.length; r++) {
    var roll = String(rollRange[r][0] || '').trim();
    var sheetEmail = String(emailRange[r][0] || '').trim().toLowerCase();

    if (!roll) {
      mcEmails.push(['']);
      syncStatuses.push(['']);
      continue;
    }

    var mcEmail = mcByRoll[roll];

    if (!mcEmail) {
      mcEmails.push(['']);
      syncStatuses.push(['Not in Mailchimp']);
      notInMc++;
    } else if (mcEmail === sheetEmail) {
      mcEmails.push([mcEmail]);
      syncStatuses.push(['Match']);
      matches++;
    } else {
      mcEmails.push([mcEmail]);
      syncStatuses.push(['Mismatch']);
      mismatches++;
      mismatchList.push({
        row: r + 2,
        roll: roll,
        sheetEmail: sheetEmail,
        mcEmail: mcEmail
      });
    }
  }

  // Write columns M and N
  sheet.getRange(2, MC_CONFIG.MC_EMAIL_COL, mcEmails.length, 1).setValues(mcEmails);
  sheet.getRange(2, MC_CONFIG.SYNC_STATUS_COL, syncStatuses.length, 1).setValues(syncStatuses);

  // Set column headers if not already set
  sheet.getRange(1, MC_CONFIG.MC_EMAIL_COL).setValue('Mailchimp Email');
  sheet.getRange(1, MC_CONFIG.SYNC_STATUS_COL).setValue('Sync Status');

  // Highlight mismatches in yellow
  for (var j = 0; j < mismatchList.length; j++) {
    var mRow = mismatchList[j].row;
    sheet.getRange(mRow, MC_CONFIG.MC_EMAIL_COL).setBackground('#fff9c4');
    sheet.getRange(mRow, MC_CONFIG.SYNC_STATUS_COL).setBackground('#fff9c4');
  }

  // Save last sync time
  PropertiesService.getScriptProperties().setProperty('LAST_EMAIL_SYNC', new Date().toISOString());

  return {
    total: rollRange.length,
    matches: matches,
    mismatches: mismatches,
    notInMailchimp: notInMc,
    mismatchList: mismatchList
  };
}

/**
 * Accept a single email update — copy Mailchimp email to column L.
 * @param {number} row - sheet row number (1-based)
 * @returns {string} status message
 */
function acceptEmailUpdate(row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MC_CONFIG.EMAIL_STATS_TAB);

  var mcEmail = sheet.getRange(row, MC_CONFIG.MC_EMAIL_COL).getValue();
  if (!mcEmail) return 'No Mailchimp email found for this row.';

  sheet.getRange(row, MC_CONFIG.EMAIL_COL).setValue(mcEmail);
  sheet.getRange(row, MC_CONFIG.SYNC_STATUS_COL).setValue('Match');
  sheet.getRange(row, MC_CONFIG.MC_EMAIL_COL).setBackground(null);
  sheet.getRange(row, MC_CONFIG.SYNC_STATUS_COL).setBackground(null);

  return 'Updated row ' + row + ' to ' + mcEmail;
}

/**
 * Accept all email mismatches — batch update column L.
 * @returns {string} status message
 */
function acceptAllEmailUpdates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MC_CONFIG.EMAIL_STATS_TAB);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'No data.';

  var statuses = sheet.getRange(2, MC_CONFIG.SYNC_STATUS_COL, lastRow - 1, 1).getValues();
  var mcEmails = sheet.getRange(2, MC_CONFIG.MC_EMAIL_COL, lastRow - 1, 1).getValues();
  var updated = 0;

  for (var i = 0; i < statuses.length; i++) {
    if (String(statuses[i][0]).trim() === 'Mismatch' && mcEmails[i][0]) {
      var row = i + 2;
      sheet.getRange(row, MC_CONFIG.EMAIL_COL).setValue(mcEmails[i][0]);
      sheet.getRange(row, MC_CONFIG.SYNC_STATUS_COL).setValue('Match');
      sheet.getRange(row, MC_CONFIG.MC_EMAIL_COL).setBackground(null);
      sheet.getRange(row, MC_CONFIG.SYNC_STATUS_COL).setBackground(null);
      updated++;
    }
  }

  return 'Updated ' + updated + ' email addresses.';
}

// ===========================
// Campaign Loading & Grouping
// ===========================

/**
 * Normalize a campaign subject for grouping resends.
 * Strips common prefixes/suffixes like "Reminder:", "(Resend)", etc.
 * @param {string} subject
 * @returns {string} normalized subject
 */
function normalizeSubject(subject) {
  var s = subject.toLowerCase().trim();
  // Strip common resend prefixes
  s = s.replace(/^(reminder|re|fwd|fw)\s*:\s*/i, '');
  // Strip trailing markers
  s = s.replace(/\s*\((resend|re-?send|2nd\s*send|reminder)\)\s*$/i, '');
  s = s.replace(/\s*-\s*(resend|re-?send|reminder)\s*$/i, '');
  s = s.replace(/\s*\(\d+\)\s*$/, '');
  return s.trim();
}

/**
 * Group campaigns by similar subject line.
 * @param {Object[]} campaigns - array of campaign objects
 * @returns {Object[]} array of { subject, normalizedSubject, campaigns: [...], totalRecipients, latestDate }
 */
function groupBySubject(campaigns) {
  var groups = {};
  var groupOrder = [];

  for (var i = 0; i < campaigns.length; i++) {
    var c = campaigns[i];
    var norm = normalizeSubject(c.subject);

    if (!groups[norm]) {
      groups[norm] = {
        subject: c.subject, // Use the first/original subject as display
        normalizedSubject: norm,
        campaigns: [],
        totalRecipients: 0,
        latestDate: ''
      };
      groupOrder.push(norm);
    }

    groups[norm].campaigns.push(c);
    groups[norm].totalRecipients += c.recipientCount;

    if (c.sendDate > groups[norm].latestDate) {
      groups[norm].latestDate = c.sendDate;
      groups[norm].subject = c.subject; // Use most recent subject as display
    }
  }

  return groupOrder.map(function(norm) { return groups[norm]; });
}

/**
 * Load campaigns from Mailchimp, filter to 100+ recipients, group by subject.
 * @returns {Object[]} grouped campaigns for the dashboard
 */
function loadCampaigns() {
  var allCampaigns = mcGetCampaigns();

  // Filter to 100+ recipients and last 12 months
  var cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  var cutoffStr = cutoff.toISOString();

  var filtered = allCampaigns.filter(function(c) {
    return c.recipientCount >= MC_CONFIG.MIN_RECIPIENTS && c.sendDate >= cutoffStr;
  });

  // Group by subject, then sort oldest → newest
  var grouped = groupBySubject(filtered);
  grouped.sort(function(a, b) {
    return (a.latestDate || '') < (b.latestDate || '') ? -1 : 1;
  });

  // Format for dashboard display
  return grouped.map(function(g) {
    var dates = g.campaigns.map(function(c) {
      return c.sendDate ? new Date(c.sendDate).toLocaleDateString() : '';
    }).join(', ');

    var avgOpenRate = 0;
    if (g.campaigns.length > 0) {
      var totalRate = 0;
      for (var i = 0; i < g.campaigns.length; i++) {
        totalRate += g.campaigns[i].openRate;
      }
      avgOpenRate = totalRate / g.campaigns.length;
    }

    return {
      subject: g.subject,
      campaignIds: g.campaigns.map(function(c) { return c.id; }),
      sendCount: g.campaigns.length,
      dates: dates,
      latestSendDate: g.latestDate,
      totalRecipients: g.totalRecipients,
      openRate: Math.round(avgOpenRate * 100)
    };
  });
}

// ===========================
// Campaign Tracking — Open Rate Columns
// ===========================

/**
 * Track selected campaigns — create columns and populate open/didn't open data.
 * @param {Object[]} selections - array of { subject, campaignIds } from the dashboard
 * @returns {string} status message
 */
function trackCampaigns(selections) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var statsSheet = ss.getSheetByName(MC_CONFIG.EMAIL_STATS_TAB);
  var openSheet = ss.getSheetByName(MC_CONFIG.OPEN_TAB);
  var didntOpenSheet = ss.getSheetByName(MC_CONFIG.DIDNT_OPEN_TAB);

  if (!statsSheet) throw new Error('Email Stats tab not found');

  var lastRow = statsSheet.getLastRow();
  var dataStartRow = MC_CONFIG.DATA_START_ROW;
  if (lastRow < dataStartRow) throw new Error('No data in Email Stats');

  // Read member data (starts at DATA_START_ROW, not row 2)
  var numDataRows = lastRow - dataStartRow + 1;
  var rollData = statsSheet.getRange(dataStartRow, MC_CONFIG.ROLL_COL, numDataRows, 1).getValues();
  var emailData = statsSheet.getRange(dataStartRow, MC_CONFIG.EMAIL_COL, numDataRows, 1).getValues();

  // Track where protected columns start (shifts as we insert)
  var protectedCol = MC_CONFIG.PROTECTED_START_COL;

  // Get next tracking column from saved position, or fall back to scanning
  var props = PropertiesService.getScriptProperties();
  var savedNextCol = props.getProperty('NEXT_TRACKING_COL');
  var nextCol;
  if (savedNextCol) {
    nextCol = parseInt(savedNextCol, 10);
  } else {
    // First time: scan label row to find where to start
    nextCol = MC_CONFIG.TRACKING_START_COL;
    for (var col = MC_CONFIG.TRACKING_START_COL; col < protectedCol; col++) {
      if (!statsSheet.getRange(MC_CONFIG.LABEL_ROW, col).getValue()) {
        nextCol = col;
        break;
      }
      nextCol = col + 1;
    }
  }

  // Find next available column in Open and Didn't Open tabs
  var openNextCol = openSheet ? Math.max(1, openSheet.getLastColumn() + 1) : 1;
  var didntOpenNextCol = didntOpenSheet ? Math.max(1, didntOpenSheet.getLastColumn() + 1) : 1;

  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var tracked = 0;

  for (var s = 0; s < selections.length; s++) {
    var sel = selections[s];
    var campaignIds = sel.campaignIds;
    var subject = sel.subject;

    // ALWAYS insert a new column so existing data is never overwritten.
    // Insert at nextCol — everything from nextCol onward shifts right.
    statsSheet.insertColumnBefore(nextCol);
    protectedCol++; // protected range shifted right too

    // Copy the entire previous column (formulas + values + formatting) into the new blank column
    var prevCol = nextCol - 1;
    if (prevCol >= MC_CONFIG.TRACKING_START_COL) {
      var srcRange = statsSheet.getRange(1, prevCol, lastRow, 1);
      var destRange = statsSheet.getRange(1, nextCol, lastRow, 1);
      srcRange.copyTo(destRange);
    }

    // Collect all emails that were sent to (union across resends)
    var sentToEmails = {};
    var openedEmails = {};

    for (var c = 0; c < campaignIds.length; c++) {
      var cid = campaignIds[c];

      var sentList = mcGetCampaignSentTo(cid);
      for (var j = 0; j < sentList.length; j++) {
        sentToEmails[sentList[j]] = true;
      }

      var openList = mcGetCampaignOpens(cid);
      for (var k = 0; k < openList.length; k++) {
        openedEmails[openList[k]] = true;
      }
    }

    // Format the label: "Feb 20, 26 - First Two"
    var shortSubject = subject.split(/\s+/).slice(0, 2).join(' ');
    var label = shortSubject;
    if (sel.latestSendDate) {
      var d = new Date(sel.latestSendDate);
      var dateStr = months[d.getMonth()] + ' ' + d.getDate() + ', ' + String(d.getFullYear()).slice(-2);
      label = dateStr + ' - ' + shortSubject;
    }

    // Prepare column data + Open/Didn't Open lists
    var colValues = [];
    var openRolls = [];
    var didntOpenRolls = [];

    for (var r = 0; r < rollData.length; r++) {
      var rowEmail = String(emailData[r][0] || '').trim().toLowerCase();
      var rowRoll = String(rollData[r][0] || '').trim();

      if (!rowEmail || !sentToEmails[rowEmail]) {
        colValues.push(['']);
      } else if (openedEmails[rowEmail]) {
        colValues.push(['Opened']);
        if (rowRoll) openRolls.push(rowRoll);
      } else {
        colValues.push(['Did Not Open']);
        if (rowRoll) didntOpenRolls.push(rowRoll);
      }
    }

    // Write tracking data to Email Stats (only the member data rows)
    if (colValues.length > 0) {
      statsSheet.getRange(dataStartRow, nextCol, colValues.length, 1).setValues(colValues);
    }

    // Write campaign label in row 1
    statsSheet.getRange(MC_CONFIG.LABEL_ROW, nextCol).setValue(label);

    // Write to Open tab
    if (openSheet && openRolls.length > 0) {
      openSheet.getRange(1, openNextCol).setValue(subject);
      var openValues = openRolls.map(function(r) { return [r]; });
      openSheet.getRange(2, openNextCol, openValues.length, 1).setValues(openValues);
      openNextCol++;
    }

    // Write to Didn't Open tab
    if (didntOpenSheet && didntOpenRolls.length > 0) {
      didntOpenSheet.getRange(1, didntOpenNextCol).setValue(subject);
      var didntOpenValues = didntOpenRolls.map(function(r) { return [r]; });
      didntOpenSheet.getRange(2, didntOpenNextCol, didntOpenValues.length, 1).setValues(didntOpenValues);
      didntOpenNextCol++;
    }

    nextCol++;
    tracked++;
  }

  // Save next available column for the next import
  props.setProperty('NEXT_TRACKING_COL', String(nextCol));

  return 'Tracked ' + tracked + ' campaign(s). New columns added to Email Stats, Open, and Didn\'t Open tabs.';
}

// ===========================
// Unsubscribe Sync
// ===========================

/**
 * Sync unsubscribes from Mailchimp to the Unsubscribed tab.
 * @returns {string} status message
 */
function syncUnsubscribes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var unsubSheet = ss.getSheetByName(MC_CONFIG.UNSUB_TAB);
  if (!unsubSheet) throw new Error('Unsubscribed tab not found');

  // Get all Mailchimp members, filter to unsubscribed/cleaned
  var mcMembers = mcGetAllMembers();
  var unsubRolls = [];
  for (var i = 0; i < mcMembers.length; i++) {
    var m = mcMembers[i];
    if ((m.status === 'unsubscribed' || m.status === 'cleaned') && m.roll) {
      unsubRolls.push(m.roll);
    }
  }

  // Get existing unsubscribed rolls
  var existingData = unsubSheet.getDataRange().getValues();
  var existingRolls = new Set();
  for (var j = 1; j < existingData.length; j++) {
    var roll = String(existingData[j][0] || '').trim();
    if (roll) existingRolls.add(roll);
  }

  // Add new unsubscribes
  var added = 0;
  for (var k = 0; k < unsubRolls.length; k++) {
    if (!existingRolls.has(unsubRolls[k])) {
      unsubSheet.appendRow([unsubRolls[k]]);
      added++;
    }
  }

  return 'Synced unsubscribes. ' + added + ' new, ' + (unsubRolls.length - added) + ' already tracked. Total: ' + unsubRolls.length + '.';
}
