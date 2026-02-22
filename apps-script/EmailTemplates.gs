// ===========================
// Email Templates — generates HTML email content
// ===========================

/** Base URL for images hosted on GitHub Pages */
var SITE_ASSETS = 'https://tfak23.github.io/MIThetaMoneyClub/assets/badges/';

/**
 * Format a dollar amount.
 */
function formatDollars(amount) {
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Format roll number for display — strip "214-0*" prefix (matches app logic).
 */
function formatRoll(roll) {
  return String(roll).replace(/^214-0*/i, '').replace(/-/g, '');
}

/**
 * Giving levels — matches js/giving-levels.js exactly.
 */
var GIVING_LEVELS_DATA = [
  { name: "The Chairman's Senate", min: 50000, max: Infinity, badge: 'chairmans-senate.jpg' },
  { name: "The Passion Pact",      min: 25000, max: 49999,    badge: 'passion-pact.jpg' },
  { name: "Founders Club",         min: 10000, max: 24999,    badge: 'founders-club.jpg' },
  { name: "The 1971 Society",      min: 2500,  max: 9999,     badge: 'the-1971-society.jpg' },
  { name: "Ducal Crown Club",      min: 1000,  max: 2499,     badge: 'ducal-crown-club.jpg' },
  { name: "TIPO's Trust",          min: 500,   max: 999,      badge: 'tipos-trust.jpg' },
  { name: "SigEp Sam Club",        min: 200,   max: 499,      badge: 'sigep-sam-club.jpg' },
  { name: "Alpha/Beta Club",       min: 100,   max: 199,      badge: 'alpha-beta-club.jpg' },
  { name: "Red Door Club",         min: 50,    max: 99,       badge: 'red-door-club.jpg' },
  { name: "The Sigma Circle",      min: 1,     max: 49,       badge: 'sigma-circle.jpg' }
];

/**
 * Get the giving level object for a donation total.
 */
function getGivingLevel(total) {
  if (!total || total <= 0) return null;
  for (var i = 0; i < GIVING_LEVELS_DATA.length; i++) {
    if (total >= GIVING_LEVELS_DATA[i].min) return GIVING_LEVELS_DATA[i];
  }
  return null;
}

/**
 * Get the next giving level object.
 */
function getNextGivingLevel(total) {
  if (!total || total <= 0) return GIVING_LEVELS_DATA[GIVING_LEVELS_DATA.length - 1];
  for (var i = GIVING_LEVELS_DATA.length - 1; i >= 0; i--) {
    if (total < GIVING_LEVELS_DATA[i].min) return GIVING_LEVELS_DATA[i];
  }
  return null;
}

/**
 * Get the giving level name for a donation total.
 */
function getGivingLevelName(total) {
  var level = getGivingLevel(total);
  return level ? level.name : '';
}

/**
 * Get streak milestone label.
 */
function getStreakMilestone(streak) {
  if (streak >= 120) return '10yr+';
  if (streak >= 60) return '5yr+';
  if (streak >= 36) return '3yr+';
  if (streak >= 24) return '2yr+';
  if (streak >= 12) return '1yr+';
  if (streak >= 6) return '6mo+';
  return '';
}

/**
 * Get the unsubscribe URL. Must be updated after deploying the web app.
 */
function getUnsubscribeUrl(roll) {
  var baseUrl = PropertiesService.getScriptProperties().getProperty('UNSUBSCRIBE_URL') || 'https://script.google.com/YOUR_DEPLOYED_URL';
  return baseUrl + '?roll=' + encodeURIComponent(roll);
}

/**
 * Common email footer HTML.
 */
function emailFooter(roll) {
  return '<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e0e0e0;text-align:center;font-size:12px;color:#999;">'
    + '<p>MI Theta Chapter &middot; Sigma Phi Epsilon &middot; Lawrence Technological University</p>'
    + '<p><a href="' + getUnsubscribeUrl(roll) + '" style="color:#999;">Unsubscribe</a></p>'
    + '</div>';
}

/**
 * Common email header/wrapper — includes banner.jpg at the top.
 */
function wrapEmail(bodyHtml, roll) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
    + '<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">'
    + '<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">'
    + '<div style="width:100%;"><img src="' + SITE_ASSETS + 'banner.jpg" alt="MI Theta Money Club" style="width:100%;display:block;border-radius:8px 8px 0 0;" /></div>'
    + '<div style="background:linear-gradient(135deg,#9B1B30,#6A1B4D);padding:16px 32px;text-align:center;">'
    + '<h1 style="margin:0;color:#fff;font-size:24px;">Money Club</h1>'
    + '<p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">MI Theta Chapter &middot; Sigma Phi Epsilon</p>'
    + '</div>'
    + '<div style="padding:32px;">'
    + bodyHtml
    + '</div>'
    + emailFooter(roll)
    + '</div></body></html>';
}

