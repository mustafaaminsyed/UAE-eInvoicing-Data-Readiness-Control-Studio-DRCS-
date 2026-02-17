const { isTaskOverdue } = window.TodoStore;

function getElements() {
  return {
    taskSummary: document.getElementById("task-summary"),
    themeSelect: document.getElementById("theme-select"),
    taskForm: document.getElementById("task-form"),
    taskTitleInput: document.getElementById("task-title-input"),
    taskDescriptionInput: document.getElementById("task-description-input"),
    taskDueInput: document.getElementById("task-due-input"),
    taskPriorityInput: document.getElementById("task-priority-input"),
    formError: document.getElementById("form-error"),
    searchInput: document.getElementById("search-input"),
    filterGroup: document.getElementById("filter-group"),
    sortSelect: document.getElementById("sort-select"),
    markAllCompleteBtn: document.getElementById("mark-all-complete-btn"),
    markAllActiveBtn: document.getElementById("mark-all-active-btn"),
    clearCompletedBtn: document.getElementById("clear-completed-btn"),
    loadingState: document.getElementById("loading-state"),
    emptyState: document.getElementById("empty-state"),
    taskList: document.getElementById("task-list"),
    taskTemplate: document.getElementById("task-template"),
  };
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "light dark";
    return;
  }

  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

function renderApp(elements, state) {
  renderSummary(elements, state.counters);
  renderTopControls(elements, state);
  renderFormError(elements, state.formError);
  renderTaskList(elements, state);
}

function focusInlineEdit(elements, taskId) {
  const input = elements.taskList.querySelector(`.task-item[data-id="${taskId}"] .edit-title-input`);
  if (input instanceof HTMLInputElement) {
    input.focus();
    input.select();
  }
}

function renderSummary(elements, counters) {
  elements.taskSummary.textContent = `${counters.total} total - ${counters.active} active - ${counters.completed} completed`;
}

function renderTopControls(elements, state) {
  elements.themeSelect.value = state.theme;
  elements.searchInput.value = state.search;
  elements.sortSelect.value = state.sort;

  const filterButtons = elements.filterGroup.querySelectorAll(".filter-btn");
  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === state.filter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  const hasTasks = state.tasks.length > 0;
  const hasCompleted = state.tasks.some((task) => task.completed);
  elements.markAllCompleteBtn.disabled = !hasTasks;
  elements.markAllActiveBtn.disabled = !hasTasks;
  elements.clearCompletedBtn.disabled = !hasCompleted;
}

function renderFormError(elements, message) {
  if (!message) {
    elements.formError.hidden = true;
    elements.formError.textContent = "";
    return;
  }

  elements.formError.hidden = false;
  elements.formError.textContent = message;
}

function renderTaskList(elements, state) {
  elements.taskList.innerHTML = "";
  const visibleTasks = state.visibleTasks;

  elements.loadingState.hidden = !state.loading;
  if (state.loading) {
    elements.emptyState.hidden = true;
    return;
  }

  if (visibleTasks.length === 0) {
    elements.emptyState.hidden = false;
    elements.emptyState.textContent = getEmptyStateMessage(state);
    return;
  }

  elements.emptyState.hidden = true;

  const fragment = document.createDocumentFragment();
  visibleTasks.forEach((task) => {
    const node = buildTaskNode(elements, task, state);
    if (node) fragment.appendChild(node);
  });

  elements.taskList.appendChild(fragment);
}

function buildTaskNode(elements, task, state) {
  const clone = elements.taskTemplate.content.firstElementChild.cloneNode(true);
  if (!(clone instanceof HTMLLIElement)) return null;

  clone.dataset.id = task.id;
  clone.classList.toggle("completed", task.completed);
  clone.classList.toggle("overdue", isTaskOverdue(task));
  clone.classList.toggle("is-new", task.id === state.recentlyAddedId);
  clone.classList.remove("task-priority-low", "task-priority-medium", "task-priority-high");
  clone.classList.add(`task-priority-${task.priority}`);

  const toggle = clone.querySelector(".task-toggle");
  const title = clone.querySelector(".task-title");
  const description = clone.querySelector(".task-description");
  const priorityTag = clone.querySelector(".priority-tag");
  const dueTag = clone.querySelector(".due-tag");
  const createdTag = clone.querySelector(".created-tag");
  const editForm = clone.querySelector(".edit-form");
  const editTitleInput = clone.querySelector(".edit-title-input");
  const editDescriptionInput = clone.querySelector(".edit-description-input");
  const editDueInput = clone.querySelector(".edit-due-input");
  const editPriorityInput = clone.querySelector(".edit-priority-input");
  const editError = clone.querySelector(".edit-error");

  if (toggle instanceof HTMLInputElement) {
    toggle.checked = task.completed;
    toggle.setAttribute("aria-label", task.completed ? "Mark task as active" : "Mark task as completed");
  }

  if (title instanceof HTMLElement) {
    title.textContent = task.title;
  }

  if (description instanceof HTMLElement) {
    description.textContent = task.description || "No description added.";
    description.hidden = task.description.length === 0;
  }

  if (priorityTag instanceof HTMLElement) {
    priorityTag.textContent = `Priority: ${capitalize(task.priority)}`;
    priorityTag.classList.add(`priority-${task.priority}`);
  }

  if (dueTag instanceof HTMLElement) {
    dueTag.textContent = task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date";
  }

  if (createdTag instanceof HTMLElement) {
    createdTag.textContent = `Created ${formatDateTime(task.createdAt)}`;
  }

  if (editForm instanceof HTMLFormElement) {
    const isEditing = state.editingId === task.id;
    editForm.hidden = !isEditing;

    if (editTitleInput instanceof HTMLInputElement) editTitleInput.value = task.title;
    if (editDescriptionInput instanceof HTMLTextAreaElement) editDescriptionInput.value = task.description;
    if (editDueInput instanceof HTMLInputElement) editDueInput.value = task.dueDate || "";
    if (editPriorityInput instanceof HTMLSelectElement) editPriorityInput.value = task.priority;

    if (editError instanceof HTMLElement) {
      const hasError = isEditing && Boolean(state.editError);
      editError.hidden = !hasError;
      editError.textContent = hasError ? state.editError : "";
    }
  }

  return clone;
}

function getEmptyStateMessage(state) {
  if (state.search.trim()) {
    return `No tasks match "${state.search.trim()}". Try a different keyword.`;
  }

  if (state.filter === "active") {
    return "No active tasks. Nice momentum.";
  }

  if (state.filter === "completed") {
    return "No completed tasks yet. Finish one to see it here.";
  }

  return "No tasks yet. Add your first task to get started.";
}

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(isoDateTime) {
  const date = new Date(isoDateTime);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

window.TodoUI = {
  getElements,
  applyTheme,
  renderApp,
  focusInlineEdit,
};
