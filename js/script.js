(function () {
  "use strict";

  /* ---------- Preloader ---------- */
  var preloader = document.getElementById("preloader");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var preloaderHidden = false;

  function hidePreloader() {
    if (!preloader || preloaderHidden) return;
    preloaderHidden = true;
    preloader.classList.add("is-hidden");
  }

  window.addEventListener("load", function () {
    window.setTimeout(hidePreloader, reduceMotion ? 0 : 350);
  });
  /* A failed third-party font request must never leave the invitation
     permanently covered by the loader. */
  window.setTimeout(hidePreloader, reduceMotion ? 500 : 3000);

  /* ---------- Progress bar + nav scrolled state ---------- */
  var progressBar = document.getElementById("progressBar");
  var siteNav = document.getElementById("siteNav");

  function onScroll() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + "%";
    if (siteNav) {
      if (scrollTop > 40) siteNav.classList.add("is-scrolled");
      else siteNav.classList.remove("is-scrolled");
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Burger menu ---------- */
  var burgerBtn = document.getElementById("burgerBtn");
  var navLinks = document.getElementById("navLinks");
  if (burgerBtn && navLinks) {
    var firstNavLink = navLinks.querySelector("a");
    var mobileNavQuery = window.matchMedia("(max-width: 720px)");

    function syncMenuAccessibility(isOpen) {
      var isMobile = mobileNavQuery.matches;
      var shouldDisableLinks = isMobile && !isOpen;
      if (isMobile) {
        navLinks.setAttribute("aria-hidden", String(!isOpen));
        navLinks.inert = !isOpen;
      } else {
        navLinks.removeAttribute("aria-hidden");
        navLinks.inert = false;
      }
      navLinks.querySelectorAll("a").forEach(function (a) {
        if (!a.hasAttribute("data-menu-tabindex")) {
          a.setAttribute("data-menu-tabindex", a.getAttribute("tabindex") || "");
        }
        if (shouldDisableLinks) {
          a.tabIndex = -1;
        } else {
          var savedTabIndex = a.getAttribute("data-menu-tabindex");
          if (savedTabIndex) a.setAttribute("tabindex", savedTabIndex);
          else a.removeAttribute("tabindex");
        }
      });
    }

    function setMenuOpen(isOpen, returnFocus) {
      burgerBtn.classList.toggle("is-open", isOpen);
      navLinks.classList.toggle("is-open", isOpen);
      document.body.classList.toggle("menu-open", isOpen);
      burgerBtn.setAttribute("aria-expanded", String(isOpen));
      burgerBtn.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
      syncMenuAccessibility(isOpen);
      if (isOpen && firstNavLink) firstNavLink.focus();
      if (!isOpen && returnFocus) burgerBtn.focus();
    }

    setMenuOpen(false, false);
    burgerBtn.addEventListener("click", function () {
      setMenuOpen(!navLinks.classList.contains("is-open"), false);
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        setMenuOpen(false, mobileNavQuery.matches);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navLinks.classList.contains("is-open")) {
        setMenuOpen(false, true);
      }
    });
    document.addEventListener("click", function (e) {
      if (!navLinks.classList.contains("is-open")) return;
      if (!navLinks.contains(e.target) && !burgerBtn.contains(e.target)) {
        setMenuOpen(false, false);
      }
    });
    var onNavBreakpointChange = function () {
      setMenuOpen(false, false);
    };
    if (mobileNavQuery.addEventListener) {
      mobileNavQuery.addEventListener("change", onNavBreakpointChange);
    } else if (mobileNavQuery.addListener) {
      mobileNavQuery.addListener(onNavBreakpointChange);
    }
  }

  /* ---------- Active section highlighting (nav + dots) ---------- */
  var sections = document.querySelectorAll(".section[id]");
  var navAnchors = document.querySelectorAll('[data-nav]');
  var dotAnchors = document.querySelectorAll('[data-dot]');

  function setActive(id) {
    navAnchors.forEach(function (a) {
      var isActive = a.getAttribute("href") === "#" + id;
      a.classList.toggle("is-active", isActive);
      if (isActive) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
    dotAnchors.forEach(function (a) {
      var isActive = a.getAttribute("href") === "#" + id;
      a.classList.toggle("is-active", isActive);
      if (isActive) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }

  if (sections.length) setActive(sections[0].id);
  if (typeof window.IntersectionObserver === "function" && sections.length) {
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    sections.forEach(function (s) { navObserver.observe(s); });
  }

  /* ---------- One-screen-per-wheel-turn navigation ----------
     Every wheel notch moves the page to the next screen-sized chunk
     ("slide" — marked with [data-slide] in the HTML: whole sections, or
     a smaller chunk inside a long section), like turning a page of the
     invitation. A slide that is short enough to fully fit the viewport
     is switched immediately on any wheel turn. A slide taller than the
     viewport (e.g. the RSVP form) instead scrolls normally inside
     itself — the jump to the next/previous slide only kicks in once the
     user reaches that slide's own top/bottom edge, so nothing is ever
     skipped past unread. Disabled below 761px so touch/mobile scrolling
     stays natural. */
  (function () {
    var slides = Array.prototype.slice.call(document.querySelectorAll("[data-slide]"));
    if (!slides.length) return;

    var desktopQuery = window.matchMedia("(min-width: 761px)");
    var isAnimating = false;
    var unlockTimer = null;
    var WHEEL_THRESHOLD = 4;
    var EDGE = 48;
    var LOCK_MS = reduceMotion ? 0 : 850;
    /* Keep the JS navigation in sync with [data-slide]'s CSS offset. */
    var NAV_OFFSET = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-offset")) || 84;
    var scrollBehavior = reduceMotion ? "auto" : "smooth";

    function nearAtBottom() {
      return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    }
    function nearAtTop() {
      return window.scrollY <= 2;
    }
    function slideTop(i) {
      return slides[i].getBoundingClientRect().top + window.scrollY;
    }
    function slideTarget(i) {
      /* scroll-margin-top moves the visual landing point above the element.
         Use the same point when detecting the currently visible slide;
         otherwise the next wheel turn targets the slide we are already on. */
      return Math.max(0, slideTop(i) - NAV_OFFSET);
    }
    function activeIndex() {
      var y = window.scrollY + 1;
      var idx = 0;
      for (var i = 0; i < slides.length; i++) {
        if (slideTarget(i) <= y) idx = i;
      }
      return idx;
    }
    function lock() {
      isAnimating = true;
      clearTimeout(unlockTimer);
      unlockTimer = setTimeout(function () {
        isAnimating = false;
      }, LOCK_MS);
    }
    function goToSlide(idx) {
      idx = Math.max(0, Math.min(slides.length - 1, idx));
      lock();
      window.scrollTo({ top: slideTarget(idx), behavior: scrollBehavior });
    }
    function goToDocumentEnd() {
      lock();
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: scrollBehavior });
    }
    function targetCanConsumeWheel(target, deltaY) {
      var textarea = target && target.closest ? target.closest("textarea") : null;
      if (!textarea || textarea.scrollHeight <= textarea.clientHeight) return false;
      if (deltaY < 0) return textarea.scrollTop > 0;
      return textarea.scrollTop + textarea.clientHeight < textarea.scrollHeight - 1;
    }

    window.addEventListener(
      "wheel",
      function (e) {
        if (!desktopQuery.matches) return;
        if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
        if (targetCanConsumeWheel(e.target, e.deltaY)) return;
        if (isAnimating) {
          e.preventDefault();
          return;
        }

        var idx = activeIndex();
        var top = slideTarget(idx);
        var bottom = idx < slides.length - 1 ? slideTarget(idx + 1) : document.documentElement.scrollHeight;
        var height = bottom - top;
        var viewportH = window.innerHeight;
        var fits = height <= viewportH + 2;
        var scrollingDown = e.deltaY > 0;

        if (scrollingDown) {
          var distanceToBottomEdge = bottom - (window.scrollY + viewportH);
          if (fits || distanceToBottomEdge <= EDGE) {
            if (idx < slides.length - 1) {
              e.preventDefault();
              goToSlide(idx + 1);
            } else if (!nearAtBottom()) {
              e.preventDefault();
              goToDocumentEnd();
            }
            /* else: already at the very bottom — let the native (no-op)
               scroll happen, nothing left to jump to */
          }
          /* else: slide is taller than the screen and we're not near its
             end yet — let the browser scroll normally inside it */
        } else {
          var distanceFromTop = window.scrollY - top;
          if (fits || distanceFromTop <= EDGE) {
            if (idx > 0) {
              e.preventDefault();
              goToSlide(idx - 1);
            } else if (!nearAtTop()) {
              e.preventDefault();
              goToSlide(0);
            }
          }
          /* else: let the browser scroll normally back up inside the
             oversized slide until its own top edge is reached */
        }
      },
      { passive: false }
    );
  })();

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (typeof window.IntersectionObserver === "function" && revealEls.length) {
    var revealObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Countdown timer ---------- */
  var weddingDate = new Date("2027-04-17T17:00:00+03:00").getTime();
  var elDays = document.getElementById("cd-days");
  var elHours = document.getElementById("cd-hours");
  var elMins = document.getElementById("cd-mins");
  var elSecs = document.getElementById("cd-secs");

  function pad(n) { return String(n).padStart(2, "0"); }

  function updateCountdown() {
    var now = Date.now();
    var diff = weddingDate - now;
    if (diff < 0) diff = 0;
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    var mins = Math.floor((diff / (1000 * 60)) % 60);
    var secs = Math.floor((diff / 1000) % 60);
    if (elDays) elDays.textContent = pad(days);
    if (elHours) elHours.textContent = pad(hours);
    if (elMins) elMins.textContent = pad(mins);
    if (elSecs) elSecs.textContent = pad(secs);
  }
  if (elDays) {
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  /* =========================================================
     RSVP FORM — modern accessible implementation
     ========================================================= */
  var rsvpForm = document.getElementById("rsvpForm");

  if (rsvpForm) {
    var COUPLE_EMAIL = "anastasia.ivan.wedding@example.com";
    var DRAFT_KEY = "wedding_rsvp_draft";
    var DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
    /* Keep an unfinished answer in this tab only, not on a shared device
       indefinitely. */
    var draftStorage = null;
    try { draftStorage = window.sessionStorage; } catch (err) { /* ignore */ }
    /* Remove the old client-side submission archive from earlier builds. */
    try { window.localStorage.removeItem("wedding_rsvp"); } catch (err) { /* ignore */ }
    var MAX_GUESTS = 10;

    var countField = document.getElementById("countField");
    var namesField = document.getElementById("namesField");
    var guestCountInput = document.getElementById("guestCount");
    var countMinus = document.getElementById("countMinus");
    var countPlus = document.getElementById("countPlus");
    var guestNamesWrap = document.getElementById("guestNames");
    var wishInput = document.getElementById("guestWish");
    var wishCounter = document.getElementById("wishCounter");
    var submitBtn = document.getElementById("submitBtn");
    var formStatus = document.getElementById("formStatus");
    var rsvpThanks = document.getElementById("rsvpThanks");
    var rsvpThanksText = document.getElementById("rsvpThanksText");
    var editAnswerBtn = document.getElementById("editAnswer");

    /* ---- Show/hide guest count & names depending on attendance ---- */
    function isAttendingYes() {
      var checked = rsvpForm.querySelector('input[name="attending"]:checked');
      return !checked || checked.value === "yes";
    }
    function toggleAttendingFields() {
      var isYes = isAttendingYes();
      if (countField) countField.hidden = !isYes;
      if (namesField) namesField.hidden = !isYes;
    }
    rsvpForm.querySelectorAll('input[name="attending"]').forEach(function (r) {
      r.addEventListener("change", function () {
        toggleAttendingFields();
        if (!isAttendingYes()) clearContactError();
        saveDraft();
      });
    });
    toggleAttendingFields();

    /* ---- Guest name rows kept in sync with the guest counter ---- */
    function buildGuestRow(index, value) {
      var row = document.createElement("div");
      row.className = "guest-names__row";

      var input = document.createElement("input");
      input.type = "text";
      input.name = "guest" + index;
      input.placeholder = index + ". Имя гостя";
      input.setAttribute("aria-label", index + ". Имя гостя");
      input.autocomplete = "off";
      input.maxLength = 120;
      input.value = value || "";
      input.addEventListener("input", saveDraft);
      row.appendChild(input);

      if (index > 1) {
        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "guest-remove";
        removeBtn.setAttribute("aria-label", "Убрать гостя " + index);
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
        removeBtn.addEventListener("click", function () {
          var count = Math.max(1, getGuestCount() - 1);
          setGuestCount(count, true);
        });
        row.appendChild(removeBtn);
      }
      return row;
    }

    function getGuestNameValues() {
      return Array.prototype.map.call(
        guestNamesWrap.querySelectorAll("input"),
        function (inp) { return inp.value; }
      );
    }

    function renderGuestRows(count, values) {
      guestNamesWrap.innerHTML = "";
      for (var i = 1; i <= count; i++) {
        guestNamesWrap.appendChild(buildGuestRow(i, values[i - 1]));
      }
    }

    function getGuestCount() {
      return Math.min(MAX_GUESTS, Math.max(1, parseInt(guestCountInput.value, 10) || 1));
    }

    function setGuestCount(count, focusLast) {
      count = Math.min(MAX_GUESTS, Math.max(1, count));
      var values = getGuestNameValues();
      guestCountInput.value = count;
      renderGuestRows(count, values);
      if (focusLast) {
        var inputs = guestNamesWrap.querySelectorAll("input");
        if (inputs.length) inputs[inputs.length - 1].focus();
      }
      saveDraft();
    }

    if (guestCountInput && guestNamesWrap) {
      renderGuestRows(getGuestCount(), getGuestNameValues());
      guestCountInput.addEventListener("input", function () {
        setGuestCount(getGuestCount());
      });
      if (countMinus) countMinus.addEventListener("click", function () { setGuestCount(getGuestCount() - 1); });
      if (countPlus) countPlus.addEventListener("click", function () { setGuestCount(getGuestCount() + 1, true); });
    }

    /* ---- Live character counter for the wish textarea ---- */
    if (wishInput && wishCounter) {
      var maxLen = parseInt(wishInput.getAttribute("maxlength"), 10) || 300;
      function updateWishCounter() {
        var len = wishInput.value.length;
        wishCounter.textContent = len + " / " + maxLen;
        wishCounter.classList.toggle("is-warning", len > maxLen * 0.9);
      }
      wishInput.addEventListener("input", function () { updateWishCounter(); saveDraft(); });
      updateWishCounter();
    }

    /* ---- Inline validation ---- */
    function setFieldError(input, errorEl, message) {
      var wrap = input.closest(".rsvp-form__field");
      if (message) {
        if (wrap) wrap.classList.add("has-error");
        if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
        input.setAttribute("aria-invalid", "true");
      } else {
        if (wrap) wrap.classList.remove("has-error");
        if (errorEl) { errorEl.textContent = ""; errorEl.hidden = true; }
        input.removeAttribute("aria-invalid");
      }
    }

    var nameInput = document.getElementById("guestName");
    var nameError = document.getElementById("guestNameError");
    var phoneInput = document.getElementById("guestPhone");
    var phoneError = document.getElementById("guestPhoneError");
    var emailInput = document.getElementById("guestEmail");
    var emailError = document.getElementById("guestEmailError");

    var PHONE_RE = /^[+]?[\d\s()\-]{7,20}$/;
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var CONTACT_ERROR = "Оставьте телефон или e-mail, чтобы мы могли с вами связаться.";

    function clearContactError() {
      if (phoneError && phoneError.textContent === CONTACT_ERROR) {
        setFieldError(phoneInput, phoneError, "");
      }
      if (emailError && emailError.textContent === CONTACT_ERROR) {
        setFieldError(emailInput, emailError, "");
      }
    }

    function validateName() {
      var val = nameInput.value.trim();
      if (!val) {
        setFieldError(nameInput, nameError, "Пожалуйста, укажите ваше имя.");
        return false;
      }
      if (val.length < 2) {
        setFieldError(nameInput, nameError, "Имя слишком короткое.");
        return false;
      }
      setFieldError(nameInput, nameError, "");
      return true;
    }

    function validatePhone() {
      var val = phoneInput.value.trim();
      if (val && !PHONE_RE.test(val)) {
        setFieldError(phoneInput, phoneError, "Проверьте формат телефона.");
        return false;
      }
      setFieldError(phoneInput, phoneError, "");
      return true;
    }

    function validateEmail() {
      var val = emailInput.value.trim();
      if (val && !EMAIL_RE.test(val)) {
        setFieldError(emailInput, emailError, "Проверьте формат e-mail.");
        return false;
      }
      setFieldError(emailInput, emailError, "");
      return true;
    }

    function validateContactPresence() {
      var hasContact = phoneInput.value.trim() || emailInput.value.trim();
      var isYes = isAttendingYes();
      if (isYes && !hasContact) {
        setFieldError(phoneInput, phoneError, CONTACT_ERROR);
        return false;
      }
      clearContactError();
      return true;
    }

    if (nameInput) nameInput.addEventListener("blur", validateName);
    if (phoneInput) phoneInput.addEventListener("blur", function () { validatePhone(); validateContactPresence(); });
    if (emailInput) emailInput.addEventListener("blur", function () { validateEmail(); validateContactPresence(); });
    [phoneInput, emailInput].forEach(function (el) {
      if (el) el.addEventListener("input", function () {
        if (phoneInput.value.trim() || emailInput.value.trim()) clearContactError();
      });
    });

    function showFormStatus(message) {
      if (!formStatus) return;
      if (message) {
        formStatus.textContent = message;
        formStatus.hidden = false;
        formStatus.classList.add("is-error");
      } else {
        formStatus.hidden = true;
        formStatus.classList.remove("is-error");
      }
    }

    function validateAll() {
      var validName = validateName();
      var validPhone = validatePhone();
      var validEmail = validateEmail();
      var validContact = validateContactPresence();
      return validName && validPhone && validEmail && validContact;
    }

    /* ---- Draft autosave / restore (so guests never lose progress) ---- */
    function saveDraft() {
      try {
        var data = new FormData(rsvpForm);
        var draft = {
          attending: data.get("attending"),
          name: data.get("name") || "",
          phone: data.get("phone") || "",
          email: data.get("email") || "",
          count: getGuestCount(),
          guestNames: getGuestNameValues(),
          wish: data.get("wish") || "",
          updatedAt: Date.now()
        };
        if (draftStorage) draftStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (err) { /* storage may be unavailable — ignore */ }
    }

    var saveTimer = null;
    function scheduleSaveDraft() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveDraft, 400);
    }
    [nameInput, phoneInput, emailInput].forEach(function (el) {
      if (el) el.addEventListener("input", scheduleSaveDraft);
    });

    function restoreDraft() {
      var raw;
      try { raw = draftStorage ? draftStorage.getItem(DRAFT_KEY) : null; } catch (err) { return; }
      if (!raw) return;
      var draft;
      try { draft = JSON.parse(raw); } catch (err) { return; }
      if (!draft) return;
      if (draft.updatedAt && Date.now() - Number(draft.updatedAt) > DRAFT_MAX_AGE_MS) {
        clearDraft();
        return;
      }

      if (draft.attending) {
        var radio = Array.prototype.slice.call(rsvpForm.querySelectorAll('input[name="attending"]')).filter(function (option) {
          return option.value === String(draft.attending);
        })[0];
        if (radio) radio.checked = true;
      }
      if (nameInput && draft.name) nameInput.value = String(draft.name).slice(0, 120);
      if (phoneInput && draft.phone) phoneInput.value = String(draft.phone).slice(0, 30);
      if (emailInput && draft.email) emailInput.value = String(draft.email).slice(0, 254);
      if (wishInput && draft.wish) {
        wishInput.value = String(draft.wish).slice(0, 300);
        wishInput.dispatchEvent(new Event("input"));
      }
      if (draft.count && guestNamesWrap) {
        var restoredCount = Math.min(MAX_GUESTS, Math.max(1, parseInt(draft.count, 10) || 1));
        var restoredNames = Array.isArray(draft.guestNames)
          ? draft.guestNames.map(function (value) { return String(value).slice(0, 120); })
          : [];
        renderGuestRows(restoredCount, restoredNames);
        if (guestCountInput) guestCountInput.value = restoredCount;
      }
      toggleAttendingFields();
    }
    restoreDraft();

    function clearDraft() {
      try {
        if (draftStorage) draftStorage.removeItem(DRAFT_KEY);
      } catch (err) { /* ignore */ }
    }

    /* ---- Submit ---- */
    rsvpForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Honeypot: if the hidden field got filled, silently drop the "submission"
      var honeypot = document.getElementById("company");
      if (honeypot && honeypot.value) return;

      showFormStatus("");
      if (!validateAll()) {
        showFormStatus("Пожалуйста, проверьте поля, отмеченные ниже.");
        var firstInvalid = rsvpForm.querySelector(".has-error input, .has-error textarea");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      var isYes = isAttendingYes();
      var name = nameInput.value.trim();
      var phone = phoneInput.value.trim();
      var email = emailInput.value.trim();
      var count = getGuestCount();
      var guestNames = getGuestNameValues().map(function (v) { return v.trim(); }).filter(Boolean);
      var wish = wishInput.value.trim();
      var attendingLabel = isYes ? "Буду(ем) на празднике" : "К сожалению, не смогу(ем) присутствовать";

      // Loading state — protects against double submits and gives feedback
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
      var label = submitBtn.querySelector(".btn__label");
      var originalLabel = label ? label.textContent : "";
      if (label) label.textContent = "Отправляем…";

      var lines = [
        "Ответ на приглашение — Анастасия и Иван, 17 апреля 2027",
        "",
        "Имя: " + name,
        "Телефон: " + (phone || "—"),
        "E-mail: " + (email || "—"),
        "Статус: " + attendingLabel
      ];
      if (isYes) {
        lines.push("Количество гостей: " + count + " чел.");
        if (guestNames.length) lines.push("Имена гостей: " + guestNames.join(", "));
      }
      if (wish) {
        lines.push("");
        lines.push("Пожелание: " + wish);
      }

      /* Do not persist submitted personal data in localStorage. The mailto
         draft is the hand-off to the couple; keeping a local copy would
         expose names and contacts to anyone using the same device. */
      var subject = encodeURIComponent("RSVP: " + name + " — " + attendingLabel);
      var body = encodeURIComponent(lines.join("\n"));
      var mailtoLink = "mailto:" + COUPLE_EMAIL + "?subject=" + subject + "&body=" + body;

      setTimeout(function () {
        clearDraft();
        rsvpForm.hidden = true;
        if (rsvpThanks) {
          if (rsvpThanksText) {
            rsvpThanksText.textContent = isYes
              ? "Ответ подготовлен. Откройте письмо и нажмите «Отправить» — будем ждать встречи!"
              : "Ответ подготовлен. Откройте письмо и нажмите «Отправить» — спасибо, что предупредили!";
          }
          rsvpThanks.hidden = false;
          rsvpThanks.focus();
        }

        var w = window.open(mailtoLink, "_blank");
        if (!w) window.location.href = mailtoLink;

        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
        if (label) label.textContent = originalLabel;
      }, 500);
    });

    if (editAnswerBtn) {
      editAnswerBtn.addEventListener("click", function () {
        rsvpThanks.hidden = true;
        rsvpForm.hidden = false;
        if (nameInput) nameInput.focus();
      });
    }
  }
})();