/**
 * Donate button HTML.
 */
function donateButton(label, url, color) {
  color = color || '#9B1B30';
  return '<div style="text-align:center;margin:24px 0;">'
    + '<a href="' + url + '" style="display:inline-block;background:' + color + ';color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;">'
    + label + '</a></div>';
}

/**
 * Build a "Money Club profile card" — matches what the person sees when they search
 * their name on the Money Club app. Includes badge, level, total, fund info, progress bar.
 */
function profileCard(donor) {
  var level = getGivingLevel(donor.totalDonations);
  var nextLevel = getNextGivingLevel(donor.totalDonations);

  // Badge image
  var badgeHtml = '';
  if (level) {
    badgeHtml = '<div style="text-align:center;margin-bottom:12px;">'
      + '<img src="' + SITE_ASSETS + level.badge + '" alt="' + level.name + '" style="width:100px;height:auto;" />'
      + '</div>';
  }

  // Name and roll (using formatRoll to strip "214-0*" prefix)
  var cardHtml = '<div style="text-align:center;padding:20px;margin:20px 0;background:#fafafa;border-radius:8px;border:1px solid #e0e0e0;">'
    + badgeHtml
    + '<h3 style="margin:0 0 4px;color:#d4a017;font-size:20px;">' + donor.fullName + '</h3>'
    + '<p style="margin:0 0 12px;color:#999;font-size:13px;">Chapter Roll #' + formatRoll(donor.roll) + '</p>'
    + '<div style="width:60px;height:2px;background:linear-gradient(90deg,#9B1B30,#6A1B4D);margin:0 auto 12px;"></div>'
    + '<p style="margin:0 0 4px;font-size:24px;font-weight:bold;color:#2d2d2d;">' + formatDollars(donor.totalDonations) + '</p>';

  // Fund info for monthly donors
  if (donor.isMonthlyDonor && donor.fund) {
    var fundLabel = donor.fund === 'Both' ? 'BMS & Leadership Funds'
      : donor.fund === 'BMS' ? 'Balanced Man Scholarship Fund'
      : 'Leadership Fund';
    cardHtml += '<p style="margin:0 0 4px;font-size:12px;color:#9B1B30;">Monthly Donor: ' + fundLabel + '</p>';
  }

  // Level name
  if (level) {
    cardHtml += '<p style="margin:0 0 12px;font-size:14px;font-weight:bold;color:#6A1B4D;">' + level.name + '</p>';
  } else {
    cardHtml += '<p style="margin:0 0 12px;font-size:14px;color:#999;">No donations recorded</p>';
  }

  // Progress bar toward next level — uses table layout for Gmail compatibility
  if (nextLevel && level && donor.totalDonations > 0) {
    var remaining = nextLevel.min - donor.totalDonations;
    var range = nextLevel.min - level.min;
    var progress = ((donor.totalDonations - level.min) / range) * 100;
    var pct = Math.min(Math.max(progress, 2), 100);

    cardHtml += '<div style="margin:8px 0;">'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:4px;"><tr>'
      + '<td style="text-align:left;font-size:11px;color:#999;padding:0;">' + level.name + ' (' + formatDollars(level.min) + ')</td>'
      + '<td style="text-align:right;font-size:11px;color:#999;padding:0;"><strong>' + nextLevel.name + ' (' + formatDollars(nextLevel.min) + ')</strong></td>'
      + '</tr></table>'
      + '<div style="width:100%;height:8px;background:#e0e0e0;border-radius:4px;overflow:hidden;">'
      + '<div style="width:' + pct.toFixed(1) + '%;height:100%;background:linear-gradient(90deg,#9B1B30,#6A1B4D);border-radius:4px;"></div>'
      + '</div>'
      + '<p style="text-align:center;margin:6px 0 0;font-size:12px;color:#999;">' + formatDollars(remaining) + ' away from <strong>' + nextLevel.name + '</strong></p>'
      + '</div>';
  } else if (!nextLevel && level) {
    cardHtml += '<p style="text-align:center;margin:8px 0 0;font-size:12px;color:#6A1B4D;font-weight:bold;">Highest giving level achieved!</p>';
  }

  cardHtml += '</div>';
  return cardHtml;
}

