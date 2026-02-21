// ===========================
// Unsubscribe — web app endpoint
// ===========================

/**
 * Handle GET requests for unsubscribe.
 * Deploy this as a web app: Deploy > New deployment > Web app > Anyone can access
 *
 * After deploying, copy the URL and set it as a script property:
 *   File > Project properties > Script properties > UNSUBSCRIBE_URL
 *
 * Or run setUnsubscribeUrl('your-deployed-url-here') once.
 */
function doGet(e) {
  const roll = e && e.parameter && e.parameter.roll ? String(e.parameter.roll).trim() : '';

  if (!roll) {
    return HtmlService.createHtmlOutput(unsubPage('Invalid request.', false));
  }

  try {
    // Add to Unsubscribed tab
    const ss = SpreadsheetApp.openById(EMAIL_CONFIG.EMAIL_SHEET_ID);
    const sheet = ss.getSheetByName(EMAIL_CONFIG.UNSUB_TAB);

    if (!sheet) {
      return HtmlService.createHtmlOutput(unsubPage('Unable to process. Please try again later.', false));
    }

    // Check if already unsubscribed
    const existing = sheet.getDataRange().getValues();
    for (let i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).trim() === roll) {
        return HtmlService.createHtmlOutput(unsubPage('You have already been unsubscribed.', true));
      }
    }

    // Add the roll number
    sheet.appendRow([roll, new Date()]);

    return HtmlService.createHtmlOutput(unsubPage('You have been successfully unsubscribed.', true));
  } catch (err) {
    Logger.log('Unsubscribe error: ' + err.message);
    return HtmlService.createHtmlOutput(unsubPage('An error occurred. Please try again later.', false));
  }
}

/**
 * Generate unsubscribe confirmation page HTML.
 */
function unsubPage(message, success) {
  const color = success ? '#2e7d32' : '#c62828';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">'
    + '<style>body{margin:0;padding:40px 20px;background:#f5f5f5;font-family:Arial,sans-serif;text-align:center;}'
    + '.card{max-width:400px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.1);}'
    + 'h1{color:#6A1B4D;font-size:20px;margin-bottom:16px;}p{color:' + color + ';font-size:16px;line-height:1.5;}'
    + '</style></head><body><div class="card">'
    + '<h1>MI Theta Money Club</h1>'
    + '<p>' + message + '</p>'
    + '</div></body></html>';
}

/**
 * Helper to set the unsubscribe URL after deploying the web app.
 * Run this once from the script editor after deploying.
 * @param {string} url - the deployed web app URL
 */
function setUnsubscribeUrl(url) {
  PropertiesService.getScriptProperties().setProperty('UNSUBSCRIBE_URL', url);
  Logger.log('Unsubscribe URL set to: ' + url);
}
