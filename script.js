/* ==========================================================================
   Roman Vitanza for APSEA Vice President — site behaviour

   Vanilla JS, no dependencies, no globals. Every module bails out quietly
   if the elements it needs are not on the page, so the file is safe to load
   on any page of the site.

   Modules
     01. Utilities
     02. Header height sync
     03. Mobile navigation
     04. Anchor navigation (smooth scroll + focus management)
     05. Scroll observer (progress bar, stuck header, active nav state)
     06. Reveal on scroll
     07. Countdown to the next January 1
     08. Rotating candidate portrait
     09. Contact form (Netlify Forms, progressively enhanced)
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     01. UTILITIES
     ==================================================================== */

  var reducedMotionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  /** True when the visitor has asked the system to minimise motion. */
  function prefersReducedMotion() {
    return !!(reducedMotionQuery && reducedMotionQuery.matches);
  }

  /** Registers a callback for changes to the reduced-motion preference. */
  function onReducedMotionChange(callback) {
    if (!reducedMotionQuery) return;
    if (typeof reducedMotionQuery.addEventListener === 'function') {
      reducedMotionQuery.addEventListener('change', callback);
    } else if (typeof reducedMotionQuery.addListener === 'function') {
      reducedMotionQuery.addListener(callback); // Safari < 14
    }
  }

  /** querySelectorAll as a real array. */
  function selectAll(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  /** Runs a callback at most once per animation frame. */
  function throttleToFrame(callback) {
    var queued = false;
    return function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        callback();
      });
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  var supportsScrollBehavior =
    'scrollBehavior' in document.documentElement.style;

  /** Scrolls the window, honouring the reduced-motion preference. */
  function scrollWindowTo(top) {
    if (supportsScrollBehavior) {
      window.scrollTo({ top: top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    } else {
      window.scrollTo(0, top); // Older browsers: jump rather than misparse.
    }
  }

  /** Elements inside `container` that a keyboard can reach. */
  function focusableWithin(container) {
    return selectAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
        ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      container
    ).filter(function (element) {
      return element.offsetWidth > 0 || element.offsetHeight > 0 ||
        element === document.activeElement;
    });
  }

  var siteHeader = document.querySelector('[data-site-header]');

  /** Current sticky-header height, used for scroll offsets. */
  function headerHeight() {
    return siteHeader ? siteHeader.offsetHeight : 0;
  }


  /* ========================================================================
     02. HEADER HEIGHT SYNC
     Keeps --header-h matched to the real header so scroll offsets and the
     mobile menu panel line up exactly at every breakpoint.
     ==================================================================== */

  function initHeaderHeightSync() {
    if (!siteHeader) return;

    var sync = throttleToFrame(function () {
      document.documentElement.style.setProperty('--header-h', siteHeader.offsetHeight + 'px');
    });

    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    // Font swap can change header height after first paint.
    if (document.fonts && typeof document.fonts.ready === 'object') {
      document.fonts.ready.then(sync).catch(function () { /* no-op */ });
    }
  }


  /* ========================================================================
     03. MOBILE NAVIGATION
     ==================================================================== */

  var mobileNav = (function () {
    var toggle = document.querySelector('[data-nav-toggle]');
    var toggleLabel = document.querySelector('[data-nav-toggle-label]');
    var nav = document.querySelector('[data-primary-nav]');
    var scrim = document.querySelector('[data-nav-scrim]');
    var mobileQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 54rem)') : null;
    var isOpen = false;

    function isMobileLayout() {
      return !mobileQuery || mobileQuery.matches;
    }

    function open() {
      if (!toggle || !nav || isOpen) return;
      isOpen = true;
      nav.classList.add('is-open');
      document.body.classList.add('is-nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close navigation menu');
      if (toggleLabel) toggleLabel.textContent = 'Close';

      if (scrim) {
        scrim.hidden = false;
        // Next frame, so the opacity transition has a starting value.
        window.requestAnimationFrame(function () {
          scrim.classList.add('is-visible');
        });
      }

      var first = focusableWithin(nav)[0];
      if (first) first.focus();
    }

    function close(options) {
      if (!toggle || !nav || !isOpen) return;
      isOpen = false;
      nav.classList.remove('is-open');
      document.body.classList.remove('is-nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
      if (toggleLabel) toggleLabel.textContent = 'Menu';

      if (scrim) {
        scrim.classList.remove('is-visible');
        scrim.hidden = true;
      }

      if (options && options.restoreFocus) toggle.focus();
    }

    function toggleOpen() {
      if (isOpen) close({ restoreFocus: true });
      else open();
    }

    /** Keeps Tab inside the menu while it behaves as an overlay. */
    function trapFocus(event) {
      if (!isOpen || event.key !== 'Tab' || !nav || !toggle) return;

      var stops = [toggle].concat(focusableWithin(nav));
      if (!stops.length) return;

      var first = stops[0];
      var last = stops[stops.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function init() {
      if (!toggle || !nav) return;

      toggle.addEventListener('click', toggleOpen);

      if (scrim) {
        scrim.addEventListener('click', function () {
          close({ restoreFocus: true });
        });
      }

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && isOpen) {
          close({ restoreFocus: true });
        } else {
          trapFocus(event);
        }
      });

      // Growing past the mobile breakpoint should never leave a stuck overlay.
      var handleBreakpoint = function () {
        if (!isMobileLayout()) close();
      };

      if (mobileQuery) {
        if (typeof mobileQuery.addEventListener === 'function') {
          mobileQuery.addEventListener('change', handleBreakpoint);
        } else if (typeof mobileQuery.addListener === 'function') {
          mobileQuery.addListener(handleBreakpoint);
        }
      }
      window.addEventListener('resize', throttleToFrame(handleBreakpoint));
    }

    return { init: init, close: close, isMobileLayout: isMobileLayout };
  })();


  /* ========================================================================
     04. ANCHOR NAVIGATION
     Handles every in-page link: closes the menu, scrolls with the sticky
     header accounted for, updates the URL, and moves keyboard focus to the
     destination so screen-reader and keyboard users follow along.
     ==================================================================== */

  function initAnchorNavigation() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
      if (!link || link.hasAttribute('download') || link.target === '_blank') return;

      var hash = link.getAttribute('href');
      if (!hash || hash === '#') return;

      var target;
      try {
        target = document.querySelector(hash);
      } catch (error) {
        return; // Not a valid selector — let the browser deal with it.
      }
      if (!target) return;

      event.preventDefault();
      mobileNav.close();

      // Links that pre-select a contact topic should show the whole card,
      // heading included, rather than clipping it above the fold.
      var topic = link.getAttribute('data-form-topic');
      var scrollAnchor = target;
      if (topic && typeof target.closest === 'function') {
        scrollAnchor = target.closest('.contact-card') || target;
      }

      var top = scrollAnchor.getBoundingClientRect().top + window.pageYOffset - headerHeight() - 16;
      scrollWindowTo(Math.max(top, 0));

      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', hash);
      }

      var focusTarget = topic ? applyContactTopic(topic) : null;

      var destination = focusTarget || target;
      if (!destination.hasAttribute('tabindex')) {
        destination.setAttribute('tabindex', '-1');
      }
      destination.focus({ preventScroll: true });
    });
  }


  /* ========================================================================
     05. SCROLL OBSERVER
     One throttled scroll listener drives the progress bar, the stuck-header
     state, and the active navigation link.
     ==================================================================== */

  function initScrollObserver() {
    var progressBar = document.querySelector('[data-scroll-progress]');
    var navLinks = selectAll('.primary-nav__list a[href^="#"]');

    // Pair each nav link with the section it points at, in document order.
    var sections = navLinks
      .map(function (link) {
        var id = link.getAttribute('href');
        var element = null;
        try {
          element = document.querySelector(id);
        } catch (error) {
          element = null;
        }
        return element ? { link: link, element: element } : null;
      })
      .filter(Boolean);

    if (!progressBar && !sections.length && !siteHeader) return;

    var activeLink = null;

    function setActiveLink(link) {
      if (link === activeLink) return;
      if (activeLink) {
        activeLink.classList.remove('is-active');
        activeLink.removeAttribute('aria-current');
      }
      if (link) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'location');
      }
      activeLink = link;
    }

    function update() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;

      if (progressBar) {
        var progress = docHeight > 0 ? clamp(scrollTop / docHeight, 0, 1) : 0;
        progressBar.style.transform = 'scaleX(' + progress + ')';
      }

      if (siteHeader) {
        siteHeader.classList.toggle('is-stuck', scrollTop > 8);
      }

      if (!sections.length) return;

      // Bottom of the page always resolves to the final section, which may
      // otherwise be too short to ever cross the activation line.
      if (docHeight > 0 && scrollTop >= docHeight - 2) {
        setActiveLink(sections[sections.length - 1].link);
        return;
      }

      var line = scrollTop + headerHeight() + 24;
      var current = null;

      for (var i = 0; i < sections.length; i++) {
        var offsetTop = sections[i].element.getBoundingClientRect().top + scrollTop;
        if (offsetTop <= line) current = sections[i].link;
        else break;
      }

      setActiveLink(current);
    }

    var onScroll = throttleToFrame(update);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }


  /* ========================================================================
     06. REVEAL ON SCROLL
     ==================================================================== */

  function initReveal() {
    var elements = selectAll('[data-reveal]');
    if (!elements.length) return;

    function revealAll() {
      elements.forEach(function (element) {
        element.classList.add('is-revealed');
      });
    }

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0, rootMargin: '0px 0px -12% 0px' }
    );

    elements.forEach(function (element) {
      observer.observe(element);
    });

    // If the preference flips mid-session, stop animating and show everything.
    onReducedMotionChange(function () {
      if (!prefersReducedMotion()) return;
      observer.disconnect();
      revealAll();
    });
  }


  /* ========================================================================
     07. COUNTDOWN TO THE NEXT JANUARY 1
     The year is always derived, never hard-coded: if January 1 has already
     passed this year, the countdown targets next year's January 1.
     ==================================================================== */

  function initCountdown() {
    var daysElement = document.querySelector('[data-countdown-days]');
    var unitElement = document.querySelector('[data-countdown-unit]');
    var dateElement = document.querySelector('[data-countdown-date]');
    var railElement = document.querySelector('[data-countdown-rail]');
    var fillElement = document.querySelector('[data-countdown-fill]');
    var markerElement = document.querySelector('[data-countdown-marker]');

    if (!daysElement && !dateElement && !fillElement) return;

    var MS_PER_DAY = 86400000;

    function startOfToday() {
      var now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    /** The next January 1 at or after today. */
    function nextJanuaryFirst(today) {
      var candidate = new Date(today.getFullYear(), 0, 1);
      if (candidate.getTime() < today.getTime()) {
        candidate = new Date(today.getFullYear() + 1, 0, 1);
      }
      return candidate;
    }

    function formatLongDate(date) {
      try {
        return new Intl.DateTimeFormat('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }).format(date);
      } catch (error) {
        return 'January 1, ' + date.getFullYear();
      }
    }

    function update() {
      var today = startOfToday();
      var target = nextJanuaryFirst(today);

      // Math.round absorbs the hour that daylight-saving changes add or remove.
      var days = Math.max(0, Math.round((target.getTime() - today.getTime()) / MS_PER_DAY));
      var readableDate = formatLongDate(target);

      if (daysElement) {
        if (days === 0) {
          daysElement.textContent = 'Today';
          daysElement.classList.add('is-today');
        } else {
          daysElement.textContent = String(days);
          daysElement.classList.remove('is-today');
        }
      }

      if (unitElement) {
        if (days === 0) {
          unitElement.textContent = '';
          unitElement.hidden = true;
        } else {
          unitElement.hidden = false;
          unitElement.textContent = days === 1 ? 'day' : 'days';
        }
      }

      // Wording is deliberate: January 1 is the date the campaign wants talks
      // opened, not one the Agreement schedules (it runs to June 30, 2027,
      // notice due May 2, 2027). Do not reword these to assert an event.
      if (dateElement) {
        dateElement.textContent = readableDate + ' — the date I want talks open';
      }

      // Progress across the year that ends on the target January 1.
      var spanStart = new Date(target.getFullYear() - 1, 0, 1);
      var spanTotal = target.getTime() - spanStart.getTime();
      var elapsed = today.getTime() - spanStart.getTime();
      var percent = spanTotal > 0 ? clamp((elapsed / spanTotal) * 100, 0, 100) : 0;

      if (fillElement) fillElement.style.width = percent.toFixed(2) + '%';

      if (markerElement) {
        markerElement.style.left = percent.toFixed(2) + '%';
        markerElement.hidden = false;
      }

      if (railElement) {
        railElement.setAttribute(
          'aria-label',
          days === 0
            ? 'Today, ' + readableDate + ', is the date this campaign wants talks opened.'
            : days +
                (days === 1 ? ' day' : ' days') +
                ' until ' +
                readableDate +
                ', the date this campaign wants talks opened.'
        );
      }
    }

    update();

    // Keep the figure honest for anyone who leaves the page open overnight.
    function scheduleMidnightRefresh() {
      var now = new Date();
      var nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      var delay = clamp(nextMidnight.getTime() - now.getTime(), 1000, MS_PER_DAY);
      window.setTimeout(function () {
        update();
        scheduleMidnightRefresh();
      }, delay);
    }
    scheduleMidnightRefresh();

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) update();
    });
  }


  /* ========================================================================
     08. ROTATING CANDIDATE PORTRAIT
     Reads image paths from data-photos. Every image is probed first, so a
     missing or broken file simply falls back to the CSS monogram instead of
     leaving a hole in the layout.
     ==================================================================== */

  function initPortrait() {
    var root = document.querySelector('[data-portrait]');
    if (!root) return;

    var stage = root.querySelector('[data-portrait-stage]');
    var monogram = root.querySelector('[data-portrait-monogram]');
    if (!stage) return;

    // The first photo is server-rendered so it survives a no-JS visit. If
    // Promises are unavailable we cannot probe, so leave that markup alone.
    var staticPhoto = stage.querySelector('[data-portrait-static]');
    if (typeof window.Promise !== 'function') return;

    function dropStaticPhoto() {
      if (staticPhoto && staticPhoto.parentNode) {
        staticPhoto.parentNode.removeChild(staticPhoto);
      }
      staticPhoto = null;
    }

    var sources = (root.getAttribute('data-photos') || '')
      .split(',')
      .map(function (value) { return value.trim(); })
      .filter(Boolean);

    if (!sources.length) {
      // Nothing configured: clear any stray markup so the monogram shows.
      dropStaticPhoto();
      return;
    }

    var altTexts = (root.getAttribute('data-photo-alt') || '')
      .split('|')
      .map(function (value) { return value.trim(); });

    var interval = Math.max(2000, parseInt(root.getAttribute('data-interval'), 10) || 5000);

    /** Resolves with the source string if it loads, otherwise with null. */
    function probeImage(source) {
      return new Promise(function (resolve) {
        var probe = new Image();
        probe.onload = function () { resolve(source); };
        probe.onerror = function () { resolve(null); };
        probe.src = source;
      });
    }

    Promise.all(sources.map(probeImage)).then(function (results) {
      var usable = [];
      results.forEach(function (source, index) {
        if (source) usable.push({ source: source, alt: altTexts[index] || '' });
      });

      if (!usable.length) {
        // Every image failed — remove the broken one and keep the monogram.
        dropStaticPhoto();
        return;
      }

      // Rebuild the stage uniformly from the verified list. The re-added
      // first image is already cached, so this does not refetch or flash.
      dropStaticPhoto();
      if (monogram) monogram.hidden = true;

      var slides = usable.map(function (photo, index) {
        var image = document.createElement('img');
        image.className = 'portrait__photo';
        image.src = photo.source;
        image.alt =
          photo.alt ||
          'Roman Vitanza, candidate for APSEA Vice President' +
            (usable.length > 1 ? ' (photo ' + (index + 1) + ' of ' + usable.length + ')' : '');
        image.decoding = 'async';
        if (index > 0) image.loading = 'lazy';
        if (index === 0) image.classList.add('is-current');
        stage.appendChild(image);
        return image;
      });

      if (slides.length < 2) return; // A single photo needs no controls.

      root.setAttribute('aria-roledescription', 'photo rotator');

      var currentIndex = 0;
      var timerId = null;
      var pausedByUser = false;
      var pausedByHover = false;

      /* --- Controls ---------------------------------------------------- */
      var controls = document.createElement('div');
      controls.className = 'portrait__controls';

      var dotGroup = document.createElement('div');
      dotGroup.className = 'portrait__dots';
      dotGroup.setAttribute('role', 'group');
      dotGroup.setAttribute('aria-label', 'Choose a photo');

      var dots = slides.map(function (slide, index) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'portrait__dot';
        dot.setAttribute('aria-label', 'Show photo ' + (index + 1) + ' of ' + slides.length);
        if (index === 0) dot.setAttribute('aria-current', 'true');
        dot.addEventListener('click', function () {
          showSlide(index);
          pausedByUser = true;
          stopTimer();
          syncPauseButton();
        });
        dotGroup.appendChild(dot);
        return dot;
      });

      var PAUSE_ICON =
        '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">' +
        '<rect x="3" y="2" width="3.6" height="12" rx="1"/>' +
        '<rect x="9.4" y="2" width="3.6" height="12" rx="1"/></svg>';
      var PLAY_ICON =
        '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">' +
        '<path d="M4 2.4v11.2a.8.8 0 0 0 1.22.68l9-5.6a.8.8 0 0 0 0-1.36l-9-5.6A.8.8 0 0 0 4 2.4Z"/></svg>';

      var pauseButton = document.createElement('button');
      pauseButton.type = 'button';
      pauseButton.className = 'portrait__pause';
      pauseButton.addEventListener('click', function () {
        pausedByUser = !pausedByUser;
        if (pausedByUser) stopTimer();
        else startTimer();
        syncPauseButton();
      });

      controls.appendChild(dotGroup);
      controls.appendChild(pauseButton);
      (root.querySelector('.portrait__frame') || root).appendChild(controls);

      /* --- Behaviour --------------------------------------------------- */
      function showSlide(index) {
        currentIndex = (index + slides.length) % slides.length;
        slides.forEach(function (slide, i) {
          slide.classList.toggle('is-current', i === currentIndex);
        });
        dots.forEach(function (dot, i) {
          if (i === currentIndex) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
      }

      function stopTimer() {
        if (timerId === null) return;
        window.clearInterval(timerId);
        timerId = null;
      }

      function startTimer() {
        stopTimer();
        if (pausedByUser || pausedByHover || prefersReducedMotion()) return;
        timerId = window.setInterval(function () {
          showSlide(currentIndex + 1);
        }, interval);
      }

      function syncPauseButton() {
        var running = timerId !== null;
        pauseButton.innerHTML = running ? PAUSE_ICON : PLAY_ICON;
        pauseButton.setAttribute(
          'aria-label',
          running ? 'Pause photo rotation' : 'Start photo rotation'
        );
      }

      // Hovering or tabbing into the rotator pauses it; leaving resumes.
      root.addEventListener('mouseenter', function () {
        pausedByHover = true;
        stopTimer();
        syncPauseButton();
      });
      root.addEventListener('mouseleave', function () {
        pausedByHover = false;
        startTimer();
        syncPauseButton();
      });
      root.addEventListener('focusin', function () {
        pausedByHover = true;
        stopTimer();
        syncPauseButton();
      });
      root.addEventListener('focusout', function () {
        if (root.contains(document.relatedTarget)) return;
        pausedByHover = false;
        startTimer();
        syncPauseButton();
      });

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopTimer();
        else startTimer();
        syncPauseButton();
      });

      onReducedMotionChange(function () {
        if (prefersReducedMotion()) stopTimer();
        else startTimer();
        syncPauseButton();
      });

      // Reduced motion means no automatic rotation — the controls still work.
      startTimer();
      syncPauseButton();
    }).catch(function () {
      /* Probing failed entirely; the monogram remains, which is fine. */
    });
  }


  /* ========================================================================
     09. CONTACT FORM
     Netlify Forms handles delivery. Without JavaScript the form posts
     natively and Netlify renders its own confirmation. With JavaScript we
     post in the background and confirm inline instead.
     ==================================================================== */

  // Shown only when a form submission fails, so the visitor still has a
  // way to reach the campaign. Keep in step with the mailto links in the
  // markup.
  var CAMPAIGN_EMAIL = 'vitanzar2@gmail.com';

  /**
   * Pre-selects a topic in the contact form.
   * @returns {Element|null} the field to focus after scrolling, if any.
   */
  function applyContactTopic(topic) {
    var select = document.querySelector('[data-form-topic-field]');
    if (!select) return null;

    var matched = false;
    selectAll('option', select).forEach(function (option) {
      if (matched) return;
      // Normalise curly apostrophes so markup and data attributes can differ.
      var optionText = option.textContent.replace(/’/g, "'").trim().toLowerCase();
      if (optionText === topic.replace(/’/g, "'").trim().toLowerCase()) {
        select.value = option.value || option.textContent;
        matched = true;
      }
    });

    // The form's first control is the hidden form-name input, so focus has
    // to target the marked field rather than whatever comes first.
    var form = select.form;
    if (!form) return select;
    return form.querySelector('[data-form-first-field]') || select;
  }

  function initContactForm() {
    var form = document.querySelector('[data-contact-form]');
    if (!form) return;

    var status = form.querySelector('[data-form-status]');
    var submitButton = form.querySelector('[data-form-submit]');
    var submitLabel = submitButton ? submitButton.textContent : 'Send message';

    function setStatus(state, message) {
      if (!status) return;
      status.classList.remove('is-success', 'is-error');
      if (state) status.classList.add('is-' + state);
      status.innerHTML = message;
    }

    function setBusy(busy) {
      if (!submitButton) return;
      submitButton.disabled = busy;
      submitButton.setAttribute('aria-busy', busy ? 'true' : 'false');
      submitButton.textContent = busy ? 'Sending…' : submitLabel;
    }

    form.addEventListener('submit', function (event) {
      form.classList.add('is-validated');

      if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
        event.preventDefault();
        setStatus('error', 'Please add your name, a valid email address, and a message.');
        var firstInvalid = form.querySelector(':invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // No fetch support: let the browser post natively to Netlify.
      if (!window.fetch || !window.FormData || !window.URLSearchParams) return;

      event.preventDefault();
      setBusy(true);
      setStatus(null, 'Sending your message…');

      var endpoint = form.getAttribute('action') || window.location.pathname;
      var payload = new URLSearchParams(new FormData(form)).toString();

      window
        .fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: payload
        })
        .then(function (response) {
          if (!response.ok) throw new Error('Request failed: ' + response.status);
          form.reset();
          form.classList.remove('is-validated');
          setStatus(
            'success',
            'Thanks — your message is on its way. You&rsquo;ll get a reply from the campaign directly.'
          );
        })
        .catch(function () {
          setStatus(
            'error',
            'That didn&rsquo;t go through. Please email <a href="mailto:' +
              CAMPAIGN_EMAIL + '">' + CAMPAIGN_EMAIL + '</a> instead.'
          );
        })
        .then(function () {
          setBusy(false);
        });
    });
  }


  /* ========================================================================
     BOOT
     ==================================================================== */

  function init() {
    initHeaderHeightSync();
    mobileNav.init();
    initAnchorNavigation();
    initScrollObserver();
    initReveal();
    initCountdown();
    initPortrait();
    initContactForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
