(function () {
  const STORAGE_KEY = 'fitness-static-plan-v1';
  const PROGRESS_KEY = 'fitness-static-progress-v1';
  const NAV_ITEMS = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'plan', label: 'Plan', icon: '💪' },
    { id: 'meals', label: 'Meals', icon: '🍽️' },
    { id: 'tips', label: 'Tips', icon: '💡' },
    { id: 'import', label: 'Import', icon: '⬆️' }
  ];

  const ROADMAP = [
    { period: 'Week 1–2', detail: '20 min easy jog (Wed) + 20 min long jog (Sat)', color: '#5affb0' },
    { period: 'Week 3–4', detail: '20 min easy jog (Wed) + 25 min long jog (Sat)', color: '#5affb0' },
    { period: 'Month 2', detail: '25 min easy jog (Wed) + 30 min long jog (Sat)', color: '#ffb347' },
    { period: 'Month 3', detail: '25 min easy jog (Wed) + 35 min long jog (Sat)', color: '#ffb347' },
    { period: 'Month 4+', detail: '30 min easy jog (Wed) + 40–45 min long jog (Sat)', color: '#ff5a5a' }
  ];

  const CHECKLIST = [
    'Hit all 5 strength sessions',
    'Complete both jogs (Wed + Sat)',
    'Eat all 7 meals every day',
    'Extra carbs on cardio days',
    'Drink 3L of water daily',
    'Sleep 8–9 hours nightly',
    'Weigh in on Sunday morning'
  ];

  const appState = {
    ready: false,
    error: '',
    page: 'home',
    activeDay: 0,
    expandedMeal: null,
    plan: null,
    defaultPlan: null,
    importStatus: { type: 'info', message: 'Import a .jsx, .js, .json, or .html plan file.' },
    lastFileName: '',
    completedDays: 0,
    deferredInstallPrompt: null
  };

  function el() {
    return document.getElementById('app');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readStoredPlan() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStoredPlan(plan) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }

  function clearStoredPlan() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function readStoredProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      return raw ? Math.max(0, Number(JSON.parse(raw)) || 0) : 0;
    } catch (error) {
      return 0;
    }
  }

  function writeStoredProgress(value) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(Math.max(0, Number(value) || 0)));
  }

  function totalDays(plan) {
    return Math.max(1, (plan && plan.days && plan.days.length) || 7);
  }

  function getProgressPercent(plan) {
    return Math.round((Math.min(appState.completedDays, totalDays(plan)) / totalDays(plan)) * 100);
  }

  function markDayDone(plan) {
    appState.completedDays = Math.min(totalDays(plan), (appState.completedDays || 0) + 1);
    writeStoredProgress(appState.completedDays);
  }

  function undoDayDone() {
    appState.completedDays = Math.max(0, (appState.completedDays || 0) - 1);
    writeStoredProgress(appState.completedDays);
  }

  function weekIcon(day) {
    if (!day) return '•';
    if (day.tag === 'REST DAY') return '💤';
    if (day.cardio && (!day.exercises || day.exercises.length === 0)) return '🏃';
    if (day.cardio) return '🏃+💪';
    return '💪';
  }

  function intensityBar(intensity) {
    const levels = { EASY: 1, MODERATE: 2, HARD: 3 };
    const colors = { EASY: '#5affb0', MODERATE: '#ffb347', HARD: '#ff5a5a' };
    const count = levels[intensity] || 1;
    const color = colors[intensity] || colors.EASY;

    return '<div class="intensity-wrap">' +
      [1, 2, 3].map((i) => '<div class="bar" style="background:' + (i <= count ? color : '#252525') + '"></div>').join('') +
      '<span class="intensity-text" style="color:' + color + '">' + escapeHtml(intensity) + '</span>' +
      '</div>';
  }

  function getPlan() {
    return appState.plan || appState.defaultPlan || window.FitnessParser.DEFAULT_PLAN;
  }

  function getDay() {
    const plan = getPlan();
    const max = Math.max(0, (plan.days || []).length - 1);
    if (appState.activeDay > max) appState.activeDay = 0;
    return (plan.days || [])[appState.activeDay] || null;
  }

  function renderHeader(plan) {
    const subtitle = plan.meta.subtitle || 'Imported training plan';
    return '<div class="header tracker-header">' +
      '<div class="tracker-kicker">PERSONAL FITNESS TRACKER</div>' +
      '<h1 class="tracker-title">YOUR PLAN</h1>' +
      '<div class="tracker-weekline">' + escapeHtml(subtitle) + '</div>' +
    '</div>';
  }

  function renderWeekStrip(plan) {
    return '<div class="week-strip tracker-week-strip">' +
      '<div class="section-label">WEEK AT A GLANCE</div>' +
      '<div class="week-grid">' +
        (plan.days || []).map((day, index) => '<div class="week-day"><button class="week-day-button' + (appState.activeDay === index ? ' active' : '') + '" data-day-index="' + index + '"><div class="week-day-label">' + escapeHtml(day.label) + '</div><div class="week-icon tracker-week-icon" style="background:' + (day.tag === 'REST DAY' ? '#191919' : (day.color + '16')) + ';border:1px solid ' + (day.tag === 'REST DAY' ? '#2a2a2a' : (day.color + '33')) + '">' + weekIcon(day) + '</div></button></div>').join('') +
      '</div>' +
    '</div>';
  }

  function renderHomePage(plan) {
    const day = getDay() || (plan.days || [])[0] || null;
    const total = totalDays(plan);
    const done = Math.min(appState.completedDays || 0, total);
    const progress = getProgressPercent(plan);
    const topStats = (plan.stats || []).slice(0, 4);
    const tips = (plan.tips || []).slice(0, 3);
    const mealCount = (plan.meals || []).length;
    const exerciseCount = day && day.exercises ? day.exercises.length : 0;

    return '<div class="page tracker-home"><div class="page-stack">' +
      '<div class="tracker-card install-card">' +
        '<div class="tracker-card-heading">Install as an App</div>' +
        '<div class="tracker-copy">Tap the button below to add this to your home screen.</div>' +
        '<button class="action-btn tracker-primary-btn" id="a2hs-btn">Add to Home Screen</button>' +
      '</div>' +
      '<div class="tracker-card progress-card">' +
        '<div class="section-heading">WEEKLY PROGRESS</div>' +
        '<div class="progress-row"><div class="progress-number">' + escapeHtml(progress) + '%</div><div class="progress-meta">Days done ' + escapeHtml(done) + ' / ' + escapeHtml(total) + '</div></div>' +
        '<div class="progress-meter"><div class="progress-fill" style="width:' + progress + '%"></div></div>' +
        '<div class="import-row tracker-action-row"><button class="ghost-btn" id="undo-day-btn">− Undo</button><button class="action-btn" id="log-day-btn">✓ Log Day Done</button></div>' +
      '</div>' +
      '<div class="tracker-summary-grid">' +
        topStats.map((item) => '<div class="tracker-stat-card"><div class="tracker-stat-label">' + escapeHtml(item.label || '') + '</div><div class="tracker-stat-value">' + escapeHtml(item.value || '') + '</div></div>').join('') +
      '</div>' +
      '<div class="section-heading">TODAY</div>' +
      '<div class="tracker-card today-card">' +
        (day ? '<div class="today-name">' + escapeHtml(day.name || 'Today') + '</div><div class="today-focus">' + escapeHtml(day.focus || day.tag || '') + '</div><div class="today-chip-row"><span class="today-chip">' + escapeHtml(day.tag || 'TRAINING DAY') + '</span>' + (day.cardio ? '<span class="today-chip">' + escapeHtml(day.cardio.duration || '') + ' cardio</span>' : '') + '</div><div class="tracker-copy">This screen is driven by the imported plan. Tap Plan for the full exercise list or Meals for the current day nutrition structure.</div><div class="import-row tracker-action-row"><button class="small-btn" data-nav="plan">Exercise Schedule</button><button class="small-btn" data-nav="meals">Meal Plan</button></div><div class="today-macro-grid"><div class="today-macro"><div class="today-macro-label">Calories</div><div class="today-macro-value">' + escapeHtml((topStats[0] && topStats[0].value) || '—') + '</div></div><div class="today-macro"><div class="today-macro-label">Protein</div><div class="today-macro-value">' + escapeHtml((topStats[1] && topStats[1].value) || '—') + '</div></div></div>' : '<div class="tracker-copy">Import a plan to populate today training details.</div>') +
      '</div>' +
      '<div class="tracker-card plan-overview-card">' +
        '<div class="tracker-home-grid-2"><div><div class="tracker-card-heading">Exercise Schedule</div><div class="tracker-copy">' + escapeHtml((plan.days || []).length) + '-day programme · ' + escapeHtml(exerciseCount) + ' items on the selected day</div></div><div><div class="tracker-card-heading">Meal Plan</div><div class="tracker-copy">' + escapeHtml(mealCount) + ' meals loaded from the current plan structure</div></div></div>' +
      '</div>' +
      '<div class="tracker-card guidelines-card">' +
        '<div class="section-heading">KEY GUIDELINES</div>' +
        tips.map((tip) => '<div class="guideline-row"><span class="guideline-icon">•</span><div class="tracker-copy">' + escapeHtml(tip.title || tip.body || '') + '</div></div>').join('') +
      '</div>' +
      '<div class="tracker-card health-note-card">' +
        '<div class="section-heading">⚠ HEALTH NOTE</div>' +
        '<div class="tracker-copy">Consult your GP before starting, especially for cardiovascular work. This plan is general guidance — adjust based on your response. Stop if you feel chest pain, dizziness, or unusual breathlessness.</div>' +
      '</div>' +
      '<div class="tracker-card import-teaser-card">' +
        '<div class="tracker-card-heading">Import Plan</div><div class="tracker-copy">Upload any fitness plan HTML, JSON, or JSX file. The parser extracts the structure and rebuilds the rest of the app.</div><div class="import-row tracker-action-row"><button class="action-btn" data-nav="import">Open Import Page</button></div>' +
      '</div>' +
    '</div></div>';
  }

  function renderPlanPage(plan) {
    const day = getDay();

    if (!day) {
      return '<div class="page"><div class="empty-card panel home-intro"><div class="empty-title">No training days yet</div><div class="empty-copy">Import a plan file to populate the weekly plan.</div></div></div>';
    }

    return '<div class="page"><div class="page-stack">' +
      '<div class="day-pills">' +
        (plan.days || []).map((item, index) => '<button class="pill" data-day-index="' + index + '" style="background:' + (appState.activeDay === index ? item.color : '#1a1a1a') + ';border-color:' + (appState.activeDay === index ? item.color : '#252525') + ';color:' + (appState.activeDay === index ? '#111' : '#ddd') + '"><div class="pill-label" style="color:' + (appState.activeDay === index ? '#111' : '#888') + '">' + escapeHtml(item.label) + '</div></button>').join('') +
      '</div>' +
      '<div class="day-header" style="border-left-color:' + escapeHtml(day.color || '#e8ff5a') + '">' +
        '<div class="tag" style="color:' + escapeHtml(day.color || '#e8ff5a') + '">' + escapeHtml(day.tag || '') + '</div>' +
        '<div class="day-title">' + escapeHtml(day.name || '') + '</div>' +
        '<div class="day-focus">' + escapeHtml(day.focus || '') + '</div>' +
      '</div>' +
      (day.cardio ? renderCardio(day) : '') +
      (day.cardio && day.exercises && day.exercises.length ? '<div class="tiny-label">STRENGTH EXERCISES — AFTER JOG</div>' : '') +
      (day.exercises && day.exercises.length ? renderExerciseBlock(day) : '') +
      (day.tag === 'REST DAY' ? '<div class="panel home-intro"><div class="home-intro-title">Full Rest Day</div><div class="home-intro-copy">Eat well, sleep 8–9 hours, and let your body do its job. Recovery is part of the plan.</div></div>' : '') +
    '</div></div>';
  }

  function renderCardio(day) {
    return '<div class="cardio-block" style="border-left-color:' + escapeHtml(day.cardio.intensityColor || day.color || '#5affb0') + '">' +
      '<div class="cardio-top">' +
        '<div class="row"><span class="cardio-icon">' + escapeHtml(day.cardio.icon || '🏃') + '</span><div><div class="cardio-title">' + escapeHtml(day.cardio.type || 'Cardio') + '</div><div class="cardio-meta">' + escapeHtml(day.cardio.zone || '') + ' · ' + escapeHtml(day.cardio.duration || '') + '</div></div></div>' +
        intensityBar(day.cardio.intensity || 'EASY') +
      '</div>' +
      (day.cardio.steps || []).map((step) => '<div class="step-row"><div class="step-time" style="color:' + escapeHtml(day.cardio.intensityColor || '#5affb0') + '">' + escapeHtml(step.duration || '') + '</div><div><div class="step-title">' + escapeHtml(step.phase || '') + '</div><div class="step-detail">' + escapeHtml(step.detail || '') + '</div></div></div>').join('') +
      '<div class="cardio-note"><span style="color:' + escapeHtml(day.cardio.intensityColor || '#5affb0') + ';font-weight:700">🕐 When: </span>' + escapeHtml(day.cardio.when || '') + '<br><span style="color:' + escapeHtml(day.cardio.intensityColor || '#5affb0') + ';font-weight:700">💡 Pace: </span>' + escapeHtml(day.cardio.pace || '') + '</div>' +
    '</div>';
  }

  function renderExerciseBlock(day) {
    return '<div>' +
      (day.tag !== 'REST DAY' ? '<div class="exercise-header"><div style="width:30px"></div><div style="flex:1">EXERCISE</div><div class="col-weight" style="width:80px;text-align:right;color:#e8ff5a;letter-spacing:1px">WEIGHT</div><div class="col-sets" style="width:60px;text-align:right;letter-spacing:1px">SETS×REPS</div></div>' : '') +
      '<div class="exercise-list">' +
        (day.exercises || []).map((exercise, index) => '<div class="exercise-card"><div class="num-badge" style="background:' + escapeHtml((day.color || '#e8ff5a') + '18') + ';border:1px solid ' + escapeHtml((day.color || '#e8ff5a') + '35') + ';color:' + escapeHtml(day.color || '#e8ff5a') + '">' + escapeHtml(exercise.sets !== '—' ? (index + 1) : '—') + '</div><div class="exercise-main"><div class="exercise-name-row"><div class="exercise-name">' + escapeHtml(exercise.name || '') + '</div>' + (exercise.eq && exercise.eq !== '—' ? '<span>' + escapeHtml(exercise.eq) + '</span>' : '') + '</div>' + (exercise.note ? '<div class="exercise-note">' + escapeHtml(exercise.note) + '</div>' : '') + '</div>' + (exercise.weight && exercise.weight !== '—' ? '<div class="weight-chip"><div class="weight-value">' + escapeHtml(exercise.weight) + '</div><div class="weight-label">START</div></div>' : '') + (exercise.sets && exercise.sets !== '—' ? '<div class="sets-block"><div class="sets-main" style="color:' + escapeHtml(day.color || '#e8ff5a') + '">' + escapeHtml(exercise.sets) + '×' + escapeHtml(exercise.reps || '') + '</div><div class="sets-rest">' + escapeHtml(exercise.rest || '') + '</div></div>' : '') + '</div>').join('') +
      '</div>' +
    '</div>';
  }

  function renderMealsPage(plan) {
    const totalKcal = (plan.meals || []).reduce((sum, meal) => sum + (Number(meal.kcal) || 0), 0);
    const totalProtein = (plan.meals || []).reduce((sum, meal) => sum + (Number(meal.protein) || 0), 0);
    const totalCarbs = (plan.meals || []).reduce((sum, meal) => sum + (Number(meal.carbs) || 0), 0);
    const totalFat = (plan.meals || []).reduce((sum, meal) => sum + (Number(meal.fat) || 0), 0);

    return '<div class="page"><div class="page-stack">' +
      '<div class="macro-card"><div class="kicker">DAILY MACRO TARGETS</div><div class="macro-grid">' +
        [
          { label: 'Calories', val: totalKcal, unit: 'kcal', color: '#e8ff5a', width: '100%' },
          { label: 'Protein', val: totalProtein, unit: 'g', color: '#5affb0', width: '55%' },
          { label: 'Carbs', val: totalCarbs, unit: 'g', color: '#5ab4ff', width: '78%' },
          { label: 'Fat', val: totalFat, unit: 'g', color: '#ff8c5a', width: '32%' }
        ].map((item) => '<div class="macro-item"><div class="macro-value" style="color:' + item.color + '">' + escapeHtml(item.val) + '</div><div class="macro-unit">' + escapeHtml(item.unit) + '</div><div class="meter"><div class="meter-fill" style="width:' + item.width + ';background:' + item.color + '"></div></div><div class="macro-label">' + escapeHtml(item.label.toUpperCase()) + '</div></div>').join('') +
      '</div></div>' +
      '<div class="pink-note"><span style="color:#ff5a8a;font-weight:700">🏃 Cardio days:</span> Add a banana or toast to your pre-workout snack to stay in a calorie surplus on running days.</div>' +
      '<div class="meal-list">' +
        (plan.meals || []).map((meal, index) => {
          const open = appState.expandedMeal === index;
          return '<div class="meal-card ' + (open ? 'open' : '') + '">' +
            '<button class="meal-head" data-meal-index="' + index + '"><div class="meal-icon">' + escapeHtml(meal.icon || '🍽️') + '</div><div class="meal-main"><div class="meal-name">' + escapeHtml(meal.name || '') + '</div><div class="meal-time">' + escapeHtml(meal.time || '') + '</div></div><div class="meal-kcal"><div class="meal-kcal-value">' + escapeHtml(meal.kcal || 0) + '</div><div class="meal-kcal-unit">kcal</div></div><div class="meal-arrow">▶</div></button>' +
            (open ? '<div class="meal-body"><div class="meal-macros">' +
              [
                { label: 'Protein', value: meal.protein + 'g', color: '#5affb0' },
                { label: 'Carbs', value: meal.carbs + 'g', color: '#5ab4ff' },
                { label: 'Fat', value: meal.fat + 'g', color: '#ff8c5a' }
              ].map((item) => '<div class="meal-macro"><div class="meal-macro-value" style="color:' + item.color + '">' + escapeHtml(item.value) + '</div><div class="meal-macro-label">' + escapeHtml(item.label) + '</div></div>').join('') +
            '</div><div class="meal-items">' +
              (meal.items || []).map((item) => '<div class="meal-item"><div class="dot"></div><div class="meal-item-text">' + escapeHtml(item) + '</div></div>').join('') +
            '</div><div class="tip-box"><span style="color:#e8ff5a">💡 </span>' + escapeHtml(meal.tip || '') + '</div></div>' : '') +
          '</div>';
        }).join('') +
      '</div>' +
    '</div></div>';
  }

  function renderTipsPage(plan) {
    return '<div class="page"><div class="page-stack">' +
      '<div class="tips-list">' +
        (plan.tips || []).map((tip) => '<div class="tip-card" style="border-left-color:' + escapeHtml(tip.color || '#e8ff5a') + '"><div class="tip-head"><span class="tip-icon">' + escapeHtml(tip.icon || '💡') + '</span><div class="tip-title">' + escapeHtml(tip.title || '') + '</div></div><div class="tip-copy">' + escapeHtml(tip.body || '') + '</div></div>').join('') +
      '</div>' +
      '<div class="roadmap"><div class="kicker">🏃 JOGGING PROGRESSION ROADMAP</div>' +
        ROADMAP.map((row) => '<div class="roadmap-row"><div class="roadmap-period" style="color:' + row.color + '">' + escapeHtml(row.period) + '</div><div class="roadmap-detail">' + escapeHtml(row.detail) + '</div></div>').join('') +
      '</div>' +
      '<div class="checklist"><div class="kicker">WEEKLY SUCCESS CHECKLIST</div>' +
        CHECKLIST.map((item) => '<div class="check-row"><div class="check-box"></div><div class="check-text">' + escapeHtml(item) + '</div></div>').join('') +
      '</div>' +
    '</div></div>';
  }

  function renderImportPage(plan) {
    const status = appState.importStatus || { type: 'info', message: 'Import a .jsx, .js, .json, or .html plan file.' };
    const preview = JSON.stringify({
      meta: plan.meta,
      equipment: (plan.equipment || []).slice(0, 3),
      days: (plan.days || []).slice(0, 2),
      meals: (plan.meals || []).slice(0, 1),
      tips: (plan.tips || []).slice(0, 1)
    }, null, 2);

    return '<div class="page"><div class="page-stack">' +
      '<div class="import-card"><div class="import-card-title">Import a JSX or HTML plan</div><div class="import-card-copy">Upload the file you want to use as the source of truth. The parser reads the plan data and rebuilds Home, Plan, Meals, and Tips from that structure.</div></div>' +
      '<div class="import-help"><div class="kicker">SUPPORTED FILES</div><div class="import-card-copy">.jsx, .js, .json, .html, .htm. Best results come from files that contain <code>equipment</code>, <code>days</code>, <code>meals</code>, and <code>tips</code> arrays or a <code>&lt;script id="fitness-plan-data" type="application/json"&gt;</code> block.</div></div>' +
      '<div class="import-actions"><div class="import-label">UPLOAD FILE</div><input class="import-input" id="plan-file-input" type="file" accept=".jsx,.js,.json,.html,.htm,.tsx" /><div style="height:12px"></div><div class="import-row"><button class="action-btn" id="import-sample-btn">Load default plan</button><button class="ghost-btn" id="reset-plan-btn">Reset local changes</button><button class="ghost-btn" id="download-plan-btn">Download current JSON</button></div><div style="height:14px"></div><div class="status-pill ' + escapeHtml(status.type || 'info') + '">' + escapeHtml(status.message || '') + '</div></div>' +
      '<div class="import-preview"><div class="kicker">CURRENT PLAN PREVIEW</div><pre class="preview-code">' + escapeHtml(preview) + '</pre></div>' +
      '<div class="import-help"><div class="kicker">HOW THE REST OF THE APP CHANGES</div><div class="import-card-copy">The app does not paste imported markup across pages. It extracts structured plan data, saves it locally, and re-renders the rest of the pages from that schema. That is what keeps the layout consistent after import.</div></div>' +
    '</div></div>';
  }

  function renderFooter(plan) {
    return '<div class="footer">' + escapeHtml((plan.meta && plan.meta.footer) || 'Import a plan once, then edit from the tab bar.') + '</div>';
  }

  function renderBottomNav() {
    return '<div class="bottom-nav">' + NAV_ITEMS.map((item) => '<button class="nav-btn ' + (appState.page === item.id ? 'active' : '') + '" data-nav="' + item.id + '"><div class="nav-icon">' + item.icon + '</div><div class="nav-label">' + escapeHtml(item.label.toUpperCase()) + '</div></button>').join('') + '</div>';
  }

  function renderPage(plan) {
    if (appState.page === 'home') return renderHomePage(plan);
    if (appState.page === 'plan') return renderPlanPage(plan);
    if (appState.page === 'meals') return renderMealsPage(plan);
    if (appState.page === 'tips') return renderTipsPage(plan);
    return renderImportPage(plan);
  }

  function attachEvents() {
    document.querySelectorAll('[data-nav]').forEach((node) => {
      node.addEventListener('click', () => {
        appState.page = node.getAttribute('data-nav');
        render();
      });
    });

    document.querySelectorAll('[data-day-index]').forEach((node) => {
      node.addEventListener('click', () => {
        appState.activeDay = Number(node.getAttribute('data-day-index')) || 0;
        appState.page = 'plan';
        render();
      });
    });

    document.querySelectorAll('[data-meal-index]').forEach((node) => {
      node.addEventListener('click', () => {
        const idx = Number(node.getAttribute('data-meal-index')) || 0;
        appState.expandedMeal = appState.expandedMeal === idx ? null : idx;
        render();
      });
    });

    const input = document.getElementById('plan-file-input');
    if (input) {
      input.addEventListener('change', handleImportFile);
    }

    const resetBtn = document.getElementById('reset-plan-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        clearStoredPlan();
        appState.plan = appState.defaultPlan;
        appState.activeDay = 0;
        appState.expandedMeal = null;
        appState.importStatus = { type: 'ok', message: 'Reset to default plan.' };
        render();
      });
    }

    const sampleBtn = document.getElementById('import-sample-btn');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        appState.plan = appState.defaultPlan;
        writeStoredPlan(appState.plan);
        appState.activeDay = 0;
        appState.expandedMeal = null;
        appState.importStatus = { type: 'ok', message: 'Default plan loaded.' };
        render();
      });
    }

    const downloadBtn = document.getElementById('download-plan-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(getPlan(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'fitness-plan.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
    }


    const logBtn = document.getElementById('log-day-btn');
    if (logBtn) {
      logBtn.addEventListener('click', () => {
        markDayDone(getPlan());
        render();
      });
    }

    const undoBtn = document.getElementById('undo-day-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        undoDayDone();
        render();
      });
    }

    const installBtn = document.getElementById('a2hs-btn');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (appState.deferredInstallPrompt) {
          appState.deferredInstallPrompt.prompt();
          try { await appState.deferredInstallPrompt.userChoice; } catch (error) {}
          appState.deferredInstallPrompt = null;
          return;
        }
        window.alert('Use your browser menu and choose Add to Home Screen or Install App.');
      });
    }
  }

  async function handleImportFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const plan = window.FitnessParser.parseImportedPlan(text, file.name);
      appState.plan = window.FitnessParser.normalizePlan(plan);
      writeStoredPlan(appState.plan);
      appState.activeDay = 0;
      appState.expandedMeal = null;
      appState.lastFileName = file.name;
      appState.importStatus = { type: 'ok', message: 'Imported ' + file.name + ' successfully.' };
      render();
    } catch (error) {
      appState.importStatus = { type: 'error', message: error && error.message ? error.message : 'Import failed.' };
      render();
    }
  }

  function render() {
    if (!appState.ready) {
      el().innerHTML = '<div class="loading-screen"><div class="loading-card"><div class="loading-title">Loading your static app</div><div class="loading-copy">Preparing the default plan and app shell.</div></div></div>';
      return;
    }

    if (appState.error) {
      el().innerHTML = '<div class="error-screen"><div class="error-card"><div class="error-title">Could not load the default plan</div><div class="error-copy">' + escapeHtml(appState.error) + '</div></div></div>';
      return;
    }

    const plan = getPlan();
    el().innerHTML = '<div class="app-shell">' + renderHeader(plan) + renderWeekStrip(plan) + renderPage(plan) + renderFooter(plan) + renderBottomNav() + '</div>';
    attachEvents();
  }

  async function bootstrap() {
    try {
      const response = await fetch('./data/default-plan.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Default plan file could not be fetched.');
      const defaultPlan = window.FitnessParser.normalizePlan(await response.json());
      appState.defaultPlan = defaultPlan;
      appState.plan = window.FitnessParser.normalizePlan(readStoredPlan() || defaultPlan);
      appState.completedDays = Math.min(totalDays(defaultPlan), readStoredProgress());
      appState.ready = true;
      render();
    } catch (error) {
      appState.error = error && error.message ? error.message : 'Unknown startup error.';
      appState.ready = true;
      render();
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    appState.deferredInstallPrompt = event;
  });

  render();
  bootstrap();
})();
