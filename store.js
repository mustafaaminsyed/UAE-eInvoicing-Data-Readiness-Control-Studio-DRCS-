const PRIORITIES = ["low", "medium", "high"];
const FILTERS = ["all", "active", "completed"];
const SORTS = [
  "created-desc",
  "created-asc",
  "due-asc",
  "due-desc",
  "priority-desc",
  "priority-asc",
];
const THEMES = ["system", "light", "dark"];

const TASK_STORAGE_KEY = "todo-app-items";
const PREFERENCE_STORAGE_KEY = "todo-app-preferences-v1";

const DEFAULT_PREFERENCES = {
  theme: "system",
  sort: "created-desc",
};

const PRIORITY_WEIGHT = {
  low: 1,
  medium: 2,
  high: 3,
};

function loadTasks() {
  try {
    const raw = localStorage.getItem(TASK_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeTask).filter(Boolean);
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREFERENCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };

    const parsed = JSON.parse(raw);
    return normalizePreferences(parsed);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePreferences(preferences) {
  localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)));
}

function normalizePreferences(preferences) {
  if (!preferences || typeof preferences !== "object") return { ...DEFAULT_PREFERENCES };

  return {
    theme: sanitizeTheme(preferences.theme),
    sort: sanitizeSort(preferences.sort),
  };
}

function parseTaskDraft(input) {
  const title = sanitizeText(input.title, 120);
  const description = sanitizeText(input.description, 240);
  const dueDate = normalizeDueDate(input.dueDate);
  const priority = sanitizePriority(input.priority);
  const errors = [];

  if (!title) {
    errors.push("Task title is required.");
  }

  if (String(input.title || "").trim().length > 120) {
    errors.push("Task title must be 120 characters or fewer.");
  }

  if (String(input.description || "").trim().length > 240) {
    errors.push("Description must be 240 characters or fewer.");
  }

  if (input.dueDate && !dueDate) {
    errors.push("Please select a valid due date.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    value: {
      title,
      description,
      dueDate,
      priority,
    },
  };
}

function createTask(draft) {
  return {
    id: createId(),
    title: draft.title,
    description: draft.description,
    completed: false,
    dueDate: draft.dueDate,
    priority: draft.priority,
    createdAt: new Date().toISOString(),
  };
}

function addTask(tasks, draft) {
  return [createTask(draft), ...tasks];
}

function toggleTaskCompletion(tasks, taskId, completed) {
  return tasks.map((task) => (task.id === taskId ? { ...task, completed } : task));
}

function updateTask(tasks, taskId, updates) {
  return tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
}

function deleteTask(tasks, taskId) {
  return tasks.filter((task) => task.id !== taskId);
}

function clearCompleted(tasks) {
  return tasks.filter((task) => !task.completed);
}

function markAll(tasks, completed) {
  return tasks.map((task) => ({ ...task, completed }));
}

function getTaskCounters(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const active = total - completed;
  return { total, active, completed };
}

function getVisibleTasks(tasks, options) {
  const filter = sanitizeFilter(options.filter);
  const sort = sanitizeSort(options.sort);
  const search = String(options.search || "").trim().toLowerCase();

  let visible = tasks.slice();

  if (filter === "active") {
    visible = visible.filter((task) => !task.completed);
  } else if (filter === "completed") {
    visible = visible.filter((task) => task.completed);
  }

  if (search) {
    visible = visible.filter((task) => {
      const haystack = `${task.title} ${task.description}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  visible.sort((a, b) => compareTasks(a, b, sort));
  return visible;
}

function isTaskOverdue(task) {
  if (task.completed || !task.dueDate) return false;
  return task.dueDate < todayIso();
}

function sanitizeTheme(value) {
  return THEMES.includes(value) ? value : DEFAULT_PREFERENCES.theme;
}

function sanitizeSort(value) {
  return SORTS.includes(value) ? value : DEFAULT_PREFERENCES.sort;
}

function sanitizeFilter(value) {
  return FILTERS.includes(value) ? value : "all";
}

function normalizeTask(value) {
  if (!value || typeof value !== "object") return null;

  const id = typeof value.id === "string" ? value.id : null;
  const legacyTitle = typeof value.text === "string" ? value.text : "";
  const rawTitle = typeof value.title === "string" ? value.title : legacyTitle;
  const title = sanitizeText(rawTitle, 120);
  if (!id || !title) return null;

  return {
    id,
    title,
    description: sanitizeText(value.description, 240),
    completed: Boolean(value.completed),
    dueDate: normalizeDueDate(value.dueDate),
    priority: sanitizePriority(value.priority),
    createdAt: normalizeCreatedAt(value.createdAt),
  };
}

function sanitizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizePriority(value) {
  return PRIORITIES.includes(value) ? value : "medium";
}

function normalizeDueDate(value) {
  if (!value) return null;
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(new Date(`${value}T00:00:00`).getTime()) ? null : value;
}

function normalizeCreatedAt(value) {
  if (typeof value !== "string") return new Date().toISOString();
  return Number.isNaN(new Date(value).getTime()) ? new Date().toISOString() : value;
}

function compareTasks(a, b, sort) {
  switch (sort) {
    case "created-asc":
      return byCreated(a, b, true);
    case "due-asc":
      return byDueDate(a, b, true);
    case "due-desc":
      return byDueDate(a, b, false);
    case "priority-desc":
      return byPriority(a, b, false);
    case "priority-asc":
      return byPriority(a, b, true);
    case "created-desc":
    default:
      return byCreated(a, b, false);
  }
}

function byCreated(a, b, asc) {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  return asc ? aTime - bTime : bTime - aTime;
}

function byDueDate(a, b, asc) {
  if (a.dueDate && !b.dueDate) return asc ? -1 : 1;
  if (!a.dueDate && b.dueDate) return asc ? 1 : -1;
  if (!a.dueDate && !b.dueDate) return byCreated(a, b, false);

  const aTime = new Date(`${a.dueDate}T00:00:00`).getTime();
  const bTime = new Date(`${b.dueDate}T00:00:00`).getTime();
  if (aTime === bTime) return byCreated(a, b, false);
  return asc ? aTime - bTime : bTime - aTime;
}

function byPriority(a, b, asc) {
  const aWeight = PRIORITY_WEIGHT[a.priority];
  const bWeight = PRIORITY_WEIGHT[b.priority];
  if (aWeight === bWeight) return byCreated(a, b, false);
  return asc ? aWeight - bWeight : bWeight - aWeight;
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

window.TodoStore = {
  PRIORITIES,
  FILTERS,
  SORTS,
  THEMES,
  loadTasks,
  saveTasks,
  loadPreferences,
  savePreferences,
  normalizePreferences,
  parseTaskDraft,
  createTask,
  addTask,
  toggleTaskCompletion,
  updateTask,
  deleteTask,
  clearCompleted,
  markAll,
  getTaskCounters,
  getVisibleTasks,
  isTaskOverdue,
  sanitizeTheme,
  sanitizeSort,
  sanitizeFilter,
};
