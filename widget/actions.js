/* Walk With Me: Show me action registry.
 * Ids are shared with data/faq.json (action_id) and the API's chat response (action.id).
 * VERIFY: these selectors target the Savanna demo STAND-IN pages in /savanna. Open each real
 * Savanna starter page in DevTools and replace the selectors before using the widget there.
 * Keys in `targets` are matched against the END of location.pathname.
 * Amharic labels stay null until a native speaker writes them (the widget then shows English).
 */
window.WWM_ACTIONS = [
  {
    id: "mark_complete",
    label: { en: "Mark as complete", am: null },
    keywords: { en: ["finish", "complete", "done", "mark", "completed", "end"], am: ["ልጨርስ", "ጨርስ", "ተጠናቋል"] },
    targets: { "/pages/concept-with-navigation.html": "#mark-complete" },
    fallback_page: { url: "/savanna/pages/concept-with-navigation.html", name: { en: "lesson", am: null } }
  },
  {
    id: "open_courses_menu",
    label: { en: "My courses", am: null },
    keywords: { en: ["courses", "course", "switch", "another", "dropdown"], am: [] },
    targets: { "/pages/concept-with-navigation.html": "#courses-dropdown", "/savanna/index.html": "#courses-dropdown", "/savanna/": "#courses-dropdown" },
    fallback_page: { url: "/savanna/index.html", name: { en: "dashboard", am: null } }
  },
  {
    id: "toggle_sidebar",
    label: { en: "Menu", am: null },
    keywords: { en: ["menu", "outline", "sidebar", "hamburger", "contents", "navigation"], am: [] },
    targets: { "/pages/concept-with-navigation.html": "#sidebar-toggle", "/savanna/index.html": "#sidebar-toggle", "/savanna/": "#sidebar-toggle" },
    fallback_page: { url: "/savanna/index.html", name: { en: "dashboard", am: null } }
  },
  {
    id: "open_programme_modal",
    label: { en: "Programme details", am: null },
    keywords: { en: ["programme", "program", "cohort", "dates"], am: [] },
    targets: { "/savanna/index.html": "#programme-details", "/savanna/": "#programme-details" },
    fallback_page: { url: "/savanna/index.html", name: { en: "dashboard", am: null } }
  },
  {
    id: "open_score_details",
    label: { en: "Score details", am: null },
    keywords: { en: ["score", "marks", "grade", "result", "results", "points"], am: [] },
    targets: { "/savanna/index.html": "#score-details", "/savanna/": "#score-details" },
    fallback_page: { url: "/savanna/index.html", name: { en: "dashboard", am: null } }
  },
  {
    id: "switch_week",
    label: { en: "Week strip", am: null },
    keywords: { en: ["week", "weeks", "strip", "schedule"], am: [] },
    targets: { "/savanna/index.html": "#week-strip button[aria-current='true']", "/savanna/": "#week-strip button[aria-current='true']" },
    fallback_page: { url: "/savanna/index.html", name: { en: "dashboard", am: null } }
  },
  {
    id: "open_curriculum_nav",
    label: { en: "Next concept", am: null },
    keywords: { en: ["next", "curriculum", "continue", "forward"], am: [] },
    targets: { "/pages/concept-with-navigation.html": "#curriculum-bar a.next" },
    fallback_page: { url: "/savanna/pages/concept-with-navigation.html", name: { en: "lesson", am: null } }
  },
  {
    id: "open_help",
    label: { en: "Talk to a person", am: "ሰው ያናግሩ" },
    keywords: { en: ["person", "human", "staff", "someone", "talk"], am: ["ሰው"] },
    targets: {},          /* special: the widget's own Talk to a person button */
    special: "widget_help"
  }
];
