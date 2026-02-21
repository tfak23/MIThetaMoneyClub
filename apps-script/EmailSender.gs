// ===========================
// Email Sender — handles sending with rate limiting and logging
// ===========================

/**
 * Send a single email via GmailApp.
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {string} htmlBody - HTML content
 * @returns {boolean} true if sent successfully
 */
function sendEmail(to, subject, htmlBody) {
  try {
    GmailApp.sendEmail(to, subject, '', {
      htmlBody: htmlBody,
      name: EMAIL_CONFIG.SENDER_NAME
    });
    return true;
  } catch (e) {
    Logger.log('Failed to send email to ' + to + ': ' + e.message);
    return false;
  }
}

/**
 * Send a preview email to the logged-in user.
 * @param {string} type - one of: new-donor, quarterly, lapsed, past-donor, non-donor
 * @returns {string} status message
 */
function sendPreviewEmail(type) {
  const profiles = buildDonorProfiles();
  if (profiles.length === 0) return 'No donor profiles found.';

  // Pick a sample donor based on type
  let sample;
  if (type === 'new-donor') {
    sample = profiles.find(p => p.segment === 'new-donor') || profiles.find(p => p.currentYearAmt > 0) || profiles[0];
  } else if (type === 'quarterly') {
    sample = profiles.find(p => p.isMonthlyDonor) || profiles[0];
    if (!sample.isMonthlyDonor) {
      sample.streak = 14; // Fake streak for preview
      sample.fund = 'Both';
    }
  } else if (type === 'lapsed') {
    sample = profiles.find(p => p.totalDonations > 0) || profiles[0];
    sample.prevStreak = sample.streak > 0 ? sample.streak : 8; // Fake previous streak for preview
  } else if (type === 'past-donor') {
    sample = profiles.find(p => p.segment === 'past-donor') || profiles.find(p => p.totalDonations > 0) || profiles[0];
  } else if (type === 'non-donor') {
    sample = profiles.find(p => p.segment === 'non-donor') || profiles[0];
  } else {
    return 'Unknown email type: ' + type;
  }

  // Generate email content
  let emailData;
  switch (type) {
    case 'new-donor':
      emailData = newDonorThankYou(sample);
      break;
    case 'quarterly':
      emailData = quarterlyThankYouTemplate(sample);
      break;
    case 'lapsed':
      emailData = lapsedReengagement(sample);
      break;
    case 'past-donor':
      emailData = annualPastDonor(sample);
      break;
    case 'non-donor':
      emailData = annualNonDonor(sample);
      break;
  }

  // Send to the test recipients
  const testRecipients = [
    'afakhou3@gmail.com',     // Tony Fakhouri
    'sigepsam@gmail.com',     // Sam Moschelli
    'js.morris612@gmail.com'  // Joe Morris
  ];

  let sentCount = 0;
  for (const email of testRecipients) {
    if (sendEmail(email, '[PREVIEW] ' + emailData.subject, emailData.html)) {
      sentCount++;
    }
  }

  if (sentCount > 0) {
    return 'Preview sent to ' + sentCount + ' test recipients (using ' + sample.fullName + ' as sample data)';
  } else {
    return 'Failed to send previews. Check the logs.';
  }
}

/**
 * Check remaining daily email quota.
 * @returns {number} emails remaining today
 */
function getRemainingQuota() {
  const sentToday = getEmailsSentToday();
  return Math.max(0, EMAIL_CONFIG.DAILY_LIMIT - sentToday);
}
