// ── ATANDA VERSE — SHARED CONFIG ─────────────────────────────────────────
// Single source of truth for Supabase credentials.
// All pages load this before their own scripts.

(function () {
  var URL_KEY = 'iv_sb_url';
  var KEY_KEY = 'iv_sb_key';
  var SKIP_KEY = 'iv_setup_skip';

  function cleanUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  var savedUrl = cleanUrl(localStorage.getItem(URL_KEY));
  var savedKey = String(localStorage.getItem(KEY_KEY) || '').trim();

  if (savedUrl) localStorage.setItem(URL_KEY, savedUrl);
  else localStorage.removeItem(URL_KEY);

  if (savedKey) localStorage.setItem(KEY_KEY, savedKey);
  else localStorage.removeItem(KEY_KEY);

  if (savedUrl && savedKey && !localStorage.getItem(SKIP_KEY)) {
    localStorage.setItem(SKIP_KEY, '1');
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function hashString(value) {
    var str = String(value || '');
    var hash = 0;
    for (var i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'h' + Math.abs(hash).toString(36);
  }

  function getCreds() {
    var url = cleanUrl(localStorage.getItem(URL_KEY));
    var key = String(localStorage.getItem(KEY_KEY) || '').trim();
    if (!url || !key) return null;
    return { url: url, key: key };
  }

  function mergeTags(tags) {
    if (!tags) return '';
    var list = Array.isArray(tags) ? tags : String(tags).split(',');
    var deduped = [];
    list.forEach(function (tag) {
      var clean = String(tag || '').trim().toLowerCase();
      if (clean && deduped.indexOf(clean) === -1) deduped.push(clean);
    });
    return deduped.join(', ');
  }

  async function sbFetch(path, options) {
    var creds = getCreds();
    if (!creds) throw new Error('Supabase credentials missing');
    var opts = options || {};
    var headers = Object.assign({
      apikey: creds.key,
      Authorization: 'Bearer ' + creds.key,
      'Content-Type': 'application/json'
    }, opts.headers || {});
    var response = await fetch(creds.url + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body || null
    });
    if (!response.ok) throw new Error(await response.text());
    if (response.status === 204) return null;
    return response.json();
  }

  async function sbInvoke(fnName, payload) {
    var creds = getCreds();
    if (!creds) throw new Error('Supabase credentials missing');
    var response = await fetch(creds.url + '/functions/v1/' + fnName, {
      method: 'POST',
      headers: {
        apikey: creds.key,
        Authorization: 'Bearer ' + creds.key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload || {})
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json().catch(function () { return null; });
  }

  async function captureSubscriber(payload) {
    var email = normalizeEmail(payload && payload.email);
    if (!email) return { ok: false, reason: 'missing-email' };
    var now = new Date().toISOString();
    var source = String((payload && payload.source) || 'site').trim().toLowerCase();
    var name = String((payload && payload.name) || '').trim();
    var tags = mergeTags((payload && payload.tags) || []);
    var subscriberId = 'sub-' + hashString(email);
    var eventId = 'subevt-' + Date.now() + '-' + hashString(email + '-' + source + '-' + now);
    var subscriber = {
      id: subscriberId,
      email: email,
      name: name,
      source: source,
      tags: tags,
      subscribed_at: now
    };

    try {
      await sbFetch('subscribers?on_conflict=email', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(subscriber)
      });
    } catch (err) {
      console.warn('Subscriber capture failed', err);
      return { ok: false, reason: err && err.message ? err.message : 'capture-failed' };
    }

    try {
      await sbFetch('subscriber_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: eventId,
          subscriber_email: email,
          source: source,
          tag_snapshot: tags,
          name_snapshot: name,
          meta: JSON.stringify((payload && payload.meta) || {}),
          created_at: now
        })
      });
    } catch (err) {
      console.warn('Subscriber event capture skipped', err);
    }

    return { ok: true, email: email };
  }

  function getViewThrottleKey(postId) {
    return 'iv_view_ping_' + String(postId || '').trim().toLowerCase();
  }

  function getAnalyticsSessionId() {
    var key = 'iv_analytics_session';
    var existing = String(localStorage.getItem(key) || '').trim();
    if (existing) return existing;
    var created = 'sess-' + Date.now().toString(36) + '-' + hashString(Math.random() + '-' + navigator.userAgent);
    localStorage.setItem(key, created);
    return created;
  }

  function getVisitorFingerprint() {
    var parts = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.width || 0,
      screen.height || 0,
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      location.hostname || ''
    ];
    return 'vis-' + hashString(parts.join('|'));
  }

  function getAnalyticsContext(postId) {
    return {
      postId: String(postId || '').trim(),
      path: location.pathname || '',
      href: location.href || '',
      referrer: document.referrer || '',
      sessionId: getAnalyticsSessionId(),
      visitorKey: getVisitorFingerprint(),
      userAgent: navigator.userAgent || '',
      language: navigator.language || '',
      viewport: {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0
      },
      screen: {
        width: screen.width || 0,
        height: screen.height || 0
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    };
  }

  function shouldCountView(postId, throttleHours) {
    var key = getViewThrottleKey(postId);
    var last = parseInt(localStorage.getItem(key) || '0', 10);
    var now = Date.now();
    var wait = (Number(throttleHours) || 6) * 60 * 60 * 1000;
    if (last && (now - last) < wait) return false;
    localStorage.setItem(key, String(now));
    return true;
  }

  async function getPostViews(postIds) {
    var ids = Array.isArray(postIds) ? postIds.filter(Boolean) : [];
    var map = {};
    ids.forEach(function (id) { map[id] = 0; });
    if (!ids.length) return map;
    try {
      var rows = await sbFetch('post_views?select=post_id,views&post_id=in.(' + ids.map(encodeURIComponent).join(',') + ')');
      (rows || []).forEach(function (row) {
        if (row && row.post_id) map[row.post_id] = Number(row.views || 0);
      });
    } catch (err) {
      console.warn('Post views fetch failed', err);
    }
    return map;
  }

  async function getPostView(postId) {
    if (!postId) return null;
    var map = await getPostViews([postId]);
    return Object.prototype.hasOwnProperty.call(map, postId) ? map[postId] : null;
  }

  async function getAnalyticsSnapshot(postIds) {
    var ids = Array.isArray(postIds) ? postIds.filter(Boolean) : [];
    var snapshot = {
      viewMap: {},
      views24h: 0,
      visitors24h: 0,
      sessions24h: 0,
      recentEvents: [],
      recentEvents7d: [],
      perPostViews24h: {},
      perPostVisitors24h: {},
      perPostSeries7d: {}
    };

    ids.forEach(function (id) {
      snapshot.perPostViews24h[id] = 0;
      snapshot.perPostVisitors24h[id] = 0;
      snapshot.perPostSeries7d[id] = [0, 0, 0, 0, 0, 0, 0];
    });

    if (!ids.length) return snapshot;

    snapshot.viewMap = await getPostViews(ids);

    var now = Date.now();
    var since24h = new Date(now - (24 * 60 * 60 * 1000)).toISOString();
    var since7d = new Date(now - (7 * 24 * 60 * 60 * 1000)).toISOString();

    try {
      var recent = await sbFetch(
        'post_view_events?select=post_id,visitor_key,session_id,created_at&post_id=in.(' +
        ids.map(encodeURIComponent).join(',') +
        ')&created_at=gte.' + encodeURIComponent(since24h) +
        '&order=created_at.desc&limit=5000'
      );
      snapshot.recentEvents = Array.isArray(recent) ? recent : [];
    } catch (err) {
      console.warn('24h analytics snapshot fetch failed', err);
    }

    try {
      var seriesRows = await sbFetch(
        'post_view_events?select=post_id,created_at&post_id=in.(' +
        ids.map(encodeURIComponent).join(',') +
        ')&created_at=gte.' + encodeURIComponent(since7d) +
        '&order=created_at.desc&limit=10000'
      );
      snapshot.recentEvents7d = Array.isArray(seriesRows) ? seriesRows : [];
    } catch (err) {
      console.warn('7d analytics series fetch failed', err);
    }

    var visitorSet = new Set();
    var sessionSet = new Set();
    snapshot.recentEvents.forEach(function (row) {
      if (!row || !row.post_id) return;
      snapshot.views24h += 1;
      snapshot.perPostViews24h[row.post_id] = Number(snapshot.perPostViews24h[row.post_id] || 0) + 1;
      if (row.visitor_key) visitorSet.add(String(row.visitor_key));
      if (row.session_id) sessionSet.add(String(row.session_id));
    });
    snapshot.visitors24h = visitorSet.size;
    snapshot.sessions24h = sessionSet.size;

    var perPostVisitorSets = {};
    ids.forEach(function (id) { perPostVisitorSets[id] = new Set(); });
    snapshot.recentEvents.forEach(function (row) {
      if (row && row.post_id && row.visitor_key && perPostVisitorSets[row.post_id]) {
        perPostVisitorSets[row.post_id].add(String(row.visitor_key));
      }
    });
    ids.forEach(function (id) {
      snapshot.perPostVisitors24h[id] = perPostVisitorSets[id] ? perPostVisitorSets[id].size : 0;
    });

    var start = new Date(now - (6 * 24 * 60 * 60 * 1000));
    start.setHours(0, 0, 0, 0);
    snapshot.recentEvents7d.forEach(function (row) {
      if (!row || !row.post_id || !row.created_at || !snapshot.perPostSeries7d[row.post_id]) return;
      var created = new Date(row.created_at);
      if (isNaN(created.getTime())) return;
      var diff = Math.floor((created.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      if (diff >= 0 && diff < 7) snapshot.perPostSeries7d[row.post_id][diff] += 1;
    });

    return snapshot;
  }

  async function recordPostView(postId, options) {
    var id = String(postId || '').trim();
    if (!id) return { ok: false, reason: 'missing-post-id' };
    var throttleHours = options && options.throttleHours;
    if (!shouldCountView(id, throttleHours)) {
      var current = await getPostView(id);
      return { ok: true, skipped: true, views: current };
    }

    try {
      var fnResult = await sbInvoke('track-post-view', getAnalyticsContext(id));
      if (fnResult && fnResult.ok) {
        return { ok: true, views: Number(fnResult.views || 0), source: 'edge-function' };
      }
    } catch (fnErr) {
      console.warn('track-post-view function unavailable, falling back', fnErr);
    }

    var currentViews = 0;
    try {
      var currentRow = await sbFetch('post_views?select=post_id,views&post_id=eq.' + encodeURIComponent(id));
      if (currentRow && currentRow[0]) currentViews = Number(currentRow[0].views || 0);
    } catch (_err) {}

    var nextRow = {
      post_id: id,
      views: currentViews + 1,
      updated_at: new Date().toISOString()
    };

    try {
      await sbFetch('post_views?on_conflict=post_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(nextRow)
      });
      return { ok: true, views: nextRow.views, source: 'direct-fallback' };
    } catch (err) {
      console.warn('Post view record failed', err);
      return { ok: false, reason: err && err.message ? err.message : 'view-record-failed' };
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getContactConfig(kind) {
    var map = {
      general: {
        title: 'Contact Atanda',
        route: 'hello',
        recipient: 'hello@atanda.site',
        senderLabel: 'Atanda <hello@atanda.site>',
        eyebrow: 'General enquiry',
        subjectLabel: 'Subject',
        messageLabel: 'Message',
        messagePlaceholder: 'Tell us what you need, what you are exploring, or what kind of conversation you want to start.',
        extras: []
      },
      sessions: {
        title: 'Contact Sessions',
        route: 'sessions',
        recipient: 'sessions@atanda.site',
        senderLabel: 'Atanda Verse Sessions <sessions@atanda.site>',
        eyebrow: 'Session enquiry',
        subjectLabel: 'Session topic',
        messageLabel: 'What do you need help with?',
        messagePlaceholder: 'Ask about a package, timing, confirmation, rescheduling, or anything related to your session.',
        extras: [
          { id: 'package', label: 'Package', type: 'select', options: [
            { value: '', label: 'Select package' },
            { value: 'single', label: 'Single Session' },
            { value: 'three-pack', label: 'Three Session Package' },
            { value: 'group', label: 'Weekly Group Sessions' },
            { value: 'intensive', label: 'Monthly Intensive' }
          ]},
          { id: 'contact_method', label: 'Preferred reply channel', type: 'select', options: [
            { value: 'email', label: 'Email' },
            { value: 'whatsapp', label: 'WhatsApp' }
          ]}
        ]
      },
      support: {
        title: 'Get Support',
        route: 'support',
        recipient: 'support@atanda.site',
        senderLabel: 'Atanda Support <support@atanda.site>',
        eyebrow: 'Support request',
        subjectLabel: 'Issue summary',
        messageLabel: 'Describe the issue',
        messagePlaceholder: 'Tell us what went wrong, what page you were on, and how it affected you.',
        extras: [
          { id: 'issue_type', label: 'Issue type', type: 'select', options: [
            { value: '', label: 'Select issue type' },
            { value: 'payment', label: 'Payment issue' },
            { value: 'bug', label: 'Bug report' },
            { value: 'access', label: 'Access problem' },
            { value: 'feedback', label: 'Feedback' },
            { value: 'other', label: 'Other' }
          ]},
          { id: 'page_url', label: 'Page URL', type: 'text', placeholder: 'Auto-filled from current page' }
        ]
      }
    };
    return map[kind] || map.general;
  }

  function ensureContactModal() {
    if (document.getElementById('ivContactModal')) return;
    var style = document.createElement('style');
    style.textContent = ''
      + '.iv-contact-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:1rem;z-index:12000;background:rgba(8,14,27,.52);backdrop-filter:blur(10px)}'
      + '.iv-contact-modal.on{display:flex}'
      + '.iv-contact-sheet{width:min(680px,100%);max-height:min(88vh,860px);overflow:auto;border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 28px 70px rgba(15,23,42,.28);border:1px solid rgba(15,23,42,.08);padding:1.4rem}'
      + '.iv-contact-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}'
      + '.iv-contact-eyebrow{display:inline-flex;padding:.45rem .8rem;border-radius:999px;background:rgba(199,55,74,.08);color:#c7374a;font-size:.76rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.8rem}'
      + '.iv-contact-title{font-size:1.8rem;line-height:1.05;color:#16233f;font-weight:800;margin:0 0 .45rem}'
      + '.iv-contact-copy{margin:0;color:#61708f;line-height:1.7;font-size:.95rem}'
      + '.iv-contact-close{border:none;background:rgba(22,35,63,.08);color:#16233f;width:42px;height:42px;border-radius:12px;cursor:pointer;font-size:1.2rem;font-weight:700}'
      + '.iv-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.9rem}'
      + '.iv-contact-group{display:flex;flex-direction:column;gap:.4rem;margin-bottom:.9rem}'
      + '.iv-contact-group.full{grid-column:1 / -1}'
      + '.iv-contact-group label{font-size:.84rem;font-weight:700;color:#16233f}'
      + '.iv-contact-group input,.iv-contact-group select,.iv-contact-group textarea{width:100%;padding:.95rem 1rem;border-radius:16px;border:1px solid rgba(15,23,42,.1);background:#fff;font:inherit;color:#16233f;outline:none}'
      + '.iv-contact-group textarea{resize:vertical;min-height:130px}'
      + '.iv-contact-actions{display:flex;gap:.8rem;flex-wrap:wrap;align-items:center;margin-top:.4rem}'
      + '.iv-contact-submit{border:none;border-radius:16px;padding:1rem 1.3rem;background:linear-gradient(135deg,#c7374a,#8f2430);color:#fff;font:inherit;font-weight:800;cursor:pointer;box-shadow:0 16px 34px rgba(199,55,74,.24)}'
      + '.iv-contact-secondary{font-size:.84rem;color:#61708f;line-height:1.7}'
      + '.iv-contact-status{margin-top:.9rem;font-size:.88rem;font-weight:700;color:#1f7c67;display:none}'
      + '.iv-contact-status.on{display:block}'
      + '@media (max-width:640px){.iv-contact-grid{grid-template-columns:1fr}.iv-contact-sheet{padding:1rem;border-radius:20px}.iv-contact-title{font-size:1.55rem}}';
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.id = 'ivContactModal';
    modal.className = 'iv-contact-modal';
    modal.innerHTML = ''
      + '<div class="iv-contact-sheet" role="dialog" aria-modal="true" aria-labelledby="ivContactTitle">'
      + '  <div class="iv-contact-head">'
      + '    <div>'
      + '      <div class="iv-contact-eyebrow" id="ivContactEyebrow">General enquiry</div>'
      + '      <h2 class="iv-contact-title" id="ivContactTitle">Contact Atanda</h2>'
      + '      <p class="iv-contact-copy" id="ivContactCopy">Tell us what you need and we will route it properly.</p>'
      + '    </div>'
      + '    <button type="button" class="iv-contact-close" id="ivContactClose" aria-label="Close">×</button>'
      + '  </div>'
      + '  <form id="ivContactForm">'
      + '    <div class="iv-contact-grid">'
      + '      <div class="iv-contact-group"><label for="ivContactName">Name *</label><input id="ivContactName" name="name" type="text" required placeholder="Your name"></div>'
      + '      <div class="iv-contact-group"><label for="ivContactEmail">Email *</label><input id="ivContactEmail" name="email" type="email" required placeholder="you@example.com"></div>'
      + '      <div class="iv-contact-group full" id="ivContactExtras"></div>'
      + '      <div class="iv-contact-group full"><label for="ivContactSubject" id="ivContactSubjectLabel">Subject</label><input id="ivContactSubject" name="subject" type="text" required placeholder="What is this about?"></div>'
      + '      <div class="iv-contact-group full"><label for="ivContactMessage" id="ivContactMessageLabel">Message</label><textarea id="ivContactMessage" name="message" required placeholder="Tell us what you need."></textarea></div>'
      + '    </div>'
      + '    <div class="iv-contact-actions">'
      + '      <button type="submit" class="iv-contact-submit" id="ivContactSubmit">Send request</button>'
      + '      <div class="iv-contact-secondary" id="ivContactSecondary">We will route this request to the right Atanda inbox.</div>'
      + '    </div>'
      + '    <div class="iv-contact-status" id="ivContactStatus"></div>'
      + '  </form>'
      + '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (event) {
      if (event.target === modal) modal.classList.remove('on');
    });
    document.getElementById('ivContactClose').addEventListener('click', function () {
      modal.classList.remove('on');
    });
  }

  async function captureContactRequest(payload) {
    var now = new Date().toISOString();
    var request = {
      id: 'cr-' + Date.now() + '-' + hashString((payload && payload.email) + '-' + now),
      category: String((payload && payload.category) || 'general').trim().toLowerCase(),
      route_to: String((payload && payload.route_to) || 'hello').trim().toLowerCase(),
      name: String((payload && payload.name) || '').trim(),
      email: normalizeEmail(payload && payload.email),
      subject: String((payload && payload.subject) || '').trim(),
      message: String((payload && payload.message) || '').trim(),
      package: String((payload && payload.package) || '').trim(),
      issue_type: String((payload && payload.issue_type) || '').trim(),
      contact_method: String((payload && payload.contact_method) || '').trim(),
      source_page: String((payload && payload.source_page) || location.pathname || '').trim(),
      page_url: String((payload && payload.page_url) || location.href || '').trim(),
      status: 'new',
      meta: JSON.stringify((payload && payload.meta) || {}),
      created_at: now
    };

    var localQueue = JSON.parse(localStorage.getItem('iv_contact_requests_pending') || '[]');
    localQueue.push(request);
    localStorage.setItem('iv_contact_requests_pending', JSON.stringify(localQueue));

    try {
      await sbFetch('contact_requests', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(request)
      });
      try {
        await sbInvoke('send-contact-request', { requestId: request.id });
      } catch (notifyErr) {
        console.warn('Contact acknowledgement function unavailable', notifyErr);
      }
      return { ok: true, request: request };
    } catch (err) {
      console.warn('Contact request capture failed', err);
      return { ok: false, request: request, reason: err && err.message ? err.message : 'contact-capture-failed' };
    }
  }

  function buildExtraFields(config, prefill) {
    return (config.extras || []).map(function (field) {
      var value = prefill && prefill[field.id] ? String(prefill[field.id]) : '';
      if (field.type === 'select') {
        return '<div class="iv-contact-group">'
          + '<label for="ivContact_' + field.id + '">' + escapeHtml(field.label) + '</label>'
          + '<select id="ivContact_' + field.id + '" name="' + field.id + '">'
          + (field.options || []).map(function (opt) {
            var selected = value && value === opt.value ? ' selected' : '';
            return '<option value="' + escapeHtml(opt.value) + '"' + selected + '>' + escapeHtml(opt.label) + '</option>';
          }).join('')
          + '</select></div>';
      }
      return '<div class="iv-contact-group">'
        + '<label for="ivContact_' + field.id + '">' + escapeHtml(field.label) + '</label>'
        + '<input id="ivContact_' + field.id + '" name="' + field.id + '" type="text" value="' + escapeHtml(value || (field.id === 'page_url' ? location.href : '')) + '" placeholder="' + escapeHtml(field.placeholder || '') + '">'
        + '</div>';
    }).join('');
  }

  function openContactModal(options) {
    ensureContactModal();
    var opts = options || {};
    var type = String(opts.type || 'general').trim().toLowerCase();
    var config = getContactConfig(type);
    var modal = document.getElementById('ivContactModal');
    var form = document.getElementById('ivContactForm');
    var extrasWrap = document.getElementById('ivContactExtras');
    var status = document.getElementById('ivContactStatus');
    var submit = document.getElementById('ivContactSubmit');
    var secondary = document.getElementById('ivContactSecondary');

    document.getElementById('ivContactEyebrow').textContent = config.eyebrow;
    document.getElementById('ivContactTitle').textContent = config.title;
    document.getElementById('ivContactCopy').textContent = opts.copy || ('This request will be routed to ' + config.senderLabel + '.');
    document.getElementById('ivContactSubjectLabel').textContent = config.subjectLabel;
    document.getElementById('ivContactMessageLabel').textContent = config.messageLabel;
    document.getElementById('ivContactSubject').placeholder = opts.subjectPlaceholder || 'What is this about?';
    document.getElementById('ivContactMessage').placeholder = config.messagePlaceholder;
    document.getElementById('ivContactSubject').value = opts.subject || '';
    document.getElementById('ivContactMessage').value = opts.message || '';
    document.getElementById('ivContactName').value = opts.name || '';
    document.getElementById('ivContactEmail').value = opts.email || '';
    extrasWrap.innerHTML = buildExtraFields(config, opts.prefill || {});
    secondary.textContent = 'This request will be routed to ' + config.senderLabel + '.';
    status.className = 'iv-contact-status';
    status.textContent = '';
    submit.textContent = opts.submitLabel || 'Send request';

    form.onsubmit = async function (event) {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Sending...';
      var fd = new FormData(form);
      var payload = {
        category: type,
        route_to: config.route,
        name: fd.get('name'),
        email: fd.get('email'),
        subject: fd.get('subject'),
        message: fd.get('message'),
        package: fd.get('package'),
        issue_type: fd.get('issue_type'),
        contact_method: fd.get('contact_method'),
        page_url: fd.get('page_url') || location.href,
        source_page: location.pathname,
        meta: { trigger: opts.trigger || 'modal', source: opts.source || location.pathname }
      };
      var result = await captureContactRequest(payload);
      submit.disabled = false;
      submit.textContent = opts.submitLabel || 'Send request';
      if (result.ok) {
        status.className = 'iv-contact-status on';
        status.textContent = 'Request received. We will route it to the right Atanda inbox.';
        form.reset();
        extrasWrap.innerHTML = buildExtraFields(config, opts.prefill || {});
        setTimeout(function () { modal.classList.remove('on'); }, 900);
      } else {
        var mailto = 'mailto:' + encodeURIComponent(config.recipient)
          + '?subject=' + encodeURIComponent(payload.subject || config.title)
          + '&body=' + encodeURIComponent((payload.message || '') + '\n\nName: ' + payload.name + '\nEmail: ' + payload.email);
        status.className = 'iv-contact-status on';
        status.style.color = '#c7374a';
        status.textContent = 'Structured save failed here, so we are falling back to your email app.';
        window.location.href = mailto;
      }
    };

    modal.classList.add('on');
  }

  function bindContactTriggers() {
    Array.prototype.slice.call(document.querySelectorAll('a[href^="mailto:"]')).forEach(function (link) {
      if (link.dataset.contactBound === '1') return;
      var href = String(link.getAttribute('href') || '').toLowerCase();
      var type = href.indexOf('sessions@atanda.site') !== -1 ? 'sessions'
        : href.indexOf('support@atanda.site') !== -1 ? 'support'
        : 'general';
      link.dataset.contactBound = '1';
      link.addEventListener('click', function (event) {
        event.preventDefault();
        openContactModal({
          type: type,
          trigger: 'mailto-link',
          source: location.pathname,
          subject: link.dataset.subject || '',
          prefill: {
            package: link.dataset.package || '',
            issue_type: link.dataset.issueType || '',
            page_url: location.href
          }
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindContactTriggers);
  } else {
    bindContactTriggers();
  }

  window.ivGetSupabaseCreds = getCreds;
  window.ivCaptureSubscriber = captureSubscriber;
  window.ivCaptureContactRequest = captureContactRequest;
  window.ivOpenContactModal = openContactModal;
  window.ivGetPostViews = getPostViews;
  window.ivGetPostView = getPostView;
  window.ivGetAnalyticsSnapshot = getAnalyticsSnapshot;
  window.ivRecordPostView = recordPostView;
})();