/**
 * "Share Money Club" CTA block — mailto link pre-filled with share message (matches app share).
 */
function shareCtaHtml() {
  var subject = encodeURIComponent('Check out MI Theta Money Club');
  var body = encodeURIComponent('Check out the MI Theta Money Club — look up giving levels and support our chapter!\n\n' + EMAIL_CONFIG.SITE_URL);
  var mailtoUrl = 'mailto:?subject=' + subject + '&body=' + body;

  return '<div style="text-align:center;margin:20px 0;padding:16px;background:#f0f4ff;border-radius:8px;border:1px solid #d0d8f0;">'
    + '<p style="margin:0 0 8px;font-size:14px;color:#555;">Know a brother who should check out Money Club?</p>'
    + '<a href="' + mailtoUrl + '" style="display:inline-block;background:#6A1B4D;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:bold;font-size:14px;">Share with a Brother</a>'
    + '<p style="margin:8px 0 0;font-size:12px;color:#999;">Opens your email with a pre-filled message and link!</p>'
    + '</div>';
}

/**
 * "See our overall progress" CTA block.
 */
function overallProgressCta() {
  return '<p style="font-size:16px;color:#555;line-height:1.6;text-align:center;">See our chapter\'s overall fundraising progress:</p>'
    + donateButton('View Our Progress', EMAIL_CONFIG.SITE_URL, '#6A1B4D');
}

// ===========================
// Template Functions
// ===========================

/**
 * Build fund breakdown HTML — lists each fund the donor gave to this year with amounts.
 */
function fundBreakdownHtml(donor) {
  var funds = [];
  if (donor.currentYearBMS > 0) funds.push({ name: 'Balanced Man Scholarship Fund', amount: donor.currentYearBMS });
  if (donor.currentYearLeadership > 0) funds.push({ name: 'Leadership Fund', amount: donor.currentYearLeadership });
  if (donor.currentYearScholarship > 0) funds.push({ name: 'Scholarship Fund', amount: donor.currentYearScholarship });
  if (donor.currentYearRLC > 0) funds.push({ name: 'RLC Fund', amount: donor.currentYearRLC });
  if (donor.currentYearDirect > 0) funds.push({ name: 'Direct Fund', amount: donor.currentYearDirect });

  if (funds.length === 0) return '';

  // Center the contributions block for better readability in emails (mobile-friendly)
  var html = '<div style="margin:16px 0;padding:16px;background:#f9f5ff;border-radius:8px;border:1px solid #e8ddf0;text-align:center;">';
  html += '<p style="margin:0 0 8px;font-size:13px;color:#6A1B4D;font-weight:bold;text-transform:uppercase;text-align:center;">Your ' + new Date().getFullYear() + ' Contributions</p>';
  for (var i = 0; i < funds.length; i++) {
    // Amount on one centered line, fund name on the next (smaller text) — improves wrapping on mobile
    html += '<p style="margin:6px 0;font-size:15px;color:#555;text-align:center;">'
      + '<strong>' + formatDollars(funds[i].amount) + '</strong><br/>'
      + '<span style="font-size:13px;color:#555;">to the ' + funds[i].name + '</span>'
      + '</p>';
  }
  html += '</div>';
  return html;
}

/**
 * Smart donor thank-you email — handles both regular and monthly donors.
 * Includes per-fund breakdown, streak info for monthly donors, and appropriate CTAs.
 */
