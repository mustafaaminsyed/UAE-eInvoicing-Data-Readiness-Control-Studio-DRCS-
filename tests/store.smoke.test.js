const { addTask, clearCompleted, getTaskCounters, getVisibleTasks, parseTaskDraft, updateTask } = window.TodoStore;

const lines = [];

run("validates title is required", () => {
  const result = parseTaskDraft({
    title: "   ",
    description: "",
    dueDate: "",
    priority: "medium",
  });
  assert(!result.isValid, "draft should be invalid");
});

run("adds and updates task", () => {
  const draft = parseTaskDraft({
    title: "Write tests",
    description: "basic smoke checks",
    dueDate: "",
    priority: "high",
  });
  assert(draft.isValid, "draft should be valid");

  let tasks = addTask([], draft.value);
  assert(tasks.length === 1, "one task should be created");
  assert(tasks[0].title === "Write tests", "task title mismatch");

  tasks = updateTask(tasks, tasks[0].id, { completed: true });
  assert(tasks[0].completed === true, "task should be marked completed");
});

run("filters and sorts task list", () => {
  const base = new Date("2026-01-01T12:00:00.000Z").toISOString();
  const tasks = [
    {
      id: "a",
      title: "Low later",
      description: "",
      completed: false,
      dueDate: "2026-04-10",
      priority: "low",
      createdAt: base,
    },
    {
      id: "b",
      title: "High sooner",
      description: "",
      completed: false,
      dueDate: "2026-03-01",
      priority: "high",
      createdAt: new Date("2026-01-02T12:00:00.000Z").toISOString(),
    },
    {
      id: "c",
      title: "Completed",
      description: "",
      completed: true,
      dueDate: null,
      priority: "medium",
      createdAt: new Date("2026-01-03T12:00:00.000Z").toISOString(),
    },
  ];

  const active = getVisibleTasks(tasks, {
    filter: "active",
    search: "",
    sort: "due-asc",
  });
  assert(active.length === 2, "active filter should return 2 tasks");
  assert(active[0].id === "b", "due date sort should bring earliest first");

  const prioritySorted = getVisibleTasks(tasks, {
    filter: "all",
    search: "",
    sort: "priority-desc",
  });
  assert(prioritySorted[0].priority === "high", "priority sort should place high first");
});

run("supports bulk clear completed", () => {
  const tasks = [
    { id: "1", title: "A", description: "", completed: true, dueDate: null, priority: "low", createdAt: new Date().toISOString() },
    { id: "2", title: "B", description: "", completed: false, dueDate: null, priority: "medium", createdAt: new Date().toISOString() },
  ];

  const cleaned = clearCompleted(tasks);
  assert(cleaned.length === 1, "completed tasks should be removed");
  const counters = getTaskCounters(cleaned);
  assert(counters.completed === 0, "completed counter should be zero");
});

print();

function run(name, fn) {
  try {
    fn();
    lines.push(`PASS: ${name}`);
  } catch (error) {
    lines.push(`FAIL: ${name}\n  ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function print() {
  const output = document.getElementById("output");
  if (!(output instanceof HTMLElement)) return;

  const failed = lines.some((line) => line.startsWith("FAIL:"));
  output.textContent = lines.join("\n");
  output.className = failed ? "fail" : "ok";
}
