const {
  addTask,
  clearCompleted,
  deleteTask,
  getTaskCounters,
  getVisibleTasks,
  loadPreferences,
  loadTasks,
  markAll,
  parseTaskDraft,
  sanitizeFilter,
  sanitizeSort,
  sanitizeTheme,
  savePreferences,
  saveTasks,
  toggleTaskCompletion,
  updateTask,
} = window.TodoStore;
const { applyTheme, focusInlineEdit, getElements, renderApp } = window.TodoUI;

const elements = getElements();
const state = {
  tasks: [],
  visibleTasks: [],
  loading: true,
  filter: "all",
  search: "",
  sort: "created-desc",
  theme: "system",
  formError: "",
  editError: "",
  editingId: null,
  recentlyAddedId: null,
  counters: { total: 0, active: 0, completed: 0 },
};

bindEvents();
render();
window.requestAnimationFrame(initializeApp);

function initializeApp() {
  state.tasks = loadTasks();

  const preferences = loadPreferences();
  state.sort = preferences.sort;
  state.theme = preferences.theme;

  state.loading = false;
  applyTheme(state.theme);
  render();
}

function bindEvents() {
  elements.taskForm.addEventListener("submit", onAddTask);
  elements.searchInput.addEventListener("input", onSearchInput);
  elements.filterGroup.addEventListener("click", onFilterClick);
  elements.sortSelect.addEventListener("change", onSortChange);
  elements.themeSelect.addEventListener("change", onThemeChange);
  elements.markAllCompleteBtn.addEventListener("click", () => onMarkAll(true));
  elements.markAllActiveBtn.addEventListener("click", () => onMarkAll(false));
  elements.clearCompletedBtn.addEventListener("click", onClearCompleted);

  elements.taskList.addEventListener("change", onTaskListChange);
  elements.taskList.addEventListener("click", onTaskListClick);
  elements.taskList.addEventListener("submit", onEditSubmit);
  elements.taskList.addEventListener("keydown", onTaskListKeydown);
}

function onAddTask(event) {
  event.preventDefault();
  const draft = readTaskDraftFromAddForm();
  const parsed = parseTaskDraft(draft);

  if (!parsed.isValid) {
    state.formError = parsed.errors[0];
    render();
    return;
  }

  state.tasks = addTask(state.tasks, parsed.value);
  saveTasks(state.tasks);

  state.formError = "";
  state.editingId = null;
  state.recentlyAddedId = state.tasks[0].id;

  elements.taskForm.reset();
  elements.taskPriorityInput.value = "medium";
  elements.taskTitleInput.focus();

  render();
}

function onSearchInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  state.search = input.value;
  render();
}

function onFilterClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  if (!target.classList.contains("filter-btn")) return;

  state.filter = sanitizeFilter(target.dataset.filter);
  render();
}

function onSortChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;

  state.sort = sanitizeSort(target.value);
  persistPreferences();
  render();
}

function onThemeChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;

  state.theme = sanitizeTheme(target.value);
  applyTheme(state.theme);
  persistPreferences();
  render();
}

function onMarkAll(completed) {
  if (state.tasks.length === 0) return;
  state.tasks = markAll(state.tasks, completed);
  saveTasks(state.tasks);
  render();
}

function onClearCompleted() {
  if (!state.tasks.some((task) => task.completed)) return;
  state.tasks = clearCompleted(state.tasks);
  saveTasks(state.tasks);
  render();
}

function onTaskListChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.classList.contains("task-toggle")) return;

  const taskId = getTaskId(target);
  if (!taskId) return;

  state.tasks = toggleTaskCompletion(state.tasks, taskId, target.checked);
  saveTasks(state.tasks);
  render();
}

function onTaskListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const taskId = getTaskId(target);
  if (!taskId) return;

  if (target.classList.contains("menu-edit-btn")) {
    closeTaskMenu(target);
    state.editingId = taskId;
    state.editError = "";
    render();
    focusInlineEdit(elements, taskId);
    return;
  }

  if (target.classList.contains("cancel-edit-btn")) {
    state.editingId = null;
    state.editError = "";
    render();
    return;
  }

  if (target.classList.contains("menu-delete-btn")) {
    closeTaskMenu(target);
    const taskRow = target.closest(".task-item");
    if (!(taskRow instanceof HTMLLIElement)) return;
    deleteTaskWithAnimation(taskId, taskRow);
  }
}

function onEditSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!form.classList.contains("edit-form")) return;
  event.preventDefault();

  const taskId = getTaskId(form);
  if (!taskId) return;

  const title = form.querySelector(".edit-title-input");
  const description = form.querySelector(".edit-description-input");
  const dueDate = form.querySelector(".edit-due-input");
  const priority = form.querySelector(".edit-priority-input");

  const parsed = parseTaskDraft({
    title: title instanceof HTMLInputElement ? title.value : "",
    description: description instanceof HTMLTextAreaElement ? description.value : "",
    dueDate: dueDate instanceof HTMLInputElement ? dueDate.value : "",
    priority: priority instanceof HTMLSelectElement ? priority.value : "medium",
  });

  if (!parsed.isValid) {
    state.editingId = taskId;
    state.editError = parsed.errors[0];
    render();
    focusInlineEdit(elements, taskId);
    return;
  }

  state.tasks = updateTask(state.tasks, taskId, parsed.value);
  state.editingId = null;
  state.editError = "";
  saveTasks(state.tasks);
  render();
}

function onTaskListKeydown(event) {
  if (event.key !== "Escape") return;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const editingForm = target.closest(".edit-form");
  if (!(editingForm instanceof HTMLFormElement)) return;

  state.editingId = null;
  state.editError = "";
  render();
}

function deleteTaskWithAnimation(taskId, rowElement) {
  rowElement.classList.add("is-removing");

  let completed = false;
  const finalize = () => {
    if (completed) return;
    completed = true;

    state.tasks = deleteTask(state.tasks, taskId);
    if (state.editingId === taskId) {
      state.editingId = null;
      state.editError = "";
    }
    saveTasks(state.tasks);
    render();
  };

  rowElement.addEventListener("animationend", finalize, { once: true });
  window.setTimeout(finalize, 220);
}

function render() {
  state.counters = getTaskCounters(state.tasks);
  state.visibleTasks = getVisibleTasks(state.tasks, {
    filter: state.filter,
    search: state.search,
    sort: state.sort,
  });

  renderApp(elements, state);
  state.recentlyAddedId = null;
}

function persistPreferences() {
  savePreferences({
    theme: state.theme,
    sort: state.sort,
  });
}

function readTaskDraftFromAddForm() {
  return {
    title: elements.taskTitleInput.value,
    description: elements.taskDescriptionInput.value,
    dueDate: elements.taskDueInput.value,
    priority: elements.taskPriorityInput.value,
  };
}

function getTaskId(element) {
  const row = element.closest(".task-item");
  if (!row) return null;
  return row.dataset.id || null;
}

function closeTaskMenu(target) {
  const menu = target.closest(".task-menu");
  if (menu instanceof HTMLDetailsElement) {
    menu.open = false;
  }
}
