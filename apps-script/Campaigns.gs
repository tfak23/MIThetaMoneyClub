// ===========================
// Campaigns — ALL manual, triggered via dashboard buttons
// ===========================

/**
 * Get recipients for a specific campaign type (for preview before sending).
 * @param {string} type - one of: new-donor, quarterly, lapsed, past-donors, non-donors
 * @returns {Object[]} Array of { roll, fullName, email, segment, extra }
 */
function getRecipientList(type) {
  var profiles = buildDonorProfiles();
  var log = getEmailLog();
  var recipients = [];

  if (type === 'donor-thanks') {
    // All current-year donors not yet thanked this year
    var now = new Date();
    var yearStart = new Date(now.getFullYear(), 0, 1);
    var thankedRolls = new Set(
      log.filter(function(e) {
        return e.type === 'donor-thanks' && new Date(e.date) >= yearStart;
      }).map(function(e) { return e.roll; })
    );
    recipients = profiles.filter(function(p) {
      return p.currentYearAmt > 0 && !thankedRolls.has(p.roll);
    }).map(function(p) {
      var extra = formatDollars(p.currentYearAmt) + ' this year';
      if (p.isMonthlyDonor) extra += ' | ' + p.streak + 'mo streak (' + p.fund + ')';
      return { roll: p.roll, fullName: p.fullName, email: p.email, segment: p.segment, extra: extra };
    });

  } else if (type === 'lapsed') {
    var prevStreaks = new Map();
    for (var i = 0; i < log.length; i++) {
      var entry = log[i];
      if (entry.type === 'quarterly-thanks' && entry.prevStreak > 1) {
        var current = prevStreaks.get(entry.roll) || 0;
        if (entry.prevStreak > current) prevStreaks.set(entry.roll, entry.prevStreak);
      }
    }
    var recentLapsedRolls = new Set(
      log.filter(function(e) {
        if (e.type !== 'lapsed-reengagement') return false;
        var daysSince = (Date.now() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince < 90;
      }).map(function(e) { return e.roll; })
    );
    recipients = profiles.filter(function(p) {
      if (recentLapsedRolls.has(p.roll)) return false;
      var prev = prevStreaks.get(p.roll) || 0;
      return prev > 1 && p.streak <= 1;
    }).map(function(p) {
      var prev = prevStreaks.get(p.roll) || 0;
      return { roll: p.roll, fullName: p.fullName, email: p.email, segment: 'lapsed', extra: 'Previous streak: ' + prev + ' months' };
    });

  } else if (type === 'past-donors') {
    var now2 = new Date();
    var halfYearStart = now2.getMonth() < 6
      ? new Date(now2.getFullYear(), 0, 1)
      : new Date(now2.getFullYear(), 6, 1);
    var alreadySent2 = new Set(
      log.filter(function(e) {
        return e.type === 'annual-past' && new Date(e.date) >= halfYearStart;
      }).map(function(e) { return e.roll; })
    );
    recipients = profiles.filter(function(p) {
      return p.segment === 'past-donor' && !alreadySent2.has(p.roll);
    }).map(function(p) {
      return { roll: p.roll, fullName: p.fullName, email: p.email, segment: p.segment, extra: formatDollars(p.totalDonations) + ' lifetime' };
    });

  } else if (type === 'non-donors') {
    var now3 = new Date();
    var halfYearStart2 = now3.getMonth() < 6
      ? new Date(now3.getFullYear(), 0, 1)
      : new Date(now3.getFullYear(), 6, 1);
    var alreadySent3 = new Set(
      log.filter(function(e) {
        return e.type === 'annual-nondonor' && new Date(e.date) >= halfYearStart2;
      }).map(function(e) { return e.roll; })
    );
    recipients = profiles.filter(function(p) {
      return p.segment === 'non-donor' && !alreadySent3.has(p.roll);
    }).map(function(p) {
      return { roll: p.roll, fullName: p.fullName, email: p.email, segment: p.segment, extra: 'No donations' };
    });
  }

  return recipients;
}

/**
 * Send a campaign to selected recipients (after reviewing the list).
 * @param {string} type - campaign type
 * @param {string[]} rollsToSend - array of roll numbers to send to (omitted rolls are excluded)
 * @returns {string} status message
 */
function sendCampaign(type, rollsToSend) {
  var profiles = buildDonorProfiles();
  var profileMap = new Map(profiles.map(function(p) { return [p.roll, p]; }));
  var log = getEmailLog();
  var remaining = getRemainingQuota();

  if (remaining <= 0) {
    return 'Daily email limit reached (0 remaining). Try again tomorrow.';
  }

  // For lapsed donors, build prevStreaks map
  var prevStreaks = new Map();
  if (type === 'lapsed') {
    for (var i = 0; i < log.length; i++) {
      var entry = log[i];
      if (entry.type === 'quarterly-thanks' && entry.prevStreak > 1) {
        var current = prevStreaks.get(entry.roll) || 0;
        if (entry.prevStreak > current) prevStreaks.set(entry.roll, entry.prevStreak);
      }
    }
  }

  // Count active donors this year (for social proof in past-donor emails)
  var activeDonorCount = profiles.filter(function(p) { return p.currentYearAmt > 0; }).length;

  var emailTypeMap = {
    'donor-thanks': 'donor-thanks',
    'lapsed': 'lapsed-reengagement',
    'past-donors': 'annual-past',
    'non-donors': 'annual-nondonor'
  };
  var emailType = emailTypeMap[type] || type;

  var sent = 0;
  var failed = 0;
  var skipped = 0;

  for (var j = 0; j < rollsToSend.length; j++) {
    if (sent >= remaining) {
      skipped = rollsToSend.length - j;
      break;
    }

    var roll = rollsToSend[j];
    var donor = profileMap.get(roll);
    if (!donor) { failed++; continue; }

    var emailData;
    if (type === 'donor-thanks') {
      emailData = donorThankYou(donor);
    } else if (type === 'lapsed') {
      var prev = prevStreaks.get(roll) || 0;
      var enrichedDonor = {};
      for (var key in donor) enrichedDonor[key] = donor[key];
      enrichedDonor.prevStreak = prev;
      emailData = lapsedReengagement(enrichedDonor);
    } else if (type === 'past-donors') {
      emailData = annualPastDonor(donor, activeDonorCount);
    } else if (type === 'non-donors') {
      emailData = annualNonDonor(donor);
    } else {
      failed++;
      continue;
    }

    if (sendEmail(donor.email, emailData.subject, emailData.html)) {
      logEmailSent(donor.roll, emailType, donor.streak || 0, donor.email);
      sent++;
    } else {
      failed++;
    }
  }

  var msg = 'Sent ' + sent + ' emails.';
  if (failed > 0) msg += ' ' + failed + ' failed.';
  if (skipped > 0) msg += ' ' + skipped + ' skipped (daily limit). Run again tomorrow.';
  return msg;
}

/**
 * Force-resend a donor thank-you with manually-specified streak info.
 * Use when the streak wasn't auto-detected due to a name mismatch in the tracker tab.
 *
 * Each entry: { roll, streak, fund }
 *   roll:   exactly as it appears in Master tab column D  (e.g. '214-0351')
 *   streak: consecutive months from the tracker tab       (e.g. 24)
 *   fund:   'BMS', 'Leadership', or 'Both'
 *
 * Example call from the script editor:
 *   resendDonorThanks([
 *     { roll: '214-0351', streak: 24, fund: 'BMS' },
 *     { roll: '214-0385', streak: 18, fund: 'Leadership' },
 *     { roll: '214-0362', streak: 12, fund: 'Leadership' },
 *     { roll: '214-0470', streak:  8, fund: 'Leadership' },
 *   ]);
 *
 * @param {Object[]} donors - array of { roll, streak, fund }
 * @returns {string} status message
 */
function resendDonorThanks(donors) {
  var profiles = buildDonorProfiles();
  var profileMap = new Map(profiles.map(function(p) { return [p.roll, p]; }));
  var remaining = getRemainingQuota();

  if (remaining <= 0) {
    return 'Daily email limit reached. Try again tomorrow.';
  }

  var sent = 0;
  var failed = 0;

  for (var i = 0; i < donors.length; i++) {
    if (sent >= remaining) break;

    var entry = donors[i];
    var donor = profileMap.get(entry.roll);
    if (!donor) {
      Logger.log('resendDonorThanks: no profile found for roll ' + entry.roll);
      failed++;
      continue;
    }

    // Copy donor and apply streak overrides
    var enriched = {};
    for (var key in donor) enriched[key] = donor[key];
    enriched.streak = entry.streak;
    enriched.fund = entry.fund;
    enriched.isMonthlyDonor = entry.streak > 1;

    var emailData = donorThankYou(enriched);
    if (sendEmail(enriched.email, emailData.subject, emailData.html)) {
      logEmailSent(enriched.roll, 'donor-thanks', enriched.streak, enriched.email);
      Logger.log('Resent to ' + enriched.fullName + ' (' + entry.roll + ') — streak: ' + enriched.streak + ' (' + enriched.fund + ')');
      sent++;
    } else {
      failed++;
    }
  }

  var msg = 'Resent ' + sent + ' donor thank-you email(s).';
  if (failed > 0) msg += ' ' + failed + ' failed — check Logs for details.';
  return msg;
}

/**
 * Get campaign status for the dashboard.
 * @returns {Object} status info
 */
function getCampaignStatus() {
  var sentToday = getEmailsSentToday();
  var log = getEmailLog();

  var lastSend = 'Never';
  if (log.length > 0) {
    lastSend = new Date(log[log.length - 1].date).toLocaleDateString();
  }

  return {
    sentToday: sentToday,
    dailyLimit: EMAIL_CONFIG.DAILY_LIMIT,
    lastSend: lastSend
  };
}