function donorThankYou(donor) {
  var body = '<h2 style="color:#2d2d2d;margin-top:0;">Thank You, ' + donor.firstName + '!</h2>'
    + '<p style="font-size:16px;color:#555;line-height:1.6;">Your contributions to MI Theta mean the world to our chapter. Every dollar directly supports our brothers through scholarships and leadership development.</p>';

  // Fund breakdown (shows each fund they donated to with amounts)
  body += fundBreakdownHtml(donor);

  // Monthly donor streak info
  if (donor.isMonthlyDonor) {
    var fundText = donor.fund === 'Both' ? 'BMS & Leadership Funds'
      : donor.fund === 'BMS' ? 'Balanced Man Scholarship Fund'
      : 'Leadership Fund';

    body += '<p style="font-size:16px;color:#555;line-height:1.6;">You\'ve been a monthly donor for <strong>' + donor.streak + ' consecutive months</strong> to the <strong>' + fundText + '</strong> — that kind of consistency makes a real difference.</p>';

    var milestone = getStreakMilestone(donor.streak);
    if (milestone) {
      body += '<div style="text-align:center;margin:16px 0;"><span style="background:#fff3e0;color:#e65100;padding:6px 16px;border-radius:16px;font-weight:bold;font-size:14px;">Milestone: ' + milestone + '</span></div>';
    }
  }

  // Profile card
  body += profileCard(donor);

  // Share CTA
  body += shareCtaHtml();

  // Non-monthly donors: suggest setting up monthly donation
  if (!donor.isMonthlyDonor) {
    body += '<p style="font-size:16px;color:#555;line-height:1.6;">Want to make an even bigger impact? Consider setting up a monthly donation:</p>'
      + '<div style="text-align:center;margin:16px 0;">'
      + '<a href="' + EMAIL_CONFIG.DONATE_BMS + '" style="display:inline-block;background:#9B1B30;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:14px;margin:4px;">Support BMS Fund</a> '
      + '<a href="' + EMAIL_CONFIG.DONATE_LEADERSHIP + '" style="display:inline-block;background:#6A1B4D;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:14px;margin:4px;">Support Leadership Fund</a>'
      + '</div>';
  }

  body += overallProgressCta();
  body += '<p style="font-size:14px;color:#999;text-align:center;margin-top:24px;">Virtue, Diligence, Brotherly Love</p>';

  // Subject line adapts based on monthly vs non-monthly
  var subject = donor.isMonthlyDonor
    ? donor.firstName + ', Thank You — ' + donor.streak + ' Months and Counting!'
    : 'Thank You for Your Donation, ' + donor.firstName + '!';

  return {
    subject: subject,
    html: wrapEmail(body, donor.roll)
  };
}

/**
 * Lapsed monthly donor re-engagement email.
 */
function lapsedReengagement(donor) {
  var body = '<h2 style="color:#2d2d2d;margin-top:0;">We Miss You, ' + donor.firstName + '!</h2>'
    + '<p style="font-size:16px;color:#555;line-height:1.6;">Your monthly donation streak recently ended. We know life gets busy, but your consistent support was making a real impact for MI Theta.</p>'
    + (donor.prevStreak > 0
      ? '<div style="text-align:center;margin:20px 0;padding:16px;background:#fff3e0;border-radius:8px;"><p style="margin:0;font-size:18px;color:#e65100;font-weight:bold;">Your streak was ' + donor.prevStreak + ' months</p></div>'
      : '');

  body += profileCard(donor);

  body += '<p style="font-size:16px;color:#555;line-height:1.6;">It only takes a minute to get back on track. Pick up where you left off:</p>'
    + '<div style="text-align:center;margin:16px 0;">'
    + '<a href="' + EMAIL_CONFIG.DONATE_BMS + '" style="display:inline-block;background:#9B1B30;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;margin:4px;">Resume BMS Donation</a> '
    + '<a href="' + EMAIL_CONFIG.DONATE_LEADERSHIP + '" style="display:inline-block;background:#6A1B4D;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;margin:4px;">Resume Leadership Donation</a>'
    + '</div>';

  body += overallProgressCta();
  body += '<p style="font-size:14px;color:#999;text-align:center;margin-top:24px;">Virtue, Diligence, Brotherly Love</p>';

  return {
    subject: donor.firstName + ', Your Monthly Streak Needs You!',
    html: wrapEmail(body, donor.roll)
  };
}

/**
 * Build previous year fund callback HTML — lists funds the donor supported last year.
 */
function prevYearFundCallbackHtml(donor) {
  var funds = [];
  if (donor.prevYearBMS > 0) funds.push('Balanced Man Scholarship Fund');
  if (donor.prevYearLeadership > 0) funds.push('Leadership Fund');
  if (donor.prevYearScholarship > 0) funds.push('Scholarship Fund');
  if (donor.prevYearRLC > 0) funds.push('RLC Fund');
  if (donor.prevYearDirect > 0) funds.push('Direct Fund');

  if (funds.length === 0) return '';

  var fundList = funds.length === 1 ? funds[0] : funds.slice(0, -1).join(', ') + ' and ' + funds[funds.length - 1];
  return '<p style="font-size:16px;color:#555;line-height:1.6;">Last year you supported the <strong>' + fundList + '</strong>. That support is still making an impact for our brothers today.</p>';
}

