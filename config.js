// ATANDA VERSE - SHARED CONFIG
// Single source of truth for Supabase credentials.
// All pages load this before their own scripts.

(function () {
  var URL_KEY = 'iv_sb_url';
  var KEY_KEY = 'iv_sb_key';
  var SKIP_KEY = 'iv_setup_skip';
  var DEFAULT_SUPABASE_URL = 'https://lrgpegfrewlqdqlunrml.supabase.co';
  var DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZ3BlZ2ZyZXdscWRxbHVucm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjgzMDIsImV4cCI6MjA4OTYwNDMwMn0.JyBdLFV7ko8aEYvlZ7a05xn6XMNsYY0COqMmGOm3RR0';

  function cleanUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function getDefaultCreds() {
    var url = cleanUrl(DEFAULT_SUPABASE_URL);
    var key = String(DEFAULT_SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) return null;
    return { url: url, key: key };
  }

  function rememberCreds(url, key, options) {
    var clean = cleanUrl(url);
    var nextKey = String(key || '').trim();
    if (!clean || !nextKey) return false;
    localStorage.setItem(URL_KEY, clean);
    localStorage.setItem(KEY_KEY, nextKey);
    if (!options || options.skipSetup !== false) {
      localStorage.setItem(SKIP_KEY, '1');
    }
    return true;
  }

  var savedUrl = cleanUrl(localStorage.getItem(URL_KEY));
  var savedKey = String(localStorage.getItem(KEY_KEY) || '').trim();
  var defaultCreds = getDefaultCreds();

  if ((!savedUrl || !savedKey) && defaultCreds) {
    rememberCreds(defaultCreds.url, defaultCreds.key, { skipSetup: true });
    savedUrl = cleanUrl(localStorage.getItem(URL_KEY));
    savedKey = String(localStorage.getItem(KEY_KEY) || '').trim();
  }

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

  function shouldSendWelcomeGuide(payload, source, tags) {
    if (payload && payload.sendGuide === false) return false;
    if (payload && payload.sendGuide === true) return true;
    var haystack = [source, tags].join(',').toLowerCase();
    return /newsletter|clarity-guide|registration|sessions|vault-access|contact-opt-in/.test(haystack);
  }

  var WELCOME_EVENT_SOURCE = 'welcome-guide';

  function welcomeLocalKey(email) {
    return 'iv_welcome_sent_' + hashString(normalizeEmail(email));
  }

  async function hasSubscriberEvent(email, source) {
    var rows = await sbFetch('subscriber_events?select=id&subscriber_email=eq.' + encodeURIComponent(email) + '&source=eq.' + encodeURIComponent(source) + '&limit=1');
    return Array.isArray(rows) && rows.length > 0;
  }

  async function recordSubscriberEvent(email, source, name, tags, meta) {
    var now = new Date().toISOString();
    return sbFetch('subscriber_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: 'subevt-' + Date.now() + '-' + hashString(email + '-' + source + '-' + now),
        subscriber_email: email,
        source: source,
        tag_snapshot: tags,
        name_snapshot: name || '',
        meta: JSON.stringify(meta || {}),
        created_at: now
      })
    });
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
    var text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); }
    catch (_err) { return text; }
  }

  window.ivSupabaseDefaults = defaultCreds;
  window.ivGetSupabaseCreds = getCreds;
  window.ivRememberSupabaseCreds = rememberCreds;

  async function getPublicSettings() {
    var cached = {};
    try {
      cached = JSON.parse(localStorage.getItem('iv_settings') || '{}') || {};
    } catch (_err) {}

    try {
      var rows = await sbFetch('settings?select=key,value');
      var settings = {};
      if (Array.isArray(rows)) {
        rows.forEach(function (row) {
          try { settings[row.key] = JSON.parse(row.value); }
          catch (_err) { settings[row.key] = row.value; }
        });
        var merged = Object.assign({}, cached, settings);
        try {
          var publicEvents = await getPublicEventsCampaigns();
          merged.eventsCampaigns = publicEvents;
          var featured = getFeaturedEventCampaign(publicEvents);
          if (featured) {
            merged.publicFeaturedCampaign = featured;
            merged.publicCampaign = eventCampaignToPublicCampaign(featured);
            if (featured.has_countdown && featured.end_date) {
              merged.countdownTarget = featured.end_date;
              merged.countdownLabel = featured.countdown_label || featured.title || merged.countdownLabel;
            }
          }
        } catch (eventErr) {
          console.warn('Public events/campaigns fetch failed', eventErr);
        }
        localStorage.setItem('iv_settings', JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Public settings fetch failed', err);
    }

    return cached;
  }

  window.ivGetPublicSettings = getPublicSettings;

  var DEFAULT_EVENTS_CAMPAIGNS = [
    {
      id: 'free-session-launch',
      title: 'Free Single Clarity Session',
      slug: 'free-single-clarity-session',
      kind: 'both',
      status: 'published',
      eyebrow: 'Launch Campaign',
      summary: 'A focused single clarity session for people ready to move from mental fog to direction.',
      details: 'The launch campaign gives new visitors a simple first step into the Atanda Verse clarity path. Confirmation happens after registration.',
      image_url: 'social-preview.png',
      location: 'Online',
      event_date: '',
      end_date: '',
      has_countdown: true,
      countdown_label: 'Free Session Ends In',
      cta_label: 'Book Session',
      cta_url: 'event-register.html?event=free-single-clarity-session',
      funnel_url: 'event-register.html?event=free-single-clarity-session',
      featured: true,
      sort_order: 10
    },
    {
      id: 'pause-001-placeholder',
      title: 'Pause 001',
      slug: 'pause-001',
      kind: 'event',
      status: 'draft',
      eyebrow: 'Coming Event',
      summary: 'A guided pause for reflection, clarity, and next-step language.',
      details: 'Placeholder event copy. Replace the image, date, and full details from Workspace when the event is ready.',
      image_url: 'social-preview.png',
      location: 'Online',
      event_date: '',
      end_date: '',
      has_countdown: false,
      countdown_label: '',
      cta_label: 'View Event',
      cta_url: 'event-register.html?event=pause-001',
      funnel_url: 'event-register.html?event=pause-001',
      featured: false,
      sort_order: 20
    }
  ];

  function normalizeEventCampaign(row) {
    row = row || {};
    var slug = String(row.slug || row.id || '').trim() || ('event-' + Date.now());
    return {
      id: String(row.id || slug),
      title: String(row.title || 'Untitled event'),
      slug: slug,
      kind: String(row.kind || 'campaign'),
      status: String(row.status || 'draft'),
      eyebrow: String(row.eyebrow || ''),
      summary: String(row.summary || ''),
      details: String(row.details || ''),
      image_url: String(row.image_url || ''),
      location: String(row.location || ''),
      event_date: row.event_date || '',
      end_date: row.end_date || '',
      has_countdown: !!row.has_countdown,
      countdown_label: String(row.countdown_label || ''),
      cta_label: String(row.cta_label || 'Learn More'),
      cta_url: String(row.cta_url || ''),
      funnel_url: String(row.funnel_url || ''),
      featured: !!row.featured,
      sort_order: Number(row.sort_order) || 0
    };
  }

  async function getPublicEventsCampaigns() {
    var cached = [];
    try { cached = JSON.parse(localStorage.getItem('iv_events_campaigns') || '[]') || []; }
    catch (_err) {}
    try {
      var rows = await sbFetch('events_campaigns?select=*&status=eq.published&order=sort_order.asc,created_at.desc');
      if (Array.isArray(rows)) {
        var items = rows.map(normalizeEventCampaign);
        localStorage.setItem('iv_events_campaigns', JSON.stringify(items));
        return items;
      }
    } catch (err) {
      console.warn('Events/campaigns fetch failed', err);
    }
    return cached.length ? cached : DEFAULT_EVENTS_CAMPAIGNS.filter(function (item) { return item.status === 'published'; });
  }

  function getFeaturedEventCampaign(items) {
    var list = Array.isArray(items) ? items : [];
    return list.find(function (item) { return item && item.status === 'published' && item.featured; }) || null;
  }

  function eventCampaignToPublicCampaign(item) {
    if (!item) return {};
    var label = item.cta_label || 'Learn More';
    var detail = item.eyebrow || item.title || 'Featured';
    var url = item.funnel_url || item.cta_url || ('event-register.html?event=' + encodeURIComponent(item.slug));
    return {
      enabled: true,
      type: item.kind || 'campaign',
      activeBadge: item.eyebrow || item.title,
      expiredBadge: item.eyebrow || item.title,
      activeNavCta: label,
      expiredNavCta: 'Register',
      activeStickyLabel: label,
      expiredStickyLabel: 'Book a Session',
      activeStickyDetail: detail,
      expiredStickyDetail: 'Clarity support',
      activeSingleCta: label,
      expiredSingleCta: 'Reserve Session',
      ctaUrl: url,
      itemId: item.id,
      slug: item.slug
    };
  }

  window.ivDefaultEventsCampaigns = DEFAULT_EVENTS_CAMPAIGNS;
  window.ivNormalizeEventCampaign = normalizeEventCampaign;
  window.ivGetPublicEventsCampaigns = getPublicEventsCampaigns;
  window.ivGetFeaturedEventCampaign = getFeaturedEventCampaign;

  async function getPublicFaq(defaults) {
    var fallback = Array.isArray(defaults) ? defaults : [];
    var cached = [];
    try {
      cached = JSON.parse(localStorage.getItem('iv_faq') || '[]') || [];
    } catch (_err) {}

    function transformFaqForLaunch(items) {
      var launch = getLaunchState();
      if (launch.active) return items;
      return (items || []).map(function (item) {
        if (item.id === 'faq-d6') {
          item.question = 'Are the sessions free?';
          item.answer = 'Single clarity sessions, three-session packages, weekly group access, and monthly intensives are guided offers confirmed after registration.';
        }
        if (item.id === 'faq-d7') {
          item.question = 'How do current session offers work?';
          item.answer = 'Choose the session path that fits your need. Details, next steps, and any payment information are confirmed after registration.';
        }
        if (item.id === 'faq-d9') item.answer = 'If a session does not add value, tell us honestly. The goal is genuine clarity, not just a completed session.';
        return item;
      });
    }

    try {
      var rows = await sbFetch('faq?select=*&order=category.asc,sort_order.asc');
      if (Array.isArray(rows) && rows.length) {
        var items = rows.map(function (row) {
          return {
            id: row.id,
            question: row.question,
            answer: row.answer,
            category: row.category || 'sessions',
            order: Number(row.sort_order) || 0
          };
        });
        localStorage.setItem('iv_faq', JSON.stringify(items));
        return transformFaqForLaunch(items);
      }
    } catch (err) {
      console.warn('Public FAQ fetch failed', err);
    }

    return transformFaqForLaunch(cached.length ? cached : fallback);
  }

  window.ivGetPublicFaq = getPublicFaq;

  function getLaunchState(settings) {
    var source = settings;
    if (!source) {
      try { source = JSON.parse(localStorage.getItem('iv_settings') || '{}') || {}; }
      catch (_err) { source = {}; }
    }
    var featured = source && source.publicFeaturedCampaign ? source.publicFeaturedCampaign : null;
    var countdownSource = featured && featured.has_countdown && featured.end_date ? featured.end_date : (source && source.countdownTarget);
    var target = countdownSource ? new Date(countdownSource).getTime() : NaN;
    var hasTarget = Number.isFinite(target);
    var expired = hasTarget ? target <= Date.now() : false;
    var campaign = source && source.publicCampaign && typeof source.publicCampaign === 'object' ? source.publicCampaign : {};
    var campaignEnabled = campaign.enabled !== false;
    return {
      target: hasTarget ? target : null,
      expired: expired,
      active: hasTarget && !expired && campaignEnabled,
      hasCampaign: hasTarget && campaignEnabled,
      featuredCampaign: featured || null,
      settings: source || {}
    };
  }

  var DEFAULT_PUBLIC_CAMPAIGN = {
    enabled: true,
    type: 'free-session',
    activeBadge: 'Free Single Session During Launch',
    expiredBadge: 'Single Sessions Open',
    activeNavCta: 'Register',
    expiredNavCta: 'Register',
    activeStickyLabel: 'Book a Session',
    expiredStickyLabel: 'Book a Session',
    activeStickyDetail: 'Single launch slot',
    expiredStickyDetail: 'Clarity support',
    activeSingleCta: 'Book a Session',
    expiredSingleCta: 'Reserve Session',
    activeRegisterButton: 'Reserve my session',
    expiredRegisterButton: 'Reserve my session',
    expiredRegisterMicrocopy: 'Single sessions and guided plans are reviewed before confirmation. Session questions belong at sessions@atanda.site.'
  };

  function getPublicCampaign(settings) {
    var source = settings || {};
    var custom = source.publicCampaign && typeof source.publicCampaign === 'object' ? source.publicCampaign : {};
    var campaign = Object.assign({}, DEFAULT_PUBLIC_CAMPAIGN, custom);
    if (/campaign\s*ended|launch\s*offer\s*ended/i.test(String(campaign.expiredStickyDetail || ''))) {
      campaign.expiredStickyDetail = DEFAULT_PUBLIC_CAMPAIGN.expiredStickyDetail;
    }
    if (/launch\s*offer\s*ended/i.test(String(campaign.expiredRegisterMicrocopy || ''))) {
      campaign.expiredRegisterMicrocopy = DEFAULT_PUBLIC_CAMPAIGN.expiredRegisterMicrocopy;
    }
    return campaign;
  }

  function rememberOriginal(el) {
    if (!el || el.dataset.ivCampaignOriginal === '1') return;
    el.dataset.ivCampaignOriginal = '1';
    el.dataset.ivOriginalText = el.textContent || '';
    el.dataset.ivOriginalHtml = el.innerHTML || '';
  }

  function setText(selector, text, restore) {
    document.querySelectorAll(selector).forEach(function (el) {
      rememberOriginal(el);
      el.textContent = restore ? (el.dataset.ivOriginalText || '') : text;
    });
  }

  function setHtml(selector, html, restore) {
    document.querySelectorAll(selector).forEach(function (el) {
      rememberOriginal(el);
      el.innerHTML = restore ? (el.dataset.ivOriginalHtml || '') : html;
    });
  }

  var DEFAULT_SESSION_PRICING = {
    single: {
      label: 'Single Session',
      badge: '1:1 CLARITY',
      usd: '$15',
      ngn: '',
      note: 'single clarity session',
      paidUsd: '$15',
      expiredBadge: '1:1 CLARITY',
      expiredNote: 'single clarity session',
      free: false
    },
    'three-pack': {
      label: 'Three Session Package',
      badge: 'MOST POPULAR',
      usd: '$48',
      ngn: 'N60,000',
      note: 'paid package',
      free: false
    },
    group: {
      label: 'Weekly Group Sessions',
      badge: 'GROUP PATH',
      usd: '$36',
      ngn: 'N45,000',
      note: 'paid group access',
      free: false
    },
    intensive: {
      label: 'Monthly Intensive',
      badge: 'INTENSIVE',
      usd: '$180',
      ngn: 'N225,000',
      note: 'paid intensive',
      free: false
    }
  };

  function normalizePricing(raw, settings) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var launch = getLaunchState(settings);
    var pricing = {};
    var staleLaunchText = /free\s*start|launch|campaign|ended/i;
    Object.keys(DEFAULT_SESSION_PRICING).forEach(function (key) {
      pricing[key] = Object.assign({}, DEFAULT_SESSION_PRICING[key], source[key] || {});
      if (key === 'three-pack' && pricing[key].ngn === 'N60,000' && pricing[key].usd === '$40') pricing[key].usd = '$48';
      if (key === 'group' && pricing[key].ngn === 'N45,000' && pricing[key].usd === '$30') pricing[key].usd = '$36';
      if (key === 'intensive' && pricing[key].ngn === 'N225,000' && pricing[key].usd === '$150') pricing[key].usd = '$180';
      if (key === 'single' && launch.active) {
        pricing[key].free = true;
        pricing[key].badge = pricing[key].activeBadge || 'FREE START';
        pricing[key].usd = 'FREE';
        pricing[key].ngn = 'N0';
        pricing[key].note = pricing[key].activeNote || 'single launch session';
      } else if (key === 'single') {
        var staleCampaignBadge = staleLaunchText.test(String(pricing[key].expiredBadge || pricing[key].badge || ''));
        var staleCampaignUsd = staleLaunchText.test(String(pricing[key].expiredUsd || pricing[key].usd || ''));
        var staleCampaignNgn = /^n?0$/i.test(String(pricing[key].expiredNgn || pricing[key].ngn || '').replace(/\s+/g, ''));
        var staleCampaignNote = staleLaunchText.test(String(pricing[key].expiredNote || pricing[key].note || ''));
        pricing[key].free = false;
        pricing[key].badge = staleCampaignBadge ? '1:1 CLARITY' : (pricing[key].expiredBadge || pricing[key].badge || '1:1 CLARITY');
        pricing[key].usd = staleCampaignUsd ? (pricing[key].paidUsd || '$15') : (pricing[key].expiredUsd || pricing[key].paidUsd || pricing[key].usd || '$15');
        pricing[key].ngn = staleCampaignNgn ? (pricing[key].paidNgn || '') : (pricing[key].expiredNgn || pricing[key].paidNgn || '');
        pricing[key].note = staleCampaignNote ? 'single clarity session' : (pricing[key].expiredNote || 'single clarity session');
      } else {
        pricing[key].free = !!pricing[key].free;
      }
      pricing[key].price = pricing[key].free ? 'FREE' : [pricing[key].usd, pricing[key].ngn].filter(Boolean).join(' / ');
    });
    Object.keys(source).forEach(function (key) {
      if (pricing[key] || !source[key]) return;
      pricing[key] = Object.assign({
        label: key.replace(/-/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }),
        badge: 'CUSTOM',
        usd: '',
        ngn: '',
        note: 'custom offer',
        free: false
      }, source[key]);
      pricing[key].price = pricing[key].free ? 'FREE' : [pricing[key].usd, pricing[key].ngn].filter(Boolean).join(' / ');
    });
    return pricing;
  }

  async function getSessionPricing() {
    try {
      var settings = await getPublicSettings();
      return normalizePricing(settings && settings.sessionPricing, settings);
    } catch (_err) {
      return normalizePricing();
    }
  }

  function applyLaunchState(settings) {
    var launch = getLaunchState(settings);
    var campaign = getPublicCampaign(launch.settings);
    var active = !!launch.active;
    var inactive = !active;
    document.documentElement.setAttribute('data-launch-expired', launch.expired ? 'true' : 'false');
    document.documentElement.setAttribute('data-launch-active', active ? 'true' : 'false');
    document.documentElement.setAttribute('data-public-campaign', active ? (campaign.type || 'custom') : 'none');
    document.querySelectorAll('.countdown-timer').forEach(function (el) {
      el.hidden = inactive;
      el.setAttribute('aria-hidden', inactive ? 'true' : 'false');
    });
    document.querySelectorAll('.hero-badge').forEach(function (el) {
      el.hidden = inactive;
      el.setAttribute('aria-hidden', inactive ? 'true' : 'false');
    });
    if (campaign.enabled === false) {
      ['.nav-cta','.hero-badge','.sticky-cta-label','.sticky-cta-detail','[data-price-plan="single"] .cta-button','#registerMicrocopy'].forEach(function (selector) { setHtml(selector, '', true); });
      return launch;
    }
    var textMap = [
      ['.nav-cta', active ? campaign.activeNavCta : campaign.expiredNavCta],
      ['.hero-badge', active ? campaign.activeBadge : campaign.expiredBadge],
      ['.sticky-cta-label', active ? campaign.activeStickyLabel : campaign.expiredStickyLabel],
      ['.sticky-cta-detail', active ? campaign.activeStickyDetail : campaign.expiredStickyDetail],
      ['[data-price-plan="single"] .cta-button', active ? campaign.activeSingleCta : campaign.expiredSingleCta]
    ];
    textMap.forEach(function (pair) {
      setText(pair[0], pair[1], false);
    });
    var activeUrl = campaign && campaign.ctaUrl ? campaign.ctaUrl : '';
    if (active && activeUrl) {
      document.querySelectorAll('.sticky-cta,.nav-cta').forEach(function (el) {
        if (el && el.tagName && el.tagName.toLowerCase() === 'a') el.setAttribute('href', activeUrl);
      });
    }
    if (active) {
      setHtml('#registerMicrocopy', '', true);
    } else {
      setText('#registerMicrocopy', campaign.expiredRegisterMicrocopy, false);
    }
    document.querySelectorAll('[data-launch-copy]').forEach(function (el) {
      rememberOriginal(el);
      var next = active ? (el.getAttribute('data-launch-active-copy') || el.dataset.ivOriginalText) : el.getAttribute('data-launch-expired-copy');
      if (next) el.textContent = next;
    });
    document.querySelectorAll('[data-launch-html]').forEach(function (el) {
      rememberOriginal(el);
      var next = active ? (el.getAttribute('data-launch-active-html') || el.dataset.ivOriginalHtml) : el.getAttribute('data-launch-expired-html');
      if (next) el.innerHTML = next;
    });
    return launch;
  }

  function applySessionPricing(pricing, settings) {
    var data = normalizePricing(pricing, settings);
    var launch = getLaunchState(settings);
    document.querySelectorAll('[data-price-generated="true"]').forEach(function (el) { el.remove(); });
    Object.keys(data).forEach(function (key) {
      var item = data[key];
      document.querySelectorAll('[data-price-plan="' + key + '"]').forEach(function (card) {
        var badge = card.querySelector('[data-price-badge]');
        var title = card.querySelector('[data-price-title]');
        var current = card.querySelector('[data-price-current]');
        var naira = card.querySelector('[data-price-naira]');
        if (badge) badge.textContent = item.badge || DEFAULT_SESSION_PRICING[key].badge;
        if (title) title.textContent = item.label || DEFAULT_SESSION_PRICING[key].label;
        if (current) current.textContent = item.usd || '';
        if (naira) naira.textContent = (item.ngn || '') + (item.note ? ' \u00b7 ' + item.note : '');
      });
      document.querySelectorAll('option[data-price-option="' + key + '"]').forEach(function (opt) {
        opt.textContent = item.free ? item.label + ' (Free)' : item.label + ' (' + item.price + ')';
      });
      if (!DEFAULT_SESSION_PRICING[key]) {
        document.querySelectorAll('select#sessionType').forEach(function (sel) {
          if (!sel.querySelector('option[value="' + key + '"]')) {
            var opt = document.createElement('option');
            opt.value = key;
            opt.dataset.priceOption = key;
            opt.dataset.priceGenerated = 'true';
            opt.textContent = item.free ? item.label + ' (Free)' : item.label + ' (' + item.price + ')';
            sel.appendChild(opt);
          }
        });
        document.querySelectorAll('.pricing-grid').forEach(function (grid) {
          if (grid.querySelector('[data-price-plan="' + key + '"]')) return;
          var card = document.createElement('div');
          card.className = 'pricing-card iv-pop';
          card.dataset.pricePlan = key;
          card.dataset.priceGenerated = 'true';
          card.innerHTML = '<div class="pricing-badge" data-price-badge></div><h3 class="pricing-title" data-price-title></h3><div class="pricing-price"><span class="price-current" data-price-current></span><div class="price-naira" data-price-naira></div></div><ul class="pricing-features"><li>Custom Atanda Verse support offer</li><li>Details confirmed after registration</li></ul><a class="cta-button" href="register.html?session=' + encodeURIComponent(key) + '&label=' + encodeURIComponent(item.label || key) + '&source=sessions-pricing">Choose Offer</a>';
          grid.appendChild(card);
          card.querySelector('[data-price-badge]').textContent = item.badge || 'CUSTOM';
          card.querySelector('[data-price-title]').textContent = item.label || key;
          card.querySelector('[data-price-current]').textContent = item.usd || '';
          card.querySelector('[data-price-naira]').textContent = (item.ngn || '') + (item.note ? ' \u00b7 ' + item.note : '');
        });
      }
    });
    window.ivSessionPricing = data;
    window.ivLaunchState = launch;
    applyLaunchState(settings);
    return data;
  }

  async function syncSessionPricing() {
    var settings = await getPublicSettings();
    return applySessionPricing(settings && settings.sessionPricing, settings);
  }

  window.ivDefaultSessionPricing = DEFAULT_SESSION_PRICING;
  window.ivGetLaunchState = getLaunchState;
  window.ivGetPublicCampaign = getPublicCampaign;
  window.ivApplyLaunchState = applyLaunchState;
  window.ivGetSessionPricing = getSessionPricing;
  window.ivApplySessionPricing = applySessionPricing;
  window.ivSyncSessionPricing = syncSessionPricing;

  function refreshLaunchState() {
    getPublicSettings().then(applyLaunchState).catch(function () { applyLaunchState(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshLaunchState);
  else refreshLaunchState();
  setInterval(function () {
    syncSessionPricing().catch(function () { refreshLaunchState(); });
  }, 60000);

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

  function workspaceUrl(panel) {
    try { return new URL('workspace.html#' + encodeURIComponent(panel || 'dash'), location.href).href; }
    catch (_err) { return 'workspace.html#' + (panel || 'dash'); }
  }

  function adminRouteFor(eventType, payload) {
    var type = String(eventType || '').toLowerCase();
    var source = String((payload && payload.source) || '').toLowerCase();
    if (type.indexOf('vault') !== -1 || source.indexOf('vault') !== -1) return { panel: 'vault', label: 'Open vault requests' };
    if (type.indexOf('registration') !== -1 || source.indexOf('sessions') !== -1 || source.indexOf('register') !== -1) return { panel: 'registrations', label: 'Open registrations' };
    if (type.indexOf('subscriber') !== -1 || type.indexOf('newsletter') !== -1) return { panel: 'subscribers', label: 'Open subscribers' };
    if (type.indexOf('contact') !== -1 || source.indexOf('contact') !== -1) return { panel: 'dash', label: 'Open workspace' };
    if (type.indexOf('comment') !== -1) return { panel: 'comments', label: 'Open comments' };
    return { panel: 'dash', label: 'Open workspace' };
  }

  async function notifyAdmin(eventType, payload) {
    try {
      var route = adminRouteFor(eventType, payload || {});
      var adminUrl = workspaceUrl(route.panel);
      return await sbInvoke('send-admin-notification', {
        eventType: eventType,
        payload: Object.assign({}, payload || {}, {
          adminPanel: route.panel,
          adminUrl: adminUrl,
          adminLabel: route.label
        }),
        adminPanel: route.panel,
        adminUrl: adminUrl,
        adminLabel: route.label,
        pageUrl: location.href,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Admin notification function unavailable', err);
      return { ok: false, reason: err && err.message ? err.message : 'notify-failed' };
    }
  }

  async function captureSubscriber(payload) {
    var email = normalizeEmail(payload && payload.email);
    if (!email) return { ok: false, reason: 'missing-email' };
    var now = new Date().toISOString();
    var source = String((payload && payload.source) || 'site').trim().toLowerCase();
    var name = String((payload && payload.name) || '').trim();
    var tags = mergeTags((payload && payload.tags) || []);
    var subscriberId = 'sub-' + hashString(email);
    var subscriber = {
      id: subscriberId,
      email: email,
      name: name,
      source: source,
      tags: tags,
      subscribed_at: now
    };
    var existingSubscriber = false;

    try {
      try {
        var existingRows = await sbFetch('subscribers?select=id&email=eq.' + encodeURIComponent(email) + '&limit=1');
        existingSubscriber = Array.isArray(existingRows) && existingRows.length > 0;
      } catch (lookupErr) {
        console.warn('Subscriber dedupe lookup skipped', lookupErr);
      }
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
      await recordSubscriberEvent(email, source, name, tags, (payload && payload.meta) || {});
    } catch (err) {
      console.warn('Subscriber event capture skipped', err);
    }

    if (shouldSendWelcomeGuide(payload || {}, source, tags)) {
      try {
        var welcomeKey = welcomeLocalKey(email);
        var alreadyWelcomed = localStorage.getItem(welcomeKey) === '1';
        if (!alreadyWelcomed) {
          try {
            alreadyWelcomed = await hasSubscriberEvent(email, WELCOME_EVENT_SOURCE);
          } catch (lookupWelcomeErr) {
            console.warn('Subscriber welcome dedupe lookup skipped', lookupWelcomeErr);
          }
        }
        if (!alreadyWelcomed) {
          await sbInvoke('send-subscriber-welcome', {
            email: email,
            name: name,
            source: source,
            tags: tags
          });
          try {
            await recordSubscriberEvent(email, WELCOME_EVENT_SOURCE, name, tags, { originalSource: source });
          } catch (markErr) {
            console.warn('Subscriber welcome marker skipped', markErr);
          }
          localStorage.setItem(welcomeKey, '1');
        }
      } catch (welcomeErr) {
        console.warn('Subscriber welcome guide function unavailable', welcomeErr);
      }
    }

    if (!existingSubscriber && tags.indexOf('registration') === -1 && tags.indexOf('comment') === -1) {
      notifyAdmin('subscriber.created', {
        email: email,
        name: name,
        source: source,
        tags: tags
      });
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
    return true;
  }

  function markCountedView(postId) {
    var key = getViewThrottleKey(postId);
    localStorage.setItem(key, String(Date.now()));
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
      var context = getAnalyticsContext(id);
      var rpcRows = await sbFetch('rpc/increment_post_view', {
        method: 'POST',
        body: JSON.stringify({
          p_post_id: id,
          p_visitor_key: context.visitorKey,
          p_session_id: context.sessionId,
          p_path: context.path,
          p_href: context.href,
          p_referrer: context.referrer,
          p_user_agent: context.userAgent,
          p_language: context.language,
          p_viewport_width: context.viewport.width,
          p_viewport_height: context.viewport.height,
          p_screen_width: context.screen.width,
          p_screen_height: context.screen.height,
          p_timezone: context.timezone
        })
      });
      markCountedView(id);
      var rpcRow = Array.isArray(rpcRows) ? rpcRows[0] : null;
      return { ok: true, views: Number((rpcRow && rpcRow.views) || 0), source: 'database-rpc' };
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
      + '.iv-contact-optin{display:flex;gap:.55rem;align-items:flex-start;font-size:.82rem;line-height:1.55;color:#61708f;margin:.15rem 0 .2rem}'
      + '.iv-contact-optin input{width:auto;margin-top:.22rem;accent-color:#c7374a}'
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
      + '    <label class="iv-contact-optin"><input id="ivContactNewsletterOptIn" name="newsletter_opt_in" type="checkbox"> <span>Also send me Atanda Verse clarity letters and the free 5-Day Clarity Challenge access.</span></label>'
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
      if (fd.get('newsletter_opt_in') === 'on') {
        await captureSubscriber({
          email: payload.email,
          name: payload.name,
          source: 'contact-opt-in-' + type,
          tags: ['newsletter', 'contact-opt-in', type],
          sendGuide: true,
          meta: { contactRequestId: result && result.request ? result.request.id : '', route_to: config.route }
        });
      }
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
  window.ivNotifyAdmin = notifyAdmin;
  window.ivCaptureContactRequest = captureContactRequest;
  window.ivOpenContactModal = openContactModal;
  window.ivGetPostViews = getPostViews;
  window.ivGetPostView = getPostView;
  window.ivGetAnalyticsSnapshot = getAnalyticsSnapshot;
  window.ivRecordPostView = recordPostView;
})();
