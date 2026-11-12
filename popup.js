// AI Detector popup v1.4.0 — bilingual (English default, Persian toggle),
// binary verdict only, no numbers shown anywhere in the UI.
// Dark mode: toggle button next to the EN/FA switch, saved preference,
// falls back to the OS preference when nothing is saved.
(function () {
  'use strict';

  var STRINGS = {
    en: {
      dir: 'ltr',
      subtitle: 'AI content check',
      loading: 'Checking this page…',
      verdictRed: 'This site uses AI',
      verdictGreen: "This site doesn't use AI",
      verdictShort: 'Not enough text to check.',
      explainRed: function (cat) { return 'Most signs were found in the ' + cat + '.'; },
      explainGreen: 'No clear signs of AI content were found.',
      explainShort: 'This page needs more content for a reliable check.',
      categories: { text: 'Text', images: 'Images', code: 'Code' },
      statusFound: 'AI signs found',
      statusClean: 'No signs found',
      statusAbsent: 'Not found',
      statusShort: 'Too short to check',
      lowConfidence: 'low confidence',
      rescan: 'Check again',
      toDark: 'Dark mode',
      toLight: 'Light mode',
      errPage: "This page can't be checked.",
      errScan: "The check didn't run. Refresh the page and try again.",
      footer: "Detection is based on signals and isn't certain. All processing happens in your browser — nothing is stored or sent."
    },
    fa: {
      dir: 'rtl',
      subtitle: 'تشخیص محتوای AI',
      loading: 'در حال بررسی صفحه…',
      verdictRed: 'این سایت از AI استفاده می‌کنه',
      verdictGreen: 'این سایت از AI استفاده نمی‌کنه',
      verdictShort: 'متن کافی برای بررسی پیدا نشد.',
      explainRed: function (cat) { return 'بیشترین نشانه‌ها در ' + cat + ' صفحه بود.'; },
      explainGreen: 'نشانه‌ی مشخصی از محتوای AI پیدا نشد.',
      explainShort: 'برای تشخیص دقیق‌تر، صفحه باید محتوای بیشتری داشته باشه.',
      categories: { text: 'متن', images: 'عکس', code: 'کد' },
      statusFound: 'نشانه‌های AI پیدا شد',
      statusClean: 'نشانه‌ای پیدا نشد',
      statusAbsent: 'پیدا نشد',
      statusShort: 'خیلی کوتاه برای بررسی',
      lowConfidence: 'اعتماد پایین',
      rescan: 'بررسی دوباره',
      toDark: 'حالت تیره',
      toLight: 'حالت روشن',
      errPage: 'روی این صفحه نمی‌شه بررسی انجام داد.',
      errScan: 'بررسی انجام نشد. صفحه رو رفرش کن و دوباره امتحان کن.',
      footer: 'تشخیص بر اساس نشانه‌هاست و قطعی نیست. همه‌ی پردازش‌ها توی مرورگر خودت انجام می‌شه و هیچ محتوایی ذخیره یا ارسال نمی‌شه.'
    }
  };

  var ORDER = ['text', 'images', 'code'];

  // Static SVG constants only — never mixed with page data.
  var VERDICT_ICONS = {
    red: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    green: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    grey: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
  };
  var CAT_ICONS = {
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
    images: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>'
  };
  var PILL_ICONS = {
    red: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    green: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    neutral: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"></line></svg>'
  };

  var THEME_ICONS = {
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
  };

  var UI = {
    subtitle: document.getElementById('subtitle'),
    loading: document.getElementById('loading-view'),
    loadingText: document.getElementById('loading-text'),
    error: document.getElementById('error-view'),
    errorMsg: document.getElementById('error-msg'),
    result: document.getElementById('result-view'),
    verdictCard: document.getElementById('verdict-card'),
    verdictBadge: document.getElementById('verdict-icon-badge'),
    verdictText: document.getElementById('verdict-text'),
    explainText: document.getElementById('explain-text'),
    categoryList: document.getElementById('category-list'),
    rescanBtn: document.getElementById('rescan-btn'),
    retryBtn: document.getElementById('retry-btn'),
    footer: document.getElementById('footer'),
    langEn: document.getElementById('lang-en'),
    langFa: document.getElementById('lang-fa'),
    themeToggle: document.getElementById('theme-toggle')
  };

  var lang = 'en';
  var theme = 'light';
  var lastResult = null;
  var lastErrorKey = null;

  function t() { return STRINGS[lang]; }

  function switchView(viewName) {
    [UI.loading, UI.error, UI.result].forEach(function (v) { v.classList.remove('active'); });
    UI[viewName].classList.add('active');
  }

  function applyStaticTexts() {
    var s = t();
    document.documentElement.lang = lang;
    document.documentElement.dir = s.dir;
    UI.subtitle.textContent = s.subtitle;
    UI.loadingText.textContent = s.loading;
    UI.rescanBtn.textContent = s.rescan;
    UI.retryBtn.textContent = s.rescan;
    UI.footer.textContent = s.footer;
    UI.langEn.classList.toggle('active', lang === 'en');
    UI.langFa.classList.toggle('active', lang === 'fa');
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    var dark = theme === 'dark';
    UI.themeToggle.innerHTML = dark ? THEME_ICONS.sun : THEME_ICONS.moon;
    UI.themeToggle.title = dark ? t().toLight : t().toDark;
  }

  function saveTheme() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ theme: theme });
      }
    } catch (e) { /* storage unavailable — preference just won't persist */ }
  }

  function setTheme(next) {
    if (next !== 'light' && next !== 'dark') return;
    if (next === theme) return;
    theme = next;
    applyTheme();
    saveTheme();
  }

  function systemPrefersDark() {
    try {
      return !!(typeof window !== 'undefined' && window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) { return false; }
  }

  function saveLang() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ lang: lang });
      }
    } catch (e) { /* storage unavailable — preference just won't persist */ }
  }

  function loadPrefs() {
    // OS preference is the default; a saved choice wins over it.
    if (systemPrefersDark()) theme = 'dark';
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return chrome.storage.local.get(['lang', 'theme']).then(function (res) {
          if (res && (res.lang === 'en' || res.lang === 'fa')) lang = res.lang;
          if (res && (res.theme === 'light' || res.theme === 'dark')) theme = res.theme;
        }).catch(function () { /* keep defaults */ });
      }
    } catch (e) { /* keep defaults */ }
    return Promise.resolve();
  }

  function setLang(next) {
    if (next !== 'en' && next !== 'fa') return;
    if (next === lang) return;
    lang = next;
    applyStaticTexts();
    if (lastResult) render(lastResult);
    else if (lastErrorKey) showError(lastErrorKey);
    saveLang();
  }

  function makePill(kind, text) {
    var pill = document.createElement('span');
    pill.className = 'pill pill-' + kind;
    var icon = document.createElement('span');
    icon.innerHTML = PILL_ICONS[kind];
    icon.style.display = 'inline-flex';
    var label = document.createElement('span');
    label.textContent = text;
    pill.appendChild(icon);
    pill.appendChild(label);
    return pill;
  }

  function render(data) {
    lastResult = data;
    lastErrorKey = null;
    var s = t();
    UI.categoryList.innerHTML = '';

    if (data.band === 'too-short') {
      UI.verdictCard.className = 'verdict-card grey';
      UI.verdictBadge.innerHTML = VERDICT_ICONS.grey;
      UI.verdictText.textContent = s.verdictShort;
      UI.explainText.textContent = s.explainShort;
    } else {
      var isRed = data.band === 'red';
      UI.verdictCard.className = 'verdict-card ' + data.band;
      UI.verdictBadge.innerHTML = isRed ? VERDICT_ICONS.red : VERDICT_ICONS.green;
      UI.verdictText.textContent = isRed ? s.verdictRed : s.verdictGreen;

      // Which present category carried the most signals (internal scores only).
      var top = null;
      ORDER.forEach(function (k) {
        if (data.categories[k].present) {
          if (!top || data.categories[k].score > data.categories[top].score) top = k;
        }
      });
      UI.explainText.textContent = (isRed && top)
        ? s.explainRed(s.categories[top])
        : s.explainGreen;
    }

    ORDER.forEach(function (key) {
      var cat = data.categories[key];
      var row = document.createElement('div');
      row.className = 'cat-row';

      var box = document.createElement('div');
      box.className = 'cat-icon-box cat-' + key;
      box.innerHTML = CAT_ICONS[key];

      var label = document.createElement('span');
      label.className = 'cat-label';
      label.textContent = s.categories[key];

      var kind, text;
      if (!cat.present && cat.band === 'too-short') {
        kind = 'neutral'; text = s.statusShort;
      } else if (!cat.present) {
        kind = 'neutral'; text = s.statusAbsent;
      } else if (cat.band === 'red') {
        kind = 'red'; text = s.statusFound;
      } else {
        kind = 'green'; text = s.statusClean;
      }
      if (key === 'code' && cat.present) text += ' · ' + s.lowConfidence;

      row.appendChild(box);
      row.appendChild(label);
      row.appendChild(makePill(kind, text));
      UI.categoryList.appendChild(row);
    });

    switchView('result');
  }

  function showError(key) {
    lastErrorKey = key;
    lastResult = null;
    UI.errorMsg.textContent = t()[key];
    switchView('error');
  }

  async function scan() {
    switchView('loading');
    try {
      var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      var tab = tabs && tabs[0];
      if (!tab || !tab.id || /^(chrome|about|chrome-extension):/.test(tab.url || '')) {
        throw new Error('errPage');
      }
      var response = await new Promise(function (resolve, reject) {
        chrome.tabs.sendMessage(tab.id, { type: 'SCORE_PAGE' }, function (res) {
          if (chrome.runtime.lastError) reject(new Error('errScan'));
          else resolve(res);
        });
      });
      if (response && response.ok) {
        render(response.result);
      } else {
        throw new Error('errScan');
      }
    } catch (err) {
      showError(err.message === 'errPage' ? 'errPage' : 'errScan');
    }
  }

  UI.langEn.addEventListener('click', function () { setLang('en'); });
  UI.langFa.addEventListener('click', function () { setLang('fa'); });
  UI.themeToggle.addEventListener('click', function () { setTheme(theme === 'dark' ? 'light' : 'dark'); });
  UI.rescanBtn.addEventListener('click', scan);
  UI.retryBtn.addEventListener('click', scan);
  document.addEventListener('DOMContentLoaded', function () {
    loadPrefs().then(function () {
      applyStaticTexts();
      scan();
    });
  });
})();
