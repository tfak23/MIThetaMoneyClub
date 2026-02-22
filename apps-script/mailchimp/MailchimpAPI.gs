// ===========================
// Mailchimp API — low-level API calls
// ===========================

/**
 * Make a GET request to the Mailchimp API.
 * @param {string} endpoint - API path (e.g. "/lists")
 * @returns {Object} parsed JSON response
 */
function mcFetch(endpoint) {
  var url = getMcBaseUrl() + endpoint;
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode('apikey:' + getMcApiKey())
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    var body = response.getContentText();
    Logger.log('Mailchimp API error (' + code + '): ' + body);
    throw new Error('Mailchimp API error (' + code + '): ' + body.substring(0, 200));
  }

  return JSON.parse(response.getContentText());
}

/**
 * Fetch all pages of a paginated Mailchimp endpoint.
 * @param {string} endpoint - API path (without pagination params)
 * @param {string} itemsKey - the key in the response that holds the array (e.g. "members", "campaigns")
 * @returns {Object[]} all items across all pages
 */
function mcFetchPaginated(endpoint, itemsKey) {
  var allItems = [];
  var offset = 0;
  var pageSize = MC_CONFIG.PAGE_SIZE;
  var separator = endpoint.indexOf('?') >= 0 ? '&' : '?';

  while (true) {
    var url = endpoint + separator + 'count=' + pageSize + '&offset=' + offset;
    var data = mcFetch(url);
    var items = data[itemsKey] || [];
    allItems = allItems.concat(items);

    if (items.length < pageSize) break;
    offset += pageSize;
  }

  return allItems;
}

// ===========================
// High-level data fetching
// ===========================

/**
 * Fetch all members from the Mailchimp audience.
 * Returns array of { email, roll, status }
 * @returns {Object[]}
 */
function mcGetAllMembers() {
  var listId = getMcListId();
  var rollTag = getMcRollTag();

  var members = mcFetchPaginated(
    '/lists/' + listId + '/members?fields=members.email_address,members.status,members.merge_fields',
    'members'
  );

  return members.map(function(m) {
    return {
      email: (m.email_address || '').toLowerCase().trim(),
      roll: String(m.merge_fields[rollTag] || '').trim(),
      status: m.status // subscribed, unsubscribed, cleaned, pending
    };
  });
}

/**
 * Fetch all sent campaigns from Mailchimp.
 * Returns array of { id, subject, sendDate, recipientCount, openRate, opensTotal }
 * @returns {Object[]}
 */
function mcGetCampaigns() {
  var campaigns = mcFetchPaginated(
    '/campaigns?status=sent&sort_field=send_time&sort_dir=ASC',
    'campaigns'
  );

  return campaigns.map(function(c) {
    var stats = c.report_summary || {};
    return {
      id: c.id,
      subject: (c.settings && c.settings.subject_line) || '(no subject)',
      sendDate: c.send_time || '',
      recipientCount: (c.recipients && c.recipients.recipient_count) || 0,
      openRate: stats.open_rate || 0,
      opensTotal: stats.opens || 0
    };
  });
}

/**
 * Fetch open details for a campaign — who opened it.
 * Returns array of email addresses that opened.
 * @param {string} campaignId
 * @returns {string[]}
 */
function mcGetCampaignOpens(campaignId) {
  var opens = mcFetchPaginated(
    '/reports/' + campaignId + '/open-details?fields=members.email_address',
    'members'
  );

  var emails = {};
  for (var i = 0; i < opens.length; i++) {
    var email = (opens[i].email_address || '').toLowerCase().trim();
    if (email) emails[email] = true;
  }

  return Object.keys(emails);
}

/**
 * Fetch sent-to list for a campaign — who was sent the email.
 * Returns array of email addresses.
 * @param {string} campaignId
 * @returns {string[]}
 */
function mcGetCampaignSentTo(campaignId) {
  var sentTo = mcFetchPaginated(
    '/reports/' + campaignId + '/sent-to?fields=sent_to.email_address',
    'sent_to'
  );

  return sentTo.map(function(s) {
    return (s.email_address || '').toLowerCase().trim();
  }).filter(function(e) { return e; });
}
