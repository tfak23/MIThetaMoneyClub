// ===========================
// Dashboard — sidebar UI server functions
// ===========================

/**
 * Open the email dashboard sidebar.
 */
function showDashboard() {
  var html = HtmlService.createHtmlOutputFromFile('DashboardUI')
    .setTitle('Money Club Email Dashboard')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Send a preview email to the test recipients.
 * @param {string} type - one of: donor-thanks, lapsed, past-donor, non-donor
 * @returns {string} status message
 */
function previewEmail(type) {
  return sendPreviewEmail(type);
}

/**
 * Get recipient list for a campaign type (for review before sending).
 * @param {string} type - campaign type
 * @returns {Object[]} Array of { roll, fullName, email, extra }
 */
function getDashboardRecipients(type) {
  return getRecipientList(type);
}

/**
 * Send a campaign to the selected recipients.
 * @param {string} type - campaign type
 * @param {string[]} rolls - roll numbers to include
 * @returns {string} status message
 */
function dashboardSendCampaign(type, rolls) {
  return sendCampaign(type, rolls);
}

/**
 * Get current status for the dashboard display, including alert counts.
 * @returns {Object}
 */
function getDashboardStatus() {
  var status = getCampaignStatus();

  // Get pending counts for each campaign type (for green alert badges)
  var alertTypes = ['donor-thanks', 'lapsed', 'past-donors', 'non-donors'];
  var alerts = {};
  for (var i = 0; i < alertTypes.length; i++) {
    try {
      alerts[alertTypes[i]] = getRecipientList(alertTypes[i]).length;
    } catch (e) {
      alerts[alertTypes[i]] = 0;
    }
  }
  status.alerts = alerts;

  return status;
}
