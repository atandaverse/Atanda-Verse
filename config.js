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

  window.ivGetSupabaseCreds = getCreds;
  window.ivCaptureSubscriber = captureSubscriber;
  window.ivGetPostViews = getPostViews;
  window.ivGetPostView = getPostView;
  window.ivGetAnalyticsSnapshot = getAnalyticsSnapshot;
  window.ivRecordPostView = recordPostView;
})();