/**
 * Annual re-engagement email for past donors (gave before, not this year).
 * Personalized with legacy framing, fund callback, next-level nudge, and social proof.
 * @param {Object} donor - donor profile
 * @param {number} activeDonorCount - number of brothers who have donated this year
 */
function annualPastDonor(donor, activeDonorCount) {
  var level = getGivingLevel(donor.totalDonations);
  var nextLevel = getNextGivingLevel(donor.totalDonations);
  var levelName = level ? level.name : '';

  // Legacy framing
  var body = '<h2 style="color:#2d2d2d;margin-top:0;">Hey ' + donor.firstName + ', We Could Use Your Help Again</h2>'
    + '<p style="font-size:16px;color:#555;line-height:1.6;">You\'ve contributed <strong>' + formatDollars(donor.totalDonations) + '</strong> to MI Theta over the years'
    + (levelName ? ' — that\'s <strong>' + levelName + '</strong>-level impact.' : '.') + ' That generosity has directly funded scholarships and leadership development for our brothers.</p>';

  // Fund callback (if they gave to specific funds last year)
  body += prevYearFundCallbackHtml(donor);

  // Profile card
  body += profileCard(donor);

  // Next-level nudge
  if (nextLevel && level) {
    var remaining = nextLevel.min - donor.totalDonations;
    body += '<p style="font-size:16px;color:#555;line-height:1.6;">You\'re just <strong>' + formatDollars(remaining) + '</strong> away from reaching <strong>' + nextLevel.name + '</strong>. A gift of any size gets you closer:</p>';
  } else {
    body += '<p style="font-size:16px;color:#555;line-height:1.6;">Keep your legacy going — a gift of any size makes a difference:</p>';
  }

  // Donate buttons
  body += '<div style="text-align:center;margin:16px 0;">'
    + '<a href="' + EMAIL_CONFIG.DONATE_BMS + '" style="display:inline-block;background:#9B1B30;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;margin:4px;">Support BMS Fund</a> '
    + '<a href="' + EMAIL_CONFIG.DONATE_LEADERSHIP + '" style="display:inline-block;background:#6A1B4D;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;margin:4px;">Support Leadership Fund</a>'
    + '</div>';

  // Social proof
  if (activeDonorCount > 0) {
    body += '<p style="font-size:16px;color:#555;line-height:1.6;text-align:center;"><strong>' + activeDonorCount + ' brothers</strong> have already donated this year — join them.</p>';
  }

  body += overallProgressCta();
  body += '<p style="font-size:14px;color:#999;text-align:center;margin-top:24px;">Virtue, Diligence, Brotherly Love</p>';

  return {
    subject: donor.firstName + ', MI Theta Could Use Your Support This Year',
    html: wrapEmail(body, donor.roll)
  };
}

/**
 * Annual email for non-donors (never donated).
 */
function annualNonDonor(donor) {
  var body = '<h2 style="color:#2d2d2d;margin-top:0;">Hey ' + donor.firstName + ', Your Brothers Need You</h2>'
    + '<p style="font-size:16px;color:#555;line-height:1.6;">MI Theta has been building something special — scholarships that change lives and leadership programs that shape the next generation of SigEp brothers at Lawrence Tech.</p>'
    + '<p style="font-size:16px;color:#555;line-height:1.6;">Right now, dozens of MI Theta alumni are giving back through the Money Club. A first-time gift of even <strong>$19.01</strong> makes a difference and adds your name to the board:</p>'
    + '<div style="text-align:center;margin:16px 0;">'
    + '<a href="' + EMAIL_CONFIG.DONATE_BMS + '" style="display:inline-block;background:#9B1B30;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;margin:4px;">Support BMS Fund</a> '
    + '<a href="' + EMAIL_CONFIG.DONATE_LEADERSHIP + '" style="display:inline-block;background:#6A1B4D;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:14px;margin:4px;">Support Leadership Fund</a>'
    + '</div>';

  body += overallProgressCta();
  body += '<p style="font-size:14px;color:#999;text-align:center;margin-top:24px;">Virtue, Diligence, Brotherly Love</p>';

  return {
    subject: donor.firstName + ', Join Your Brothers in Supporting MI Theta',
    html: wrapEmail(body, donor.roll)
  };
}
