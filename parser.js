(function (global) {
  const DEFAULT_PLAN = {
    meta: {
      eyebrow: "PERSONAL FITNESS TRACKER",
      title: "YOUR PLAN",
      subtitle: "Week 1 · Fat Loss & Strength",
      footer: "RUN THE NEIGHBORHOOD · LIFT THE DUMBBELLS · BUILD THE BODY"
    },
    equipment: [],
    stats: [],
    days: [],
    meals: [],
    tips: []
  };

  const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  function safeEvalLiteral(literal) {
    return Function('"use strict"; return (' + literal + ');')();
  }

  function extractConstLiteral(source, constName) {
    const token = 'const ' + constName;
    const start = source.indexOf(token);
    if (start === -1) return null;

    const eq = source.indexOf('=', start);
    if (eq === -1) return null;

    let i = eq + 1;
    while (i < source.length && /\s/.test(source[i])) i += 1;

    const first = source[i];
    if (first !== '[' && first !== '{') return null;

    const close = first === '[' ? ']' : '}';
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escaped = false;

    for (let j = i; j < source.length; j += 1) {
      const ch = source[j];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (!inDouble && !inTemplate && ch === "'") inSingle = !inSingle;
      else if (!inSingle && !inTemplate && ch === '"') inDouble = !inDouble;
      else if (!inSingle && !inDouble && ch === '`') inTemplate = !inTemplate;
      if (inSingle || inDouble || inTemplate) continue;
      if (ch === first) depth += 1;
      if (ch === close) {
        depth -= 1;
        if (depth === 0) return source.slice(i, j + 1);
      }
    }

    return null;
  }

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  function deriveStatsFromPlan(plan) {
    const calories = (plan.meals || []).reduce((sum, meal) => sum + (Number(meal.kcal) || 0), 0);
    const protein = (plan.meals || []).reduce((sum, meal) => sum + (Number(meal.protein) || 0), 0);
    const strengthDays = (plan.days || []).filter((day) => Array.isArray(day.exercises) && day.exercises.some((ex) => ex.sets && ex.sets !== '—')).length;
    const cardioDays = (plan.days || []).filter((day) => day.cardio).length;

    return [
      { label: 'DAILY CALORIES', value: calories ? ('~' + calories + ' kcal') : '—', accent: '#e8ff5a' },
      { label: 'PROTEIN / DAY', value: protein ? (protein + 'g') : '—', accent: '#5affb0' },
      { label: 'STRENGTH DAYS', value: strengthDays ? (strengthDays + ' x / week') : '—', accent: '#ff8c5a' },
      { label: 'CARDIO DAYS', value: cardioDays ? (cardioDays + ' x / week') : '—', accent: '#ff5a8a' }
    ];
  }

  function normalizeDay(day, index) {
    return {
      label: cleanText(day.label || DAY_LABELS[index] || ('DAY ' + (index + 1))),
      name: cleanText(day.name || 'Training Day'),
      focus: cleanText(day.focus || ''),
      tag: cleanText(day.tag || 'TRAINING DAY'),
      color: day.color || '#e8ff5a',
      cardio: day.cardio || null,
      exercises: Array.isArray(day.exercises) ? day.exercises : []
    };
  }

  function normalizeMeal(meal) {
    return {
      time: cleanText(meal.time || ''),
      name: cleanText(meal.name || 'Meal'),
      icon: meal.icon || '🍽️',
      kcal: Number(meal.kcal) || 0,
      protein: Number(meal.protein) || 0,
      carbs: Number(meal.carbs) || 0,
      fat: Number(meal.fat) || 0,
      items: Array.isArray(meal.items) ? meal.items.map((item) => cleanText(item)) : [],
      tip: cleanText(meal.tip || '')
    };
  }

  function normalizeTip(tip) {
    return {
      icon: tip.icon || '💡',
      title: cleanText(tip.title || 'Tip'),
      color: tip.color || '#e8ff5a',
      body: cleanText(tip.body || '')
    };
  }

  function normalizePlan(input) {
    const source = input || {};
    const plan = {
      meta: {
        eyebrow: cleanText((source.meta && source.meta.eyebrow) || DEFAULT_PLAN.meta.eyebrow),
        title: cleanText((source.meta && source.meta.title) || DEFAULT_PLAN.meta.title),
        subtitle: cleanText((source.meta && source.meta.subtitle) || DEFAULT_PLAN.meta.subtitle),
        footer: cleanText((source.meta && source.meta.footer) || DEFAULT_PLAN.meta.footer)
      },
      equipment: Array.isArray(source.equipment) ? source.equipment.map((item) => ({
        icon: item.icon || '🏋️',
        label: cleanText(item.label || '')
      })) : [],
      stats: Array.isArray(source.stats) ? source.stats.map((item) => ({
        label: cleanText(item.label || ''),
        value: cleanText(item.value || ''),
        accent: item.accent || '#e8ff5a'
      })) : [],
      days: Array.isArray(source.days) ? source.days.map(normalizeDay) : [],
      meals: Array.isArray(source.meals) ? source.meals.map(normalizeMeal) : [],
      tips: Array.isArray(source.tips) ? source.tips.map(normalizeTip) : []
    };

    if (!plan.stats.length) {
      plan.stats = deriveStatsFromPlan(plan);
    }

    return plan;
  }

  function parseSourceArrays(source) {
    const equipmentLiteral = extractConstLiteral(source, 'equipment');
    const daysLiteral = extractConstLiteral(source, 'days');
    const mealsLiteral = extractConstLiteral(source, 'meals');
    const tipsLiteral = extractConstLiteral(source, 'tips');

    if (!equipmentLiteral && !daysLiteral && !mealsLiteral && !tipsLiteral) return null;

    return {
      equipment: equipmentLiteral ? safeEvalLiteral(equipmentLiteral) : [],
      days: daysLiteral ? safeEvalLiteral(daysLiteral) : [],
      meals: mealsLiteral ? safeEvalLiteral(mealsLiteral) : [],
      tips: tipsLiteral ? safeEvalLiteral(tipsLiteral) : []
    };
  }

  function parseJsxPlan(source) {
    const arrays = parseSourceArrays(source);
    if (!arrays || (!arrays.days.length && !arrays.meals.length && !arrays.tips.length)) {
      throw new Error('Could not find plan arrays in the JSX file.');
    }

    const titleMatch = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const subtitleMatch = source.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

    return normalizePlan({
      meta: {
        title: decodeHtmlEntities(cleanText(titleMatch && titleMatch[1])),
        subtitle: decodeHtmlEntities(cleanText(subtitleMatch && subtitleMatch[1]))
      },
      equipment: arrays.equipment,
      days: arrays.days,
      meals: arrays.meals,
      tips: arrays.tips
    });
  }

  function parseHtmlPlan(source) {
    const doc = new DOMParser().parseFromString(source, 'text/html');

    const embedded = doc.querySelector('#fitness-plan-data');
    if (embedded && embedded.textContent && embedded.textContent.trim()) {
      return normalizePlan(JSON.parse(embedded.textContent));
    }

    const scriptText = Array.from(doc.querySelectorAll('script')).map((node) => node.textContent || '').join('\n');
    if (/const\s+days\s*=/.test(scriptText) || /const\s+meals\s*=/.test(scriptText) || /const\s+tips\s*=/.test(scriptText)) {
      return parseJsxPlan(scriptText);
    }

    const title = cleanText((doc.querySelector('h1') || {}).textContent || DEFAULT_PLAN.meta.title);
    const subtitle = cleanText((doc.querySelector('p') || {}).textContent || DEFAULT_PLAN.meta.subtitle);
    const eyebrow = cleanText(
      Array.from(doc.querySelectorAll('div, span, small, p'))
        .map((node) => node.textContent || '')
        .find((text) => /beginner|cardio|fitness|tracker|setup|plan/i.test(text)) || DEFAULT_PLAN.meta.eyebrow
    );

    const dayRows = Array.from(doc.querySelectorAll('button, div, li, span'))
      .map((node) => cleanText(node.textContent || ''))
      .filter((text) => DAY_LABELS.includes(text.toUpperCase()));

    const days = Array.from(new Set(dayRows)).map((label) => ({
      label,
      name: label,
      focus: '',
      tag: 'TRAINING DAY',
      color: '#e8ff5a',
      cardio: null,
      exercises: []
    }));

    return normalizePlan({
      meta: { eyebrow, title, subtitle },
      days
    });
  }

  function parseImportedPlan(text, fileName) {
    const lower = String(fileName || '').toLowerCase();

    if (lower.endsWith('.json')) {
      return normalizePlan(JSON.parse(text));
    }

    if (lower.endsWith('.jsx') || lower.endsWith('.js') || lower.endsWith('.tsx') || /useState|export default function|const\s+days\s*=/.test(text)) {
      return parseJsxPlan(text);
    }

    if (lower.endsWith('.html') || lower.endsWith('.htm') || /<html|<body|<!doctype html/i.test(text)) {
      return parseHtmlPlan(text);
    }

    throw new Error('Unsupported file type. Use .jsx, .js, .json, .html, or .htm.');
  }

  global.FitnessParser = {
    DEFAULT_PLAN,
    deriveStatsFromPlan,
    normalizePlan,
    parseImportedPlan,
    parseJsxPlan,
    parseHtmlPlan
  };
})(window);
