/* MENTORA — Frontend-only demo logic (LocalStorage powered)
   Works by opening index.html (no backend, no APIs).
*/

(() => {
  "use strict";

  // -----------------------------
  // Storage keys
  // -----------------------------
  const LS = {
    user: "mentora_user",
    profile: "mentora_profile",
    state: "mentora_state",
    theme: "mentora_theme"
  };

  // -----------------------------
  // Default (fallback) mock data
  // -----------------------------
  const FALLBACK_DATA = {
    courses: [
      {
        id: "c1",
        title: "Frontend Foundations",
        description: "HTML, CSS, and JavaScript essentials to build real interfaces.",
        lessonTitle: "Your first responsive layout",
        lessonBody:
          "In this lesson, you'll build a simple responsive layout using flexible grids, spacing, and accessible UI patterns."
      }
    ],
    mcqs: [
      {
        id: "m1",
        question: "Which HTML element is best for the main navigation links?",
        choices: ["<div>", "<nav>", "<span>", "<section>"],
        answerIndex: 1,
        explain: "<nav> semantically represents navigation links."
      }
    ],
    coding: [
      {
        id: "q1",
        title: "Reverse a string",
        question: "Given a string s, return the reversed string.",
        sampleInput: "hello",
        sampleOutput: "olleh"
      }
    ],
    assessment: {
      timeSeconds: 60,
      questions: [
        {
          id: "a1",
          question: "What does LocalStorage store values as?",
          choices: ["Numbers", "Objects", "Strings", "Booleans"],
          answerIndex: 2
        }
      ]
    },
    roadmap: [
      { id: "r1", title: "Step 1: Basics", desc: "HTML, CSS, JS fundamentals." },
      { id: "r2", title: "Step 2: Intermediate", desc: "Patterns, async JS, tooling basics." },
      { id: "r3", title: "Step 3: Projects", desc: "Build portfolio apps with clean UI." }
    ],
    community: [
      {
        id: "p1",
        author: "MENTORA Team",
        title: "Welcome to the community",
        body: "Share your progress, ask questions, and learn together!"
      }
    ],
    leaderboard: [
      { name: "Ishaan", xp: 980 },
      { name: "Sana", xp: 720 },
      { name: "Karthik", xp: 540 },
      { name: "Nila", xp: 410 }
    ],
    quotes: ["Small steps every day add up to big results."]
  };

  // -----------------------------
  // Utilities
  // -----------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safeJsonParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function loadLS(key, fallback) {
    return safeJsonParse(localStorage.getItem(key), fallback);
  }

  function saveLS(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function isValidEmail(email) {
    // Simple, friendly demo validation (not strict RFC)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function computeRank(xp) {
    const levels = [
      { name: "Beginner", min: 0, next: 300 },
      { name: "Intermediate", min: 300, next: 700 },
      { name: "Advanced", min: 700, next: 1200 },
      { name: "Pro", min: 1200, next: null }
    ];

    const current =
      levels
        .slice()
        .reverse()
        .find((l) => xp >= l.min) || levels[0];

    const next = current.next;
    const pct = next ? clamp(((xp - current.min) / (next - current.min)) * 100, 0, 100) : 100;

    return { current: current.name, next, min: current.min, pct };
  }

  // -----------------------------
  // Theme
  // -----------------------------
  function applyThemeFromStorage() {
    const theme = localStorage.getItem(LS.theme) || "auto";
    document.documentElement.removeAttribute("data-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    return theme;
  }

  function setTheme(theme) {
    localStorage.setItem(LS.theme, theme);
    applyThemeFromStorage();
  }

  // -----------------------------
  // Demo data loading
  // -----------------------------
  async function loadMockData() {
    // We ship data.json, but reading local files via fetch() can be blocked under file:// in some browsers.
    // So: try fetch(), fall back to embedded JSON.
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      if (!res.ok) throw new Error("data.json not ok");
      return await res.json();
    } catch {
      return FALLBACK_DATA;
    }
  }

  // -----------------------------
  // Session + default state
  // -----------------------------
  function getUser() {
    return loadLS(LS.user, null);
  }

  function requireAuthOrRedirect() {
    const user = getUser();
    if (!user) {
      window.location.replace("index.html");
      return null;
    }
    return user;
  }

  function getDefaultProfile(userEmail) {
    const nameGuess = userEmail ? userEmail.split("@")[0] : "Learner";
    return {
      name: nameGuess.charAt(0).toUpperCase() + nameGuess.slice(1),
      email: userEmail,
      goal: "Become consistent and job-ready",
      level: "Beginner"
    };
  }

  function getDefaultState() {
    return {
      streak: { count: 1, lastDate: todayISO() },
      xp: 120,
      courseProgress: {}, // { [courseId]: number 0..100 }
      selectedCourseId: null,
      roadmapDone: {}, // legacy global roadmap (kept for backward-compat)
      courseRoadmapDone: {}, // { [courseId]: { [stepId]: true } }
      assessment: { lastScore: null, lastTakenAt: null },
      codingDrafts: {}, // { [codingId]: "code..." }
      community: {
        likes: {}, // { [postId]: number }
        comments: {} // { [postId]: string[] }
      }
    };
  }

  function getState() {
    const st = loadLS(LS.state, null);
    if (!st) return getDefaultState();
    // Shallow merge for forward compatibility
    return { ...getDefaultState(), ...st, streak: { ...getDefaultState().streak, ...(st.streak || {}) } };
  }

  function saveState(state) {
    saveLS(LS.state, state);
  }

  function bumpStreakIfNeeded(state) {
    const last = state.streak?.lastDate;
    const today = todayISO();
    if (!last) {
      state.streak = { count: 1, lastDate: today };
      return state;
    }
    if (last === today) return state;

    const lastD = new Date(last + "T00:00:00");
    const todayD = new Date(today + "T00:00:00");
    const diffDays = Math.round((todayD - lastD) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      state.streak.count = (state.streak.count || 0) + 1;
    } else {
      state.streak.count = 1;
    }
    state.streak.lastDate = today;
    return state;
  }

  // -----------------------------
  // Login page
  // -----------------------------
  function initLoginPage() {
    applyThemeFromStorage();

    // If already logged in, go straight to dashboard.
    if (getUser()) {
      window.location.replace("dashboard.html");
      return;
    }

    const form = $("#loginForm");
    if (!form) return;

    const emailEl = $("#loginEmail");
    const passEl = $("#loginPassword");
    const errorEl = $("#loginError");
    const demoBtn = $("#fillDemoBtn");

    demoBtn?.addEventListener("click", () => {
      emailEl.value = "demo.student@college.edu";
      passEl.value = "demo1234";
      emailEl.focus();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      errorEl.textContent = "";

      const email = String(emailEl.value || "").trim();
      const password = String(passEl.value || "");

      if (!isValidEmail(email)) {
        errorEl.textContent = "Please enter a valid email address.";
        errorEl.hidden = false;
        emailEl.focus();
        return;
      }
      if (password.length < 6) {
        errorEl.textContent = "Password should be at least 6 characters (demo rule).";
        errorEl.hidden = false;
        passEl.focus();
        return;
      }

      // Demo user object
      const user = { email, loginAt: Date.now() };
      saveLS(LS.user, user);

      // Ensure profile/state exist
      const existingProfile = loadLS(LS.profile, null);
      if (!existingProfile || !existingProfile.email) {
        saveLS(LS.profile, getDefaultProfile(email));
      }
      const st = bumpStreakIfNeeded(getState());
      saveState(st);

      window.location.replace("dashboard.html#dashboard");
    });
  }

  // -----------------------------
  // Dashboard app
  // -----------------------------
  function initDashboardApp() {
    const user = requireAuthOrRedirect();
    if (!user) return;

    const theme = applyThemeFromStorage();
    const state = bumpStreakIfNeeded(getState());
    saveState(state);

    // Basic nav + router
    const views = $$("[data-view].view");
    const navItems = $$(".nav__item[data-view]");

    const pageTitle = $("#pageTitle");
    const pageSubtitle = $("#pageSubtitle");

    const titles = {
      dashboard: ["Dashboard", "Track your progress and keep your momentum."],
      profile: ["Digital Profile", "Your learning identity, saved locally."],
      courses: ["Courses", "Curated learning paths with progress tracking."],
      practice: ["Practice", "MCQs + coding prompts to build skill."],
      assessment: ["Assessment", "Timed MCQ quiz — instant feedback."],
      community: ["Community & Ranks", "Demo posts, likes, comments, and leaderboard."],
      settings: ["Settings", "Theme, reset tools, and shortcuts."]
    };

    function showView(name) {
      views.forEach((v) => v.classList.toggle("is-active", v.id === `view-${name}`));
      navItems.forEach((a) => a.classList.toggle("is-active", a.dataset.view === name));
      const [t, s] = titles[name] || ["MENTORA", ""];
      if (pageTitle) pageTitle.textContent = t;
      if (pageSubtitle) pageSubtitle.textContent = s;
      document.body.classList.remove("is-menu-open");
    }

    function routeFromHash() {
      const name = (location.hash || "#dashboard").replace("#", "");
      const allowed = Object.keys(titles);
      showView(allowed.includes(name) ? name : "dashboard");
    }

    window.addEventListener("hashchange", routeFromHash);
    routeFromHash();

    // Mobile menu
    $("#mobileMenuBtn")?.addEventListener("click", () => {
      document.body.classList.toggle("is-menu-open");
    });

    // Logout (only exposed via Settings page)
    function logout() {
      localStorage.clear();
      window.location.replace("index.html");
    }
    const logoutBtnSettings = $("#logoutBtn2");
    if (logoutBtnSettings) logoutBtnSettings.onclick = logout;

    // Quick nav buttons
    $("#goCoursesBtn")?.addEventListener("click", () => (location.hash = "#courses"));
    $("#goPracticeBtn")?.addEventListener("click", () => (location.hash = "#practice"));
    $("#editProfileShortcut")?.addEventListener("click", () => (location.hash = "#profile"));

    // Theme controls
    $("#quickThemeBtn")?.addEventListener("click", () => {
      const current = localStorage.getItem(LS.theme) || "auto";
      const next = current === "auto" ? "dark" : current === "dark" ? "light" : "auto";
      setTheme(next);
      const sel = $("#themeSelect");
      if (sel) sel.value = next;
    });

    const themeSelect = $("#themeSelect");
    if (themeSelect) {
      themeSelect.value = theme;
      themeSelect.addEventListener("change", () => setTheme(themeSelect.value));
    }

    // Reset progress (keep login)
    $("#resetProgressBtn")?.addEventListener("click", () => {
      const ok = confirm("Reset progress? (Courses, roadmap, drafts, quiz score).");
      if (!ok) return;
      const u = getUser();
      const p = loadLS(LS.profile, null);
      localStorage.setItem(LS.user, JSON.stringify(u));
      localStorage.setItem(LS.profile, JSON.stringify(p));
      localStorage.setItem(LS.theme, localStorage.getItem(LS.theme) || "auto");
      saveState(getDefaultState());
      $("#settingsMsg").hidden = false;
      $("#settingsMsg").textContent = "Progress reset (demo).";
      setTimeout(() => ($("#settingsMsg").hidden = true), 2000);
      // re-render
      bootstrapRender();
    });

    // Floating chatbot toggle (available on all views)
    const chatToggle = $("#chatToggleBtn");
    const chatPopup = $("#chatPopup");
    const chatClose = $("#chatCloseBtn");
    if (chatToggle && chatPopup) {
      const setOpen = (open) => {
        chatPopup.classList.toggle("is-open", open);
        chatPopup.setAttribute("aria-hidden", open ? "false" : "true");
      };
      chatToggle.onclick = () => setOpen(!chatPopup.classList.contains("is-open"));
      if (chatClose) chatClose.onclick = () => setOpen(false);
    }

    // Fill topbar user chips
    function renderTopbar(profile, st) {
      $("#navName").textContent = profile.name || "Learner";
      $("#navEmail").textContent = profile.email || user.email || "—";

      $("#streakCount").textContent = String(st.streak.count || 0);
      $("#xpCount").textContent = String(st.xp || 0);
    }

    // Quotes
    function setRandomQuote(data) {
      const quotes = (data.quotes || FALLBACK_DATA.quotes).slice();
      const q = quotes[Math.floor(Math.random() * quotes.length)] || quotes[0] || "Keep going.";
      $("#quoteBox").textContent = `“${q}”`;
    }

    // Boot render after data load
    let DATA = FALLBACK_DATA;

    async function bootstrapRender() {
      const profile = loadLS(LS.profile, getDefaultProfile(user.email));
      const st = getState();
      renderTopbar(profile, st);
      renderDashboard(profile, st);
      renderProfile(profile, st);
      renderSettings();
      renderCommunity(st);
      renderRanks(profile, st);
      renderPractice(st);
      renderAssessment(st);
      renderCourses(st);
      initChatbot(profile);
      setRandomQuote(DATA);
    }

    // -----------------------------
    // Dashboard rendering
    // -----------------------------
    function computeOverallProgress(st) {
      const courses = DATA.courses || [];
      if (!courses.length) return 0;
      const sum = courses.reduce((acc, c) => acc + (st.courseProgress[c.id] || 0), 0);
      return Math.round(sum / courses.length);
    }

    function renderDashboard(profile, st) {
      $("#welcomeTitle").textContent = profile.name ? `Hi, ${profile.name}` : `Hi, ${user.email}`;
      $("#welcomeSubtitle").textContent = `Signed in as ${profile.email || user.email}`;

      const enrolled = (DATA.courses || []).length;
      $("#enrolledCount").textContent = String(enrolled);

      const overall = computeOverallProgress(st);
      $("#overallProgress").textContent = String(overall);
      $("#overallProgressBar").style.width = `${overall}%`;

      $("#dashStreak").textContent = String(st.streak.count || 0);
      const xp = st.xp || 0;
      $("#dashXp").textContent = String(xp);

      const r = computeRank(xp);
      $("#rankName").textContent = r.current;
      $("#rankHint").textContent = r.next ? `Next level at ${r.next} XP.` : "Top level achieved.";

      // Dashboard rank card mirrors current level + XP
      const dashRankName = $("#dashRankName");
      if (dashRankName) dashRankName.textContent = r.current;

      const qBtn = $("#newQuoteBtn");
      if (qBtn) qBtn.onclick = () => setRandomQuote(DATA);
    }

    // -----------------------------
    // Profile
    // -----------------------------
    function renderProfile(profile, st) {
      $("#profileName").value = profile.name || "";
      $("#profileEmail").value = profile.email || user.email || "";
      $("#profileGoal").value = profile.goal || "";
      $("#profileLevel").value = profile.level || "Beginner";

      $("#profileStreak").textContent = String(st.streak.count || 0);
      $("#profileProgress").textContent = String(computeOverallProgress(st));
      $("#profileXp").textContent = String(st.xp || 0);
      $("#profileRank").textContent = computeRank(st.xp || 0).current;

      const form = $("#profileForm");
      if (form)
        form.onsubmit = (e) => {
        e.preventDefault();
        const next = {
          ...profile,
          name: String($("#profileName").value || "").trim() || profile.name,
          goal: String($("#profileGoal").value || "").trim(),
          level: String($("#profileLevel").value || "Beginner")
        };
        saveLS(LS.profile, next);
        $("#profileSaved").hidden = false;
        setTimeout(() => ($("#profileSaved").hidden = true), 1600);
        bootstrapRender();
      };

      const pr = $("#profileResetBtn");
      if (pr)
        pr.onclick = () => {
        const next = getDefaultProfile(user.email);
        saveLS(LS.profile, next);
        bootstrapRender();
      };
    }

    // -----------------------------
    // Courses
    // -----------------------------
    function renderCourses(st) {
      const list = $("#courseList");
      const courses = DATA.courses || [];
      $("#courseCount").textContent = String(courses.length);

      if (!list) return;
      list.innerHTML = "";

      courses.forEach((c) => {
        const p = clamp(st.courseProgress[c.id] || 0, 0, 100);
        const btnLabel = p > 0 ? "Continue" : "Start";

        const el = document.createElement("div");
        el.className = "course";
        el.innerHTML = `
          <div class="course__title">${escapeHtml(c.title)}</div>
          <div class="course__desc">${escapeHtml(c.description)}</div>
          <div class="progress" aria-label="Course progress">
            <div class="progress__bar" style="width:${p}%"></div>
          </div>
          <div class="course__footer">
            <div class="muted tiny"><strong>${p}%</strong> complete</div>
            <button class="btn btn--primary btn--sm" type="button" data-course="${c.id}">
              ${btnLabel}
            </button>
          </div>
        `;
        list.appendChild(el);
      });

      // Current selection
      const selectedId = st.selectedCourseId || courses[0]?.id || null;
      if (selectedId) setCoursePlayer(selectedId);

      list.onclick = (e) => {
        const btn = e.target.closest("button[data-course]");
        if (!btn) return;
        const id = btn.getAttribute("data-course");
        const next = getState();
        next.selectedCourseId = id;
        saveState(next);
        setCoursePlayer(id);
      };
    }

    function setCoursePlayer(courseId) {
      const courses = DATA.courses || [];
      const st = getState();
      const c = courses.find((x) => x.id === courseId);
      if (!c) return;

      const p = clamp(st.courseProgress[c.id] || 0, 0, 100);
      $("#coursePlayerTitle").textContent = c.title;
      $("#courseLessonTitle").textContent = c.lessonTitle || "Lesson content";
      $("#courseLessonBody").textContent = c.lessonBody || "—";
      $("#courseBadge").textContent = p >= 100 ? "Completed" : p > 0 ? "In progress" : "Not started";

      const lessonBtn = $("#lessonCompleteBtn");
      const xpBtn = $("#addXpBtn");
      lessonBtn.disabled = false;
      xpBtn.disabled = false;

      // Render per-course learning path using shared roadmap steps
      renderCourseRoadmap(c.id, st);

      lessonBtn.onclick = () => {
        const next = getState();
        const cur = clamp(next.courseProgress[c.id] || 0, 0, 100);
        const updated = clamp(cur + 10, 0, 100);
        next.courseProgress[c.id] = updated;

        // XP reward for progress (small, consistent)
        next.xp = (next.xp || 0) + 15;
        saveState(next);
        bootstrapRender();
        setCoursePlayer(c.id);
      };

      xpBtn.onclick = () => {
        const next = getState();
        next.xp = (next.xp || 0) + 25;
        saveState(next);
        bootstrapRender();
      };
    }
    // Per-course roadmap (replaces global Roadmap view)
    function renderCourseRoadmap(courseId, st) {
      const list = $("#courseRoadmapList");
      if (!list) return;
      const steps = DATA.roadmap || FALLBACK_DATA.roadmap;
      const doneMap = (st.courseRoadmapDone && st.courseRoadmapDone[courseId]) || {};

      list.innerHTML = "";

      steps.forEach((s) => {
        const done = !!doneMap[s.id];
        const el = document.createElement("div");
        el.className = `step ${done ? "is-done" : ""}`;
        el.innerHTML = `
          <div class="step__top">
            <div>
              <div class="strong">${escapeHtml(s.title)}</div>
              <div class="muted tiny">${escapeHtml(s.desc)}</div>
            </div>
            <button
              class="btn btn--sm ${done ? "btn--ghost" : "btn--primary"}"
              type="button"
              data-course-step="${s.id}"
              data-course-id="${courseId}"
            >
              ${done ? "Completed" : "Mark complete"}
            </button>
          </div>
        `;
        list.appendChild(el);
      });

      list.onclick = (e) => {
        const btn = e.target.closest("button[data-course-step]");
        if (!btn) return;
        const stepId = btn.getAttribute("data-course-step");
        const cid = btn.getAttribute("data-course-id");
        if (!cid || !stepId) return;

        const next = getState();
        next.courseRoadmapDone = next.courseRoadmapDone || {};
        next.courseRoadmapDone[cid] = next.courseRoadmapDone[cid] || {};
        const currentDone = !!next.courseRoadmapDone[cid][stepId];
        next.courseRoadmapDone[cid][stepId] = !currentDone;
        if (!currentDone) {
          // Reward XP only when marking as done
          next.xp = (next.xp || 0) + 30;
        }
        saveState(next);
        bootstrapRender();
        setCoursePlayer(cid);
      };
    }

    // -----------------------------
    // Practice (MCQs + coding)
    // -----------------------------
    function renderPractice(st) {
      renderMCQPractice(st);
      renderCodingPractice(st);
    }

    function renderMCQPractice(st) {
      const box = $("#mcqBox");
      if (!box) return;

      const mcqs = DATA.mcqs || [];
      const idx = Math.floor(Math.random() * mcqs.length);
      const q = mcqs[idx];
      if (!q) {
        box.innerHTML = `<div class="muted">No MCQs available.</div>`;
        return;
      }

      box.innerHTML = `
        <div class="mcq">
          <div class="mcq__q">${escapeHtml(q.question)}</div>
          <div class="mcq__choices" id="mcqChoices"></div>
          <div class="divider mt-14"></div>
          <div class="muted tiny" id="mcqExplain">Choose an answer to see feedback.</div>
          <div class="row row--gap mt-12">
            <button class="btn btn--ghost btn--sm" type="button" id="nextMcqBtn">Next question</button>
          </div>
        </div>
      `;

      const choices = $("#mcqChoices");
      const explain = $("#mcqExplain");

      q.choices.forEach((label, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choice";
        b.textContent = label;
        b.addEventListener("click", () => {
          // lock choices after one click
          $$(".choice", box).forEach((x) => (x.disabled = true));
          const isCorrect = i === q.answerIndex;
          b.classList.add(isCorrect ? "is-correct" : "is-wrong");
          // also highlight correct answer
          const correctBtn = $$(".choice", box)[q.answerIndex];
          correctBtn?.classList.add("is-correct");

          if (isCorrect) {
            const next = getState();
            next.xp = (next.xp || 0) + 20;
            saveState(next);
            explain.textContent = `Correct! +20 XP. ${q.explain || ""}`;
            bootstrapRender();
          } else {
            explain.textContent = `Not quite. ${q.explain || "Review the concept and try again."}`;
          }
        });
        choices.appendChild(b);
      });

      const nextBtn = $("#nextMcqBtn");
      if (nextBtn) nextBtn.onclick = () => renderMCQPractice(getState());
    }

    function renderCodingPractice(st) {
      const sel = $("#codingSelect");
      if (!sel) return;

      const items = DATA.coding || [];
      sel.innerHTML = `<option value="">Choose question…</option>`;
      items.forEach((q) => {
        const opt = document.createElement("option");
        opt.value = q.id;
        opt.textContent = q.title;
        sel.appendChild(opt);
      });

      // Restore last used if any draft exists
      const firstDraft = Object.keys(st.codingDrafts || {})[0];
      if (firstDraft && items.find((x) => x.id === firstDraft)) {
        sel.value = firstDraft;
        setCodingQuestion(firstDraft);
      }

      sel.onchange = () => setCodingQuestion(sel.value);

      const saveBtn = $("#saveCodeBtn");
      if (saveBtn)
        saveBtn.onclick = () => {
        const id = sel.value;
        if (!id) return;
        const next = getState();
        next.codingDrafts[id] = String($("#codeEditor").value || "");
        saveState(next);
        $("#codeSaved").hidden = false;
        setTimeout(() => ($("#codeSaved").hidden = true), 1400);
      };

      const clearBtn = $("#clearCodeBtn");
      if (clearBtn)
        clearBtn.onclick = () => {
        $("#codeEditor").value = "";
      };
    }

    function setCodingQuestion(id) {
      const q = (DATA.coding || []).find((x) => x.id === id);
      const st = getState();
      if (!q) {
        $("#codingQuestion").textContent = "Select a question";
        $("#codingInput").textContent = "—";
        $("#codingOutput").textContent = "—";
        $("#codeEditor").value = "";
        return;
      }
      $("#codingQuestion").textContent = q.question;
      $("#codingInput").textContent = q.sampleInput;
      $("#codingOutput").textContent = q.sampleOutput;
      $("#codeEditor").value = st.codingDrafts?.[id] || "";
    }

    // -----------------------------
    // Assessment
    // -----------------------------
    let assessmentTimer = null;
    let assessmentEndsAt = null;

    function renderAssessment(st) {
      const last = st.assessment?.lastScore;
      const at = st.assessment?.lastTakenAt;
      $("#lastScoreText").textContent = last == null ? "" : `Last score: ${last}% (${new Date(at).toLocaleString()})`;

      $("#timerText").textContent = "Ready";
      $("#assessmentBox").innerHTML = `<div class="muted">Click “Start assessment” to begin.</div>`;
      $("#assessmentResult").hidden = true;
      $("#assessmentResult").innerHTML = "";

      const startBtn = $("#startAssessmentBtn");
      if (startBtn) startBtn.onclick = startAssessment;
      const resetBtn = $("#resetAssessmentBtn");
      if (resetBtn)
        resetBtn.onclick = () => {
        stopTimer();
        renderAssessment(getState());
      };
    }

    function startAssessment() {
      stopTimer();

      const qz = DATA.assessment || FALLBACK_DATA.assessment;
      const questions = qz.questions || [];
      const totalSeconds = qz.timeSeconds || 60;
      assessmentEndsAt = Date.now() + totalSeconds * 1000;

      const box = $("#assessmentBox");
      box.innerHTML = "";

      questions.forEach((q, idx) => {
        const el = document.createElement("div");
        el.className = "quiz-q";
        el.innerHTML = `
          <div class="quiz-q__title">Q${idx + 1}. ${escapeHtml(q.question)}</div>
          <div class="quiz-q__choices">
            ${q.choices
              .map(
                (c, i) => `
                  <label class="choice" style="display:flex; gap:10px; align-items:center;">
                    <input type="radio" name="assess_${q.id}" value="${i}" />
                    <span>${escapeHtml(c)}</span>
                  </label>
                `
              )
              .join("")}
          </div>
        `;
        box.appendChild(el);
      });

      const submitRow = document.createElement("div");
      submitRow.className = "row row--gap mt-14";
      submitRow.innerHTML = `
        <button class="btn btn--primary" type="button" id="submitAssessmentBtn">Submit</button>
        <div class="muted tiny">Tip: Don’t rush — review each question once.</div>
      `;
      box.appendChild(submitRow);

      $("#submitAssessmentBtn")?.addEventListener("click", submitAssessment);

      tickTimer(); // immediate
      assessmentTimer = setInterval(tickTimer, 250);
    }

    function stopTimer() {
      if (assessmentTimer) clearInterval(assessmentTimer);
      assessmentTimer = null;
      assessmentEndsAt = null;
    }

    function tickTimer() {
      if (!assessmentEndsAt) return;
      const ms = assessmentEndsAt - Date.now();
      const s = Math.max(0, Math.ceil(ms / 1000));
      $("#timerText").textContent = `${s}s`;
      if (s <= 0) {
        submitAssessment(true);
      }
    }

    function submitAssessment(isAuto = false) {
      if (!assessmentEndsAt) return;
      stopTimer();

      const qz = DATA.assessment || FALLBACK_DATA.assessment;
      const questions = qz.questions || [];

      let correct = 0;
      const answers = [];
      questions.forEach((q) => {
        const chosen = document.querySelector(`input[name="assess_${q.id}"]:checked`);
        const val = chosen ? Number(chosen.value) : null;
        const ok = val === q.answerIndex;
        if (ok) correct += 1;
        answers.push({ id: q.id, chosen: val, correctIndex: q.answerIndex });
      });

      const scorePct = Math.round((correct / Math.max(1, questions.length)) * 100);

      const st = getState();
      st.assessment.lastScore = scorePct;
      st.assessment.lastTakenAt = Date.now();

      // Reward XP based on score
      const bonus = Math.round((scorePct / 100) * 80); // up to 80 XP
      st.xp = (st.xp || 0) + bonus;
      saveState(st);

      const result = $("#assessmentResult");
      result.hidden = false;
      result.innerHTML = `
        <div class="quiz-result">
          <div class="row row--between row--gap">
            <div>
              <div class="strong">Score: ${scorePct}%</div>
              <div class="muted tiny">${isAuto ? "Time’s up — auto submitted." : "Submitted."} +${bonus} XP</div>
            </div>
            <span class="badge">Saved</span>
          </div>
          <div class="divider mt-14"></div>
          <div class="muted tiny mt-12 strong">Correct answers</div>
          <div class="mt-10">
            ${questions
              .map((q, i) => {
                const a = answers[i];
                const chosenLabel = a.chosen == null ? "Not answered" : q.choices[a.chosen];
                const correctLabel = q.choices[a.correctIndex];
                const ok = a.chosen === a.correctIndex;
                return `
                  <div class="comment">
                    <div class="strong">Q${i + 1}. ${escapeHtml(q.question)}</div>
                    <div class="muted tiny">Your answer: ${escapeHtml(chosenLabel)}</div>
                    <div class="muted tiny">Correct: ${escapeHtml(correctLabel)} ${ok ? "✓" : "✗"}</div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `;

      // Re-render stats/ranks
      bootstrapRender();
      // Keep view
      location.hash = "#assessment";
    }

    // -----------------------------
    // Community
    // -----------------------------
    function renderCommunity(st) {
      const list = $("#communityList");
      if (!list) return;
      const posts = DATA.community || [];
      const likes = st.community?.likes || {};
      const comments = st.community?.comments || {};
      list.innerHTML = "";

      posts.forEach((p) => {
        const likeCount = likes[p.id] || 0;
        const postComments = comments[p.id] || [];
        const el = document.createElement("div");
        el.className = "post";
        el.innerHTML = `
          <div class="post__meta">
            <div>
              <div class="post__title">${escapeHtml(p.title)}</div>
              <div class="muted tiny">by ${escapeHtml(p.author)}</div>
            </div>
            <span class="badge">Demo</span>
          </div>
          <p class="muted" style="margin:10px 0 0; line-height:1.5;">${escapeHtml(p.body)}</p>
          <div class="post__actions">
            <button class="mini-btn" type="button" data-like="${p.id}">👍 Like <span class="muted">(${likeCount})</span></button>
            <span class="muted tiny">Comments: ${postComments.length}</span>
          </div>
          <div class="comment-box">
            <input type="text" placeholder="Write a comment (demo)..." data-comment-input="${p.id}" />
            <button class="btn btn--primary btn--sm" type="button" data-comment-btn="${p.id}">Post</button>
          </div>
          <div>
            ${postComments.map((c) => `<div class="comment">${escapeHtml(c)}</div>`).join("")}
          </div>
        `;
        list.appendChild(el);
      });

      list.onclick = (e) => {
        const likeBtn = e.target.closest("button[data-like]");
        const cBtn = e.target.closest("button[data-comment-btn]");
        if (likeBtn) {
          const id = likeBtn.getAttribute("data-like");
          const next = getState();
          next.community.likes[id] = (next.community.likes[id] || 0) + 1;
          saveState(next);
          renderCommunity(next);
          return;
        }
        if (cBtn) {
          const id = cBtn.getAttribute("data-comment-btn");
          const input = list.querySelector(`input[data-comment-input="${id}"]`);
          const text = String(input?.value || "").trim();
          if (!text) return;
          const next = getState();
          next.community.comments[id] = next.community.comments[id] || [];
          next.community.comments[id].push(text);
          saveState(next);
          renderCommunity(next);
        }
      };
    }

    // -----------------------------
    // Ranks + leaderboard
    // -----------------------------
    function renderRanks(profile, st) {
      const xp = st.xp || 0;
      const r = computeRank(xp);

      $("#rankPanelName").textContent = r.current;
      $("#rankPanelXp").textContent = String(xp);
      $("#rankPanelHint").textContent = r.next ? `Next level at ${r.next} XP.` : "You’re at the top level.";
      $("#rankProgressBar").style.width = `${r.pct}%`;
      $("#rankProgressText").textContent = r.next ? `${Math.round(r.pct)}% to next level` : "100%";

      // Leaderboard: static users + current user
      const base = (DATA.leaderboard || []).map((u) => ({ ...u }));
      base.push({ name: profile.name || "You", xp });
      base.sort((a, b) => b.xp - a.xp);

      const lb = $("#leaderboard");
      if (!lb) return;
      lb.innerHTML = "";

      base.forEach((u, i) => {
        const row = document.createElement("div");
        const isYou = u.xp === xp && (u.name === (profile.name || "You"));
        row.className = `lb-row ${isYou ? "is-you" : ""}`;
        row.innerHTML = `
          <div class="lb-rank">${i + 1}</div>
          <div>
            <div class="strong">${escapeHtml(u.name)} ${isYou ? '<span class="badge" style="margin-left:8px;">You</span>' : ""}</div>
            <div class="muted tiny">${computeRank(u.xp).current}</div>
          </div>
          <div class="chip chip--soft">✨ ${u.xp} XP</div>
        `;
        lb.appendChild(row);
      });
    }

    // -----------------------------
    // Settings misc
    // -----------------------------
    function renderSettings() {
      // currently handled by listeners above
    }

    // -----------------------------
    // Chatbot
    // -----------------------------
    function initChatbot(profile) {
      const log = $("#chatLog");
      const form = $("#chatForm");
      const input = $("#chatText");

      if (!log || !form || !input) return;

      // Initialize once
      if (!log.dataset.ready) {
        log.dataset.ready = "1";
        addBotMessage(
          log,
          `Hi ${profile.name || "there"}! I’m MENTORA — your learning companion. Ask me for a study plan, course recommendations, or motivation.`
        );
      }

      const replies = [
        {
          keys: ["plan", "study", "schedule"],
          text:
            "Here’s a simple plan: 25 minutes focused study → 5 minutes break, repeat 3 times. End with 10 minutes of review + one MCQ. Consistency wins."
        },
        {
          keys: ["streak", "consistent", "habit"],
          text:
            "To keep your streak: set a tiny daily minimum (10 minutes). Do it even on busy days. The goal is to never break the chain."
        },
        {
          keys: ["course", "recommend"],
          text:
            "Recommendation: start with Frontend Foundations. Complete one small lesson, then do 1–2 MCQs to reinforce. Progress + practice = retention."
        },
        {
          keys: ["motivate", "motivation", "tired"],
          text:
            "You don’t need perfect days — you need repeatable days. Do the next small step. Your future self benefits from today’s consistency."
        },
        {
          keys: ["stuck", "confused", "help"],
          text:
            "When you feel stuck: write what you know, what you don’t, and what you tried. Then reduce the problem to the smallest next question."
        },
        {
          keys: ["roadmap", "path"],
          text:
            "Roadmap is a staged path: Basics → Intermediate → Projects. Mark steps complete to build momentum. Projects are where learning becomes skill."
        }
      ];

      form.onsubmit = (e) => {
        e.preventDefault();
        const text = String(input.value || "").trim();
        if (!text) return;
        input.value = "";
        addUserMessage(log, text);

        const lower = text.toLowerCase();
        const match =
          replies.find((r) => r.keys.some((k) => lower.includes(k))) ||
          ({
            text:
              "I can help with: study plan, streak habits, course recommendations, roadmap guidance, and motivation. Try: “Make me a study plan”."
          });
        addBotMessage(log, match.text, { typing: true });
      };

      $$(".prompt").forEach((b) => {
        b.onclick = () => {
          const t = b.getAttribute("data-prompt") || "";
          input.value = t;
          input.focus();
        };
      });
    }

    function addUserMessage(log, text) {
      const el = document.createElement("div");
      el.className = "bubble bubble--user";
      el.textContent = text;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    }

    function addBotMessage(log, text, opts = {}) {
      const el = document.createElement("div");
      el.className = "bubble bubble--bot";
      log.appendChild(el);

      if (!opts.typing) {
        el.textContent = text;
        log.scrollTop = log.scrollHeight;
        return;
      }

      // Typing effect
      el.textContent = "";
      const chars = Array.from(text);
      let i = 0;
      const step = () => {
        el.textContent += chars[i] || "";
        i += 1;
        log.scrollTop = log.scrollHeight;
        if (i < chars.length) setTimeout(step, 12);
      };
      setTimeout(step, 120);
    }

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    // Start: load data then render
    loadMockData().then((d) => {
      DATA = d || FALLBACK_DATA;
      bootstrapRender();
    });
  }

  // -----------------------------
  // Boot by page
  // -----------------------------
  const isLogin = !!document.querySelector("#loginForm");
  const isApp = !!document.querySelector(".app-shell");

  if (isLogin) initLoginPage();
  if (isApp) initDashboardApp();
})();

