"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

type TaskStatus = "All" | "In Progress" | "To Do" | "Review" | "Done";
type Priority = "low" | "medium" | "high" | "critical";

type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type DashboardTask = {
  id: string;
  title: string;
  project: string;
  due: string;
  dueDate: string | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdBy: string | null;
  initials: string;
  tone: string;
  createdAt: string;
};

type Comment = {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  author?: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const menu = [
  ["▦", "Dashboard"],
  ["☑", "My Tasks"],
  ["▤", "Task Board"],
  ["♧", "Team"],
  ["□", "Calendar"],
  ["♧", "Notices"],
  ["▥", "Reports"],
  ["⚙", "Settings"],
];

const statuses = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

function statusLabel(status: string) {
  if (status === "in_progress") return "In Progress";
  if (status === "todo") return "To Do";
  if (status === "review") return "Review";
  if (status === "done") return "Done";
  return status;
}

function statusValue(status: string) {
  if (status === "In Progress") return "in_progress";
  if (status === "To Do") return "todo";
  if (status === "Review") return "review";
  return "done";
}

function capitalize(value: string | null | undefined) {
  if (!value) return "Medium";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initials(
  name: string | null | undefined,
  email?: string | null
) {
  const source =
    name?.trim() ||
    email?.split("@")[0] ||
    "User";

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatDueDate(date: string | null) {
  if (!date) return "No deadline";

  return `Due ${new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function taskTone(index: number) {
  return ["blue", "purple", "orange", "green"][index % 4];
}

function getTimeMood() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return {
      greeting: "Good morning",
      emoji: "🌅",
      mood: "morning",
      message: "Start your day strong and get things done.",
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      greeting: "Good afternoon",
      emoji: "☀️",
      mood: "afternoon",
      message: "Keep the momentum going.",
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      greeting: "Good evening",
      emoji: "🌇",
      mood: "evening",
      message: "Great work today. Let's finish strong.",
    };
  }

  return {
    greeting: "Good night",
    emoji: "🌙",
    mood: "night",
    message: "Wrap things up and have a restful night.",
  };
}

function AnimatedNumber({
  value,
}: {
  value: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 700;
    const start = performance.now();

    function animate(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplay(Math.round(value * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    }

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display}</>;
}

export default function Home() {
  const [filter, setFilter] = useState<TaskStatus>("All");
  const [activeMenu, setActiveMenu] = useState("Dashboard");

  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [profile, setProfile] = useState<TeamMember | null>(null);
  const [dashboardTasks, setDashboardTasks] = useState<DashboardTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskError, setTaskError] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const [search, setSearch] = useState("");
  const [advancedSearch, setAdvancedSearch] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [timeMood, setTimeMood] = useState(getTimeMood());

  const [darkMode, setDarkMode] = useState(false);

  const [draggedTask, setDraggedTask] =
    useState<DashboardTask | null>(null);

  const [selectedTask, setSelectedTask] =
    useState<DashboardTask | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const currentName =
    profile?.full_name?.trim() ||
    profile?.email?.split("@")[0] ||
    "User";

  const currentInitials = initials(
    profile?.full_name,
    profile?.email
  );

  /*
   * TIME UPDATE
   */

  useEffect(() => {
    const updateMood = () => {
      setTimeMood(getTimeMood());
    };

    updateMood();

    const interval = window.setInterval(updateMood, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  /*
   * DARK MODE
   */

  useEffect(() => {
    const saved = localStorage.getItem("softitbd-dark-mode");

    if (saved === "true") {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark-mode",
      darkMode
    );

    localStorage.setItem(
      "softitbd-dark-mode",
      String(darkMode)
    );
  }, [darkMode]);

  /*
   * FILTERING
   */

  const filteredTasks = useMemo(() => {
    let result = dashboardTasks;

    if (filter !== "All") {
      result = result.filter(
        (task) => task.status === filter
      );
    }

    if (priorityFilter !== "All") {
      result = result.filter(
        (task) =>
          task.priority.toLowerCase() ===
          priorityFilter.toLowerCase()
      );
    }

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.project.toLowerCase().includes(query) ||
          task.priority.toLowerCase().includes(query) ||
          task.status.toLowerCase().includes(query)
      );
    }

    return result;
  }, [
    dashboardTasks,
    filter,
    priorityFilter,
    search,
  ]);

  /*
   * STATS
   */

  const totalTasks = dashboardTasks.length;

  const inProgress = dashboardTasks.filter(
    (task) => task.status === "In Progress"
  ).length;

  const completed = dashboardTasks.filter(
    (task) => task.status === "Done"
  ).length;

  const overdue = dashboardTasks.filter((task) => {
    if (!task.dueDate || task.status === "Done") {
      return false;
    }

    return new Date(task.dueDate).getTime() < Date.now();
  }).length;

  const completionRate =
    totalTasks === 0
      ? 0
      : Math.round((completed / totalTasks) * 100);

  const today = new Date();

  const todayTasks = dashboardTasks.filter((task) => {
    if (!task.dueDate) return false;

    const date = new Date(task.dueDate);

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }).length;

  /*
   * WEEKLY DATA
   */

  const weeklyTasks = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;

    const monday = new Date(now);

    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() + mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);

      date.setDate(monday.getDate() + index);

      const tasks = dashboardTasks.filter((task) => {
        if (!task.dueDate) return false;

        const due = new Date(task.dueDate);

        return (
          due.getFullYear() === date.getFullYear() &&
          due.getMonth() === date.getMonth() &&
          due.getDate() === date.getDate()
        );
      });

      const done = tasks.filter(
        (task) => task.status === "Done"
      ).length;

      return {
        label: [
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
          "Sun",
        ][index],
        total: tasks.length,
        done,
      };
    });
  }, [dashboardTasks]);

  const maxWeekly = Math.max(
    ...weeklyTasks.map((item) => item.total),
    1
  );

  /*
   * AUTH
   */

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      setSignedIn(Boolean(data.session));
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        setSignedIn(Boolean(session));

        if (!session) {
          setProfile(null);
          setDashboardTasks([]);
          setTeamMembers([]);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * LOAD DATA
   */

  useEffect(() => {
    if (!signedIn) return;

    let cancelled = false;

    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const profileResult = await supabase
        .from("profiles")
        .select("id,full_name,email,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled && profileResult.data) {
        setProfile(profileResult.data);
      }

      const taskResult = await supabase
        .from("tasks")
        .select(
          "id,title,status,priority,due_date,assigned_to,created_by,created_at"
        )
        .or(
          `assigned_to.eq.${user.id},created_by.eq.${user.id}`
        )
        .order("created_at", {
          ascending: false,
        });

      if (!cancelled && taskResult.data) {
        setDashboardTasks(
          taskResult.data.map((task, index) => ({
            id: task.id,
            title: task.title,
            project: "SoftITBD",
            due: formatDueDate(task.due_date),
            dueDate: task.due_date,
            priority: capitalize(task.priority),
            status: statusLabel(task.status),
            assignedTo: task.assigned_to,
            createdBy: task.created_by,
            initials: currentInitials,
            tone: taskTone(index),
            createdAt: task.created_at,
          }))
        );
      }

      const teamResult = await supabase
        .from("profiles")
        .select("id,full_name,email,role")
        .order("full_name");

      if (!cancelled && teamResult.data) {
        setTeamMembers(teamResult.data);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [signedIn, currentInitials]);

  /*
   * SIGN IN
   */

  async function signIn(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setAuthError("");

    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setPassword("");
  }

  /*
   * LOGOUT
   */

  async function logout() {
    await supabase.auth.signOut();

    setSignedIn(false);
    setProfile(null);
    setDashboardTasks([]);
    setTeamMembers([]);
  }

  /*
   * STATUS UPDATE
   */

  async function updateTaskStatus(
    taskId: string,
    newStatus: string
  ) {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      alert(`Status update failed: ${error.message}`);
      return;
    }

    setDashboardTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: statusLabel(newStatus),
            }
          : task
      )
    );
  }

  /*
   * DRAG & DROP
   */

  function handleDragStart(task: DashboardTask) {
    setDraggedTask(task);
  }

  async function handleDrop(status: string) {
    if (!draggedTask) return;

    await updateTaskStatus(
      draggedTask.id,
      status
    );

    setDraggedTask(null);
  }

  /*
   * CREATE TASK
   */

  async function createTask() {
    if (!taskTitle.trim()) {
      setTaskError("Task title লিখুন।");
      return;
    }

    setSavingTask(true);
    setTaskError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setTaskError(
        "Session শেষ হয়েছে। আবার login করুন।"
      );
      setSavingTask(false);
      return;
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: taskTitle.trim(),
        priority: taskPriority,
        status: "todo",
        created_by: user.id,
        assigned_to: assigneeId || user.id,
        due_date: taskDueDate || null,
      })
      .select(
        "id,title,status,priority,due_date,assigned_to,created_by,created_at"
      )
      .single();

    if (error) {
      setTaskError(error.message);
      setSavingTask(false);
      return;
    }

    if (data) {
      setDashboardTasks((current) => [
        {
          id: data.id,
          title: data.title,
          project: "SoftITBD",
          due: formatDueDate(data.due_date),
          dueDate: data.due_date,
          priority: capitalize(data.priority),
          status: statusLabel(data.status),
          assignedTo: data.assigned_to,
          createdBy: data.created_by,
          initials: currentInitials,
          tone: "blue",
          createdAt: data.created_at,
        },
        ...current,
      ]);
    }

    setTaskTitle("");
    setTaskPriority("medium");
    setAssigneeId("");
    setTaskDueDate("");
    setSavingTask(false);
    setModalOpen(false);
  }

  /*
   * COMMENTS
   */

  async function loadComments(task: DashboardTask) {
    setSelectedTask(task);
    setComments([]);

    const { data } = await supabase
      .from("task_comments")
      .select(
        "id,task_id,user_id,comment,created_at"
      )
      .eq("task_id", task.id)
      .order("created_at", {
        ascending: true,
      });

    if (data) {
      setComments(data);
    }
  }

  async function addComment() {
    if (!selectedTask || !commentText.trim()) {
      return;
    }

    setCommentLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCommentLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: selectedTask.id,
        user_id: user.id,
        comment: commentText.trim(),
      })
      .select(
        "id,task_id,user_id,comment,created_at"
      )
      .single();

    if (!error && data) {
      setComments((current) => [
        ...current,
        data,
      ]);
      setCommentText("");
    }

    setCommentLoading(false);
  }

  /*
   * TASK ROW
   */

  function renderTaskRow(
    task: DashboardTask,
    draggable = false
  ) {
    return (
      <article
        className="task-row"
        key={task.id}
        draggable={draggable}
        onDragStart={() =>
          handleDragStart(task)
        }
        onClick={() => loadComments(task)}
      >
        <button
          className="check"
          aria-label={`Mark ${task.title} as done`}
          onClick={(event) => {
            event.stopPropagation();

            updateTaskStatus(
              task.id,
              task.status === "Done"
                ? "todo"
                : "done"
            );
          }}
        />

        <div className="task-copy">
          <h3>{task.title}</h3>

          <p>
            {task.project}
            <span>•</span>
            {task.due}
          </p>
        </div>

        <span
          className={`priority ${task.priority.toLowerCase()}`}
        >
          {task.priority}
        </span>

        <select
          className="status"
          value={statusValue(task.status)}
          onClick={(event) =>
            event.stopPropagation()
          }
          onChange={(event) =>
            updateTaskStatus(
              task.id,
              event.target.value
            )
          }
        >
          <option value="todo">To Do</option>
          <option value="in_progress">
            In Progress
          </option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>

        <span
          className={`avatar ${task.tone}`}
        >
          {task.initials}
        </span>
      </article>
    );
  }

  /*
   * DASHBOARD
   */

  function renderDashboard() {
    return (
      <>
        <section
          className={`welcome mood-${timeMood.mood}`}
        >
          <div>
            <h1>
              {timeMood.greeting},{" "}
              {currentName}{" "}
              <span className="greeting-emoji">
                {timeMood.emoji}
              </span>
            </h1>

            <p>
              {today.toLocaleDateString(
                "en-US",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }
              )}{" "}
              · {timeMood.message}
            </p>
          </div>

          <button
            className="new-task mobile-new"
            onClick={() => setModalOpen(true)}
          >
            ＋ New Task
          </button>
        </section>

        <section className="stats-grid">
          <Stat
            icon="☑"
            color="sky"
            value={totalTasks}
            label="Total Tasks"
            note={`${todayTasks} due today`}
          />

          <Stat
            icon="◷"
            color="orange"
            value={inProgress}
            label="In Progress"
            note={`${inProgress} active`}
          />

          <Stat
            icon="✓"
            color="green"
            value={completed}
            label="Completed"
            note={`${completionRate}% completion rate`}
          />

          <Stat
            icon="⚠"
            color="red"
            value={overdue}
            label="Overdue"
            note={
              overdue
                ? "Action needed"
                : "Nothing overdue"
            }
          />
        </section>

        <section className="dashboard-grid">
          <div className="card task-card">
            <div className="card-head">
              <h2>My Tasks</h2>

              <div className="filters">
                {(
                  [
                    "All",
                    "In Progress",
                    "To Do",
                    "Review",
                    "Done",
                  ] as TaskStatus[]
                ).map((item) => (
                  <button
                    key={item}
                    onClick={() =>
                      setFilter(item)
                    }
                    className={
                      filter === item
                        ? "selected"
                        : ""
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="advanced-search">
              <input
                placeholder="Search tasks..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <button
                onClick={() =>
                  setAdvancedSearch(
                    !advancedSearch
                  )
                }
              >
                ⚙ Filters
              </button>

              {advancedSearch && (
                <select
                  value={priorityFilter}
                  onChange={(event) =>
                    setPriorityFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="All">
                    All priorities
                  </option>
                  <option value="Low">
                    Low
                  </option>
                  <option value="Medium">
                    Medium
                  </option>
                  <option value="High">
                    High
                  </option>
                  <option value="Critical">
                    Critical
                  </option>
                </select>
              )}
            </div>

            <div className="task-list">
              {filteredTasks.length === 0 ? (
                <p className="empty-state">
                  No tasks found.
                </p>
              ) : (
                filteredTasks
                  .slice(0, 8)
                  .map((task) =>
                    renderTaskRow(task)
                  )
              )}
            </div>

            <button
              className="view-all"
              onClick={() =>
                setActiveMenu("My Tasks")
              }
            >
              View all tasks →
            </button>
          </div>

          <div className="card progress-card">
            <div className="card-head">
              <h2>Weekly Progress</h2>

              <div className="legend">
                <span>
                  <i className="done-dot" />
                  Done
                </span>

                <span>
                  <i className="total-dot" />
                  Total
                </span>
              </div>
            </div>

            <div className="chart">
              {weeklyTasks.map((item) => {
                const totalHeight =
                  item.total === 0
                    ? 8
                    : Math.max(
                        15,
                        (item.total /
                          maxWeekly) *
                          100
                      );

                const doneHeight =
                  item.total === 0
                    ? 0
                    : (item.done /
                        item.total) *
                      totalHeight;

                return (
                  <div
                    className="bar-wrap"
                    key={item.label}
                  >
                    <div
                      className="total-bar"
                      style={{
                        height: `${totalHeight}%`,
                      }}
                    >
                      <div
                        className="done-bar"
                        style={{
                          height: `${doneHeight}%`,
                        }}
                      />
                    </div>

                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="progress-summary">
              <div>
                <span>
                  Tasks completed
                </span>

                <strong>
                  {completed}{" "}
                  <em>
                    / {totalTasks}
                  </em>
                </strong>
              </div>

              <b>{completionRate}%</b>
            </div>
          </div>
        </section>
      </>
    );
  }

  /*
   * MY TASKS
   */

  function renderMyTasks() {
    return (
      <section className="card task-card">
        <div className="card-head">
          <h2>My Tasks</h2>

          <button
            className="new-task"
            onClick={() =>
              setModalOpen(true)
            }
          >
            ＋ New Task
          </button>
        </div>

        <div className="advanced-search">
          <input
            placeholder="Search title, priority..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All priorities
            </option>
            <option value="Low">Low</option>
            <option value="Medium">
              Medium
            </option>
            <option value="High">High</option>
            <option value="Critical">
              Critical
            </option>
          </select>
        </div>

        <div className="filters task-filters">
          {(
            [
              "All",
              "In Progress",
              "To Do",
              "Review",
              "Done",
            ] as TaskStatus[]
          ).map((item) => (
            <button
              key={item}
              onClick={() =>
                setFilter(item)
              }
              className={
                filter === item
                  ? "selected"
                  : ""
              }
            >
              {item}
            </button>
          ))}
        </div>

        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <p className="empty-state">
              No tasks found.
            </p>
          ) : (
            filteredTasks.map((task) =>
              renderTaskRow(task)
            )
          )}
        </div>
      </section>
    );
  }

  /*
   * TASK BOARD
   */

  function renderTaskBoard() {
    return (
      <section>
        <div className="welcome">
          <div>
            <h1>Task Board 🎯</h1>

            <p>
              Drag tasks between columns
              to update their status.
            </p>
          </div>

          <button
            className="new-task"
            onClick={() =>
              setModalOpen(true)
            }
          >
            ＋ New Task
          </button>
        </div>

        <div className="kanban">
          {statuses.map((column) => {
            const tasks =
              dashboardTasks.filter(
                (task) =>
                  statusValue(
                    task.status
                  ) === column.key
              );

            return (
              <div
                className="kanban-column"
                key={column.key}
                onDragOver={(event) =>
                  event.preventDefault()
                }
                onDrop={() =>
                  handleDrop(
                    column.key
                  )
                }
              >
                <div className="kanban-head">
                  <h2>
                    {column.label}
                  </h2>

                  <span>
                    {tasks.length}
                  </span>
                </div>

                <div className="kanban-list">
                  {tasks.length === 0 ? (
                    <div className="drop-zone">
                      Drop task here
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <article
                        className="kanban-task"
                        key={task.id}
                        draggable
                        onDragStart={() =>
                          handleDragStart(
                            task
                          )
                        }
                        onClick={() =>
                          loadComments(
                            task
                          )
                        }
                      >
                        <strong>
                          {task.title}
                        </strong>

                        <div>
                          <span
                            className={`priority ${task.priority.toLowerCase()}`}
                          >
                            {task.priority}
                          </span>

                          <span
                            className={`avatar ${task.tone}`}
                          >
                            {task.initials}
                          </span>
                        </div>

                        <small>
                          {task.due}
                        </small>
                      </article>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  /*
   * TEAM
   */

  function renderTeam() {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Team 👥</h2>

          <span>
            {teamMembers.length} members
          </span>
        </div>

        <div className="team-grid">
          {teamMembers.map((member) => (
            <article
              key={member.id}
              className="team-member"
            >
              <span className="avatar blue">
                {initials(
                  member.full_name,
                  member.email
                )}
              </span>

              <div>
                <strong>
                  {member.full_name ||
                    member.email ||
                    "Unnamed"}
                </strong>

                <p>
                  {member.role ||
                    "Team member"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  /*
   * CALENDAR
   */

  function renderCalendar() {
    const calendarTasks =
      [...dashboardTasks]
        .filter((task) => task.dueDate)
        .sort(
          (a, b) =>
            new Date(
              a.dueDate!
            ).getTime() -
            new Date(
              b.dueDate!
            ).getTime()
        );

    return (
      <section>
        <div className="welcome">
          <div>
            <h1>Calendar 📅</h1>

            <p>
              Upcoming deadlines
              and scheduled work.
            </p>
          </div>

          <button
            className="new-task"
            onClick={() =>
              setModalOpen(true)
            }
          >
            ＋ New Task
          </button>
        </div>

        <div className="calendar-grid">
          {calendarTasks.length === 0 ? (
            <div className="card empty-calendar">
              <h2>No deadlines yet</h2>
              <p>
                Create a task with a
                due date to see it here.
              </p>
            </div>
          ) : (
            calendarTasks.map((task) => (
              <article
                className="calendar-event"
                key={task.id}
                onClick={() =>
                  loadComments(task)
                }
              >
                <div className="calendar-date">
                  {task.dueDate &&
                    new Date(
                      task.dueDate
                    ).getDate()}
                </div>

                <div>
                  <strong>
                    {task.title}
                  </strong>

                  <p>
                    {task.due}
                  </p>
                </div>

                <span
                  className={`priority ${task.priority.toLowerCase()}`}
                >
                  {task.priority}
                </span>
              </article>
            ))
          )}
        </div>
      </section>
    );
  }

  /*
   * NOTICES
   */

  function renderNotices() {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Notices 🔔</h2>
          <span>2 updates</span>
        </div>

        <div className="notice-list">
          <article>
            <span>🚀</span>
            <div>
              <h3>
                Welcome to SoftITBD
              </h3>
              <p>
                Use the Task Board to
                manage your work.
              </p>
            </div>
          </article>

          <article>
            <span>📌</span>
            <div>
              <h3>
                Keep task statuses updated
              </h3>
              <p>
                Updated statuses keep
                reports accurate.
              </p>
            </div>
          </article>
        </div>
      </section>
    );
  }

  /*
   * REPORTS
   */

  function renderReports() {
    const employeeStats =
      teamMembers.map((member) => {
        const tasks =
          dashboardTasks.filter(
            (task) =>
              task.assignedTo ===
              member.id
          );

        const done =
          tasks.filter(
            (task) =>
              task.status === "Done"
          ).length;

        const rate =
          tasks.length === 0
            ? 0
            : Math.round(
                (done /
                  tasks.length) *
                  100
              );

        return {
          ...member,
          total: tasks.length,
          done,
          rate,
        };
      });

    return (
      <section>
        <div className="welcome">
          <div>
            <h1>
              Reports 📊
            </h1>

            <p>
              Performance and
              productivity overview.
            </p>
          </div>
        </div>

        <section className="stats-grid">
          <Stat
            icon="☑"
            color="sky"
            value={totalTasks}
            label="Total Tasks"
            note="Current workspace"
          />

          <Stat
            icon="◷"
            color="orange"
            value={inProgress}
            label="In Progress"
            note="Currently active"
          />

          <Stat
            icon="✓"
            color="green"
            value={completed}
            label="Completed"
            note={`${completionRate}% completion`}
          />

          <Stat
            icon="⚠"
            color="red"
            value={overdue}
            label="Overdue"
            note="Needs attention"
          />
        </section>

        <div className="card performance-card">
          <div className="card-head">
            <h2>
              Employee Performance 🏆
            </h2>
          </div>

          {employeeStats.map(
            (member) => (
              <div
                className="performance-row"
                key={member.id}
              >
                <span className="avatar blue">
                  {initials(
                    member.full_name,
                    member.email
                  )}
                </span>

                <div className="performance-name">
                  <strong>
                    {member.full_name ||
                      member.email}
                  </strong>

                  <small>
                    {member.done} /{" "}
                    {member.total}{" "}
                    completed
                  </small>
                </div>

                <div className="performance-bar">
                  <span
                    style={{
                      width: `${member.rate}%`,
                    }}
                  />
                </div>

                <strong>
                  {member.rate}%
                </strong>
              </div>
            )
          )}
        </div>
      </section>
    );
  }

  /*
   * SETTINGS
   */

  function renderSettings() {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Settings ⚙</h2>
        </div>

        <div className="settings-body">
          <div className="setting-item">
            <div>
              <strong>
                Dark Mode
              </strong>

              <p>
                Switch between light
                and dark appearance.
              </p>
            </div>

            <button
              className={`toggle ${
                darkMode
                  ? "on"
                  : ""
              }`}
              onClick={() =>
                setDarkMode(
                  !darkMode
                )
              }
            >
              <span />
            </button>
          </div>

          <hr />

          <h3>Profile</h3>

          <p>
            <strong>Name:</strong>{" "}
            {currentName}
          </p>

          <p>
            <strong>Email:</strong>{" "}
            {profile?.email ||
              "Not available"}
          </p>

          <p>
            <strong>Role:</strong>{" "}
            {profile?.role ||
              "Team member"}
          </p>

          <button
            className="new-task"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </section>
    );
  }

  /*
   * ACTIVE PAGE
   */

  function renderActivePage() {
    switch (activeMenu) {
      case "My Tasks":
        return renderMyTasks();

      case "Task Board":
        return renderTaskBoard();

      case "Team":
        return renderTeam();

      case "Calendar":
        return renderCalendar();

      case "Notices":
        return renderNotices();

      case "Reports":
        return renderReports();

      case "Settings":
        return renderSettings();

      default:
        return renderDashboard();
    }
  }

  /*
   * LOADING
   */

  if (checkingSession) {
    return (
      <main className="loading-screen">
        <div className="loading-box">
          <div className="loading-logo">
            <img
              src="/logo.png"
              alt="SoftITBD"
            />
          </div>

          <div className="loader" />

          <strong>
            Loading SoftITBD
          </strong>

          <span>
            Task Manager
          </span>
        </div>
      </main>
    );
  }

  /*
   * LOGIN
   */

  if (!signedIn) {
    return (
      <main className="login-screen">
        <div className="login-bg-orb orb-one" />
        <div className="login-bg-orb orb-two" />

        <form
          className="login-card"
          onSubmit={signIn}
        >
          <div className="brand-mark login-logo">
            <img
              src="/logo.png"
              alt="SoftITBD"
            />
          </div>

          <h1>
            SoftITBD
          </h1>

          <p>
            Task Manager
          </p>

          <h2>
            Welcome back 👋
          </h2>

          <label>
            Office email

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="name@softitbd.com"
              required
            />
          </label>

          <label>
            Password

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Enter your password"
              required
            />
          </label>

          {authError && (
            <div className="auth-error">
              {authError}
            </div>
          )}

          <button
            className="new-task"
            type="submit"
          >
            Sign in →
          </button>

          <small>
            Use your Supabase account
            email and password.
          </small>
        </form>
      </main>
    );
  }

  /*
   * MAIN APP
   */

  return (
    <main
      className={`app-shell mood-${timeMood.mood}`}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <img
              src="/logo.png"
              alt="SoftITBD"
            />
          </div>

          <div>
            <strong>
              SoftITBD
            </strong>

            <span>
              Task Manager
            </span>
          </div>
        </div>

        <div className="menu-title">
          MAIN MENU
        </div>

        <nav>
          {menu.map(
            ([icon, label]) => (
              <button
                key={label}
                className={`nav-item ${
                  activeMenu ===
                  label
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setActiveMenu(
                    label
                  );
                  setFilter(
                    "All"
                  );
                }}
              >
                <span>
                  {icon}
                </span>

                {label}

                {label ===
                  "Notices" && (
                  <b className="notice-count">
                    2
                  </b>
                )}
              </button>
            )
          )}
        </nav>

        <div className="profile-card">
          <div className="avatar blue">
            {currentInitials}
          </div>

          <div>
            <strong>
              {currentName}
            </strong>

            <span>
              {profile?.role ||
                "Team Member"}
            </span>
          </div>

          <button
            aria-label="Logout"
            onClick={logout}
          >
            ⋮
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>
              SoftITBD
            </span>

            <b>›</b>

            <strong>
              {activeMenu}
            </strong>
          </div>

          <div className="top-actions">
            <label className="search">
              <span>⌕</span>

              <input
                placeholder="Search tasks, projects..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </label>

            <button
              className="theme-button"
              onClick={() =>
                setDarkMode(
                  !darkMode
                )
              }
              aria-label="Toggle dark mode"
            >
              {darkMode
                ? "☀️"
                : "🌙"}
            </button>

            <button
              className="bell"
              aria-label="Notifications"
              onClick={() =>
                setActiveMenu(
                  "Notices"
                )
              }
            >
              ♧
              <i />
            </button>

            <button
              className="new-task"
              onClick={() =>
                setModalOpen(
                  true
                )
              }
            >
              ＋ New Task
            </button>

            <button
              className="user-menu"
              onClick={logout}
            >
              <span className="avatar blue">
                {currentInitials}
              </span>

              {currentName}

              <b>
                Logout
              </b>
            </button>
          </div>
        </header>

        <div className="content">
          {renderActivePage()}
        </div>
      </section>

      {/*
       * NEW TASK MODAL
       */}

      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={() =>
            setModalOpen(
              false
            )
          }
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="close"
              onClick={() =>
                setModalOpen(
                  false
                )
              }
            >
              ×
            </button>

            <h2>
              Create New Task 🚀
            </h2>

            <p>
              Add a task to the
              SoftITBD workspace.
            </p>

            <input
              value={taskTitle}
              onChange={(event) =>
                setTaskTitle(
                  event.target.value
                )
              }
              placeholder="Task title"
            />

            <select
              value={taskPriority}
              onChange={(event) =>
                setTaskPriority(
                  event.target
                    .value as Priority
                )
              }
            >
              <option value="low">
                Low
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="high">
                High
              </option>

              <option value="critical">
                Critical
              </option>
            </select>

            <label className="modal-label">
              Due date
            </label>

            <input
              type="date"
              value={taskDueDate}
              onChange={(event) =>
                setTaskDueDate(
                  event.target.value
                )
              }
            />

            <select
              value={assigneeId}
              onChange={(event) =>
                setAssigneeId(
                  event.target.value
                )
              }
            >
              <option value="">
                Assign to me
              </option>

              {teamMembers.map(
                (member) => (
                  <option
                    key={member.id}
                    value={
                      member.id
                    }
                  >
                    {member.full_name ||
                      member.email ||
                      "Unnamed employee"}{" "}
                    ·{" "}
                    {member.role ||
                      "Team member"}
                  </option>
                )
              )}
            </select>

            {taskError && (
              <div className="auth-error">
                {taskError}
              </div>
            )}

            <button
              className="new-task"
              disabled={
                savingTask
              }
              onClick={
                createTask
              }
            >
              {savingTask
                ? "Saving..."
                : "Create Task"}
            </button>
          </div>
        </div>
      )}

      {/*
       * COMMENTS MODAL
       */}

      {selectedTask && (
        <div
          className="modal-backdrop"
          onClick={() =>
            setSelectedTask(null)
          }
        >
          <div
            className="modal comments-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="close"
              onClick={() =>
                setSelectedTask(null)
              }
            >
              ×
            </button>

            <h2>
              {selectedTask.title}
            </h2>

            <p>
              💬 Task comments
            </p>

            <div className="comments-list">
              {comments.length ===
              0 ? (
                <div className="empty-comments">
                  No comments yet.
                  <br />
                  Start the
                  conversation.
                </div>
              ) : (
                comments.map(
                  (comment) => (
                    <article
                      key={
                        comment.id
                      }
                    >
                      <div className="avatar blue">
                        {currentInitials}
                      </div>

                      <div>
                        <strong>
                          Team member
                        </strong>

                        <p>
                          {
                            comment.comment
                          }
                        </p>

                        <small>
                          {new Date(
                            comment.created_at
                          ).toLocaleString()}
                        </small>
                      </div>
                    </article>
                  )
                )
              )}
            </div>

            <div className="comment-input">
              <textarea
                value={commentText}
                onChange={(event) =>
                  setCommentText(
                    event.target.value
                  )
                }
                placeholder="Write a comment..."
              />

              <button
                className="new-task"
                disabled={
                  commentLoading
                }
                onClick={
                  addComment
                }
              >
                {commentLoading
                  ? "Posting..."
                  : "Post comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({
  icon,
  color,
  value,
  label,
  note,
}: {
  icon: string;
  color: string;
  value: number;
  label: string;
  note: string;
}) {
  return (
    <article
      className={`stat-card ${color}`}
    >
      <div className="stat-icon">
        {icon}
      </div>

      <span className="chevron">
        ↗
      </span>

      <strong>
        <AnimatedNumber value={value} />
      </strong>

      <h2>{label}</h2>

      <p>{note}</p>
    </article>
  );
}