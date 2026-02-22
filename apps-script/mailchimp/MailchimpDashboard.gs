// ===========================
// Mailchimp Dashboard — sidebar UI server functions
// ===========================

/**
 * Open the Mailchimp dashboard sidebar.
 */
function showMcDashboard() {
  var html = HtmlService.createHtmlOutputFromFile('MailchimpDashboardUI')
    .setTitle('Mailchimp Dashboard')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Check if the Mailchimp API key is configured.
 * @returns {Object} { configured, lastSync }
 */
function getMcStatus() {
  var key = PropertiesService.getScriptProperties().getProperty('MAILCHIMP_API_KEY');
  var lastSync = PropertiesService.getScriptProperties().getProperty('LAST_EMAIL_SYNC') || '';

  return {
    configured: !!key,
    lastSync: lastSync ? new Date(lastSync).toLocaleString() : 'Never'
  };
}

/**
 * Save API key from dashboard.
 * @param {string} key
 * @returns {string} status
 */
function dashboardSaveApiKey(key) {
  return setMcApiKey(key);
}

/**
 * Run email sync from dashboard.
 * @returns {Object} sync results
 */
function dashboardSyncEmails() {
  return syncEmails();
}

/**
 * Accept a single email update from dashboard.
 * @param {number} row
 * @returns {string}
 */
function dashboardAcceptUpdate(row) {
  return acceptEmailUpdate(row);
}

/**
 * Accept all email mismatches from dashboard.
 * @returns {string}
 */
function dashboardAcceptAll() {
  return acceptAllEmailUpdates();
}

/**
 * Load campaigns from dashboard.
 * @returns {Object[]}
 */
function dashboardLoadCampaigns() {
  return loadCampaigns();
}

/**
 * Track selected campaigns from dashboard.
 * @param {Object[]} selections - array of { subject, campaignIds }
 * @returns {string}
 */
function dashboardTrackCampaigns(selections) {
  return trackCampaigns(selections);
}

/**
 * Sync unsubscribes from dashboard.
 * @returns {string}
 */
function dashboardSyncUnsubscribes() {
  return syncUnsubscribes();
}
