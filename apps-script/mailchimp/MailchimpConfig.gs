// ===========================
// Mailchimp Integration — Configuration
// ===========================

const MC_CONFIG = {
  // Sheet info (this script is bound to the Email Stats sheet)
  EMAIL_STATS_TAB: 'Email Stats',
  OPEN_TAB: 'Open',
  DIDNT_OPEN_TAB: "Didn't Open",
  UNSUB_TAB: 'Unsubscribed',

  // Column mappings (1-based) — Email Stats tab
  ROLL_COL: 7,            // G — Roll Number
  EMAIL_COL: 12,          // L — Current email address
  MC_EMAIL_COL: 13,       // M — Mailchimp email (for mismatch flagging)
  SYNC_STATUS_COL: 14,    // N — Sync status (Match / Mismatch / Not in Mailchimp)
  TRACKING_START_COL: 25, // Y — First campaign tracking column
  LABEL_ROW: 14,          // Row where campaign subject labels go
  PROTECTED_START_COL: 68, // BP — Don't overwrite columns from here onward

  // Filters
  MIN_RECIPIENTS: 100,    // Only show campaigns with 100+ recipients

  // Pagination
  PAGE_SIZE: 1000         // Mailchimp API max per request
};

/**
 * Get the Mailchimp API key from Script Properties.
 * @returns {string}
 */
function getMcApiKey() {
  var key = PropertiesService.getScriptProperties().getProperty('MAILCHIMP_API_KEY');
  if (!key) throw new Error('Mailchimp API key not set. Go to Project Settings → Script Properties and add MAILCHIMP_API_KEY.');
  return key;
}

/**
 * Get the Mailchimp datacenter from the API key (e.g. "us21").
 * @returns {string}
 */
function getMcDatacenter() {
  var key = getMcApiKey();
  var parts = key.split('-');
  if (parts.length < 2) throw new Error('Invalid Mailchimp API key format. Expected format: xxx-us21');
  return parts[parts.length - 1];
}

/**
 * Get the Mailchimp API base URL.
 * @returns {string}
 */
function getMcBaseUrl() {
  return 'https://' + getMcDatacenter() + '.api.mailchimp.com/3.0';
}

/**
 * Store the Mailchimp API key in Script Properties.
 * Called from the dashboard UI.
 * @param {string} key
 */
function setMcApiKey(key) {
  PropertiesService.getScriptProperties().setProperty('MAILCHIMP_API_KEY', key.trim());
  return 'API key saved successfully.';
}

/**
 * Store the Mailchimp list/audience ID in Script Properties.
 * @param {string} listId
 */
function setMcListId(listId) {
  PropertiesService.getScriptProperties().setProperty('MAILCHIMP_LIST_ID', listId.trim());
  return 'List ID saved.';
}

/**
 * Get the stored Mailchimp list ID, or auto-discover it.
 * @returns {string}
 */
function getMcListId() {
  var stored = PropertiesService.getScriptProperties().getProperty('MAILCHIMP_LIST_ID');
  if (stored) return stored;

  // Auto-discover: use the first list
  var lists = mcFetch('/lists?count=1');
  if (!lists.lists || lists.lists.length === 0) throw new Error('No Mailchimp audiences found.');
  var listId = lists.lists[0].id;
  setMcListId(listId);
  return listId;
}

/**
 * Store the Roll Number merge field tag.
 * @param {string} tag
 */
function setMcRollTag(tag) {
  PropertiesService.getScriptProperties().setProperty('MAILCHIMP_ROLL_TAG', tag.trim());
}

/**
 * Get the Roll Number merge field tag, or auto-discover it.
 * @returns {string}
 */
function getMcRollTag() {
  var stored = PropertiesService.getScriptProperties().getProperty('MAILCHIMP_ROLL_TAG');
  if (stored) return stored;

  // Auto-discover: find merge field named "Roll Number"
  var listId = getMcListId();
  var fields = mcFetch('/lists/' + listId + '/merge-fields?count=100');
  if (!fields.merge_fields) throw new Error('Could not fetch merge fields.');

  for (var i = 0; i < fields.merge_fields.length; i++) {
    var f = fields.merge_fields[i];
    if (f.name.toLowerCase().indexOf('roll') >= 0) {
      setMcRollTag(f.tag);
      return f.tag;
    }
  }

  throw new Error('Could not find a "Roll Number" merge field in Mailchimp. Check your audience merge fields.');
}

/**
 * Add custom menu to the spreadsheet.
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Mailchimp')
    .addItem('Open Dashboard', 'showMcDashboard')
    .addToUi();
}
