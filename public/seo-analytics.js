/* global document, navigator, window */
/* Consent-gated analytics for the server-rendered SEO pages. */
(function () {
  'use strict';
  var key = document.currentScript && document.currentScript.getAttribute('data-key');
  var host =
    (document.currentScript && document.currentScript.getAttribute('data-host')) ||
    'https://eu.i.posthog.com';
  var consentKey = 'open-keychain.analytics-consent';
  var script = document.currentScript;
  var body = document.body;
  var locale = document.documentElement.lang || 'en';
  var pageType = script && script.getAttribute('data-page-type');
  var pageId = script && script.getAttribute('data-page-id');
  var spaShell = script && script.getAttribute('data-spa') === 'true';
  var campaignSource = null;
  try {
    var requestedSource = new window.URL(window.location.href).searchParams.get('source');
    if (['github', 'maker-directory', 'community'].indexOf(requestedSource) !== -1)
      campaignSource = requestedSource;
  } catch {
    /* URL parsing is best effort; never block the page. */
  }
  var labels =
    {
      en: [
        'Analytics consent',
        'Allow anonymous analytics to help improve Open Keychain?',
        'Allow analytics',
        'No thanks',
      ],
      ru: [
        'Согласие на аналитику',
        'Разрешить анонимную аналитику, чтобы улучшить Open Keychain?',
        'Разрешить аналитику',
        'Нет, спасибо',
      ],
      uk: [
        'Згода на аналітику',
        'Дозволити анонімну аналітику, щоб покращити Open Keychain?',
        'Дозволити аналітику',
        'Ні, дякую',
      ],
    }[locale] || null;

  function payload(event, properties) {
    var clean = {};
    Object.keys(properties || {}).forEach(function (name) {
      if (
        (name === 'page_type' || name === 'page_id' || name === 'locale' || name === 'cta') &&
        typeof properties[name] === 'string' &&
        properties[name].length <= 64
      )
        clean[name] = properties[name];
    });
    clean.page_type = pageType;
    clean.page_id = pageId;
    clean.locale = locale;
    if (campaignSource) clean.source = campaignSource;
    return { api_key: key, event: event, distinct_id: 'seo-static-page', properties: clean };
  }

  function track(event, properties) {
    var accepted = false;
    try {
      accepted = window.localStorage.getItem(consentKey) === 'accepted';
    } catch {
      /* localStorage may be unavailable in private browsing. */
    }
    if (!key || !accepted) return;
    try {
      var url = host.replace(/\/$/, '') + '/capture/';
      var data = JSON.stringify(payload(event, properties));
      if (navigator.sendBeacon) navigator.sendBeacon(url, data);
      else if (window.fetch)
        void window.fetch(url, {
          method: 'POST',
          body: data,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
        });
    } catch {
      /* Analytics must never affect page navigation. */
    }
  }

  function setConsent(value) {
    try {
      window.localStorage.setItem(consentKey, value);
    } catch {
      return;
    }
    var banner = document.querySelector('[data-analytics-consent]');
    if (banner) banner.remove();
    if (value === 'accepted') track('seo_page_view', {});
  }

  var current = null;
  try {
    current = window.localStorage.getItem(consentKey);
  } catch {
    /* localStorage may be unavailable in private browsing. */
  }
  if (current === 'accepted') track('seo_page_view', {});
  if (!spaShell && current !== 'accepted' && current !== 'declined') {
    var banner = document.createElement('aside');
    banner.dataset.analyticsConsent = 'true';
    banner.setAttribute('role', 'region');
    if (!labels) return;
    banner.setAttribute('aria-label', labels[0]);
    banner.innerHTML =
      '<p>' +
      labels[1] +
      '</p>' +
      '<button type="button" data-analytics-accept>' +
      labels[2] +
      '</button>' +
      '<button type="button" data-analytics-decline>' +
      labels[3] +
      '</button>';
    body.appendChild(banner);
    banner.querySelector('[data-analytics-accept]').addEventListener('click', function () {
      setConsent('accepted');
    });
    banner.querySelector('[data-analytics-decline]').addEventListener('click', function () {
      setConsent('declined');
    });
  }
  document.querySelectorAll('a[data-analytics-event]').forEach(function (link) {
    link.addEventListener('click', function () {
      track(link.getAttribute('data-analytics-event'), {
        cta: link.getAttribute('data-analytics-cta') || 'create',
      });
    });
  });
})();
