// ===========================
// Triggers — custom menu (all campaigns are manual via dashboard)
// ===========================

/**
 * Adds custom menu when the spreadsheet is opened.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Money Club')
    .addItem('Email Dashboard', 'showDashboard')
    .addToUi();
  ui.createMenu('Mailchimp')
    .addItem('Open Dashboard', 'showMcDashboard')
    .addToUi();
}

/**
 * Remove all project triggers (cleanup utility).
 */
function removeTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  Logger.log('All triggers removed.');
}
