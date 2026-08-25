"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

type TaskStatus = "All" | "In Progress" | "To Do" | "Review" | "Done";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
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

function statusLabel(status: string) {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "todo":
      return "To Do";
    case "review":
      return "Review";
    case "done":
      return "Done";
    default:
      return status;
  }
}

function priorityLabel(priority: string) {
  if (!priority) return "Medium";
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function formatDueDate(date: string | null) {
  if (!date) return "No deadline";

  return `Due ${new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function initials(name: string | null, email: string | null) {
  const value = name?.trim() || email?.split("@")[0] || "ME";

  const parts = value.split(/\s+/);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}

export default function Home() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);

  const [filter, setFilter] = useState<TaskStatus>("All");
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [modalOpen, setModalOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [taskError, setTaskError] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSignedIn(Boolean(session));
      setCheckingSession(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setProfile(null);
      setTasks([]);
      setTeamMembers([]);
      return;
    }

    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [profileResult, taskResult, teamResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,full_name,email,role")
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("tasks")
            .select(
              "id,title,priority,status,due_date,assigned_to,created_at"
            )
            .eq("assigned_to", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("profiles")
            .select("id,full_name,email,role")
            .order("full_name"),
        ]);

      if (profileResult.data) {
        setProfile(profileResult.data);
      } else {
        setProfile({
          id: user.id,
          full_name: null,
          email: user.email ?? null,
          role: "Employee",
        });
      }

      if (!taskResult.error && taskResult.data) {
        setTasks(taskResult.data);
      }

      if (!teamResult.error && teamResult.data) {
        setTeamMembers(teamResult.data);
      }
    }

    loadData();
  }, [signedIn]);

  const displayName =
    profile?.full_name?.trim() ||
    profile?.email?.split("@")[0] ||
    "User";

  const displayRole = profile?.role || "Employee";

  const userInitials = initials(profile?.full_name, profile?.email);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (filter !== "All") {
      result = result.filter(
        (task) => statusLabel(task.status) === filter
      );
    }

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter((task) =>
        task.title.toLowerCase().includes(query)
      );
    }

    return result;
  }, [tasks, filter, search]);

  const totalTasks = tasks.length;

  const inProgress = tasks.filter(
    (task) => task.status === "in_progress"
  ).length;

  const completed = tasks.filter(
    (task) => task.status === "done"
  ).length;

  const overdue = tasks.filter((task) => {
    if (!task.due_date || task.status === "done") return false;

    return new Date(task.due_date) < new Date();
  }).length;

  const completionRate =
    totalTasks === 0
      ? 0
      : Math.round((completed / totalTasks) * 100);

  const today = new Date();

  const todayString = today.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setAuthError("");
    setLoginLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError(error.message);
      setLoginLoading(false);
      return;
    }

    setLoginLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();

    setProfile(null);
    setTasks([]);
    setTeamMembers([]);
    setSignedIn(false);
  }

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

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: newStatus,
            }
          : task
      )
    );
  }

  async function createTask() {
    if (!taskTitle.trim()) {
      setTaskError("Please enter a task title.");
      return;
    }

    setSavingTask(true);
    setTaskError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setTaskError("Your session has expired. Please login again.");
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
        "id,title,priority,status,due_date,assigned_to,created_at"
      )
      .single();

    if (error) {
      setTaskError(error.message);
      setSavingTask(false);
      return;
    }

    if (data) {
      setTasks((current) => [data, ...current]);
    }

    setTaskTitle("");
    setTaskPriority("medium");
    setTaskDueDate("");
    setAssigneeId("");
    setSavingTask(false);
    setModalOpen(false);
  }

  if (checkingSession) {
    return (
      <main className="loading-screen">
        Loading SoftITBD Task Manager…
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="login-screen">
        <form className="login-card" onSubmit={signIn}>
          <div className="brand-mark">✓</div>

          <h1>SoftITBD</h1>
          <p>Task Manager</p>

          <h2>Welcome back</h2>

          <label>
            Office email
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
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
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              required
            />
          </label>

          {authError && (
            <div className="auth-error">{authError}</div>
          )}

          <button
            className="new-task"
            type="submit"
            disabled={loginLoading}
          >
            {loginLoading ? "Signing in..." : "Sign in"}
          </button>

          <small>
            Use your Supabase account email and password.
          </small>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">✓</div>

          <div>
            <strong>SoftITBD</strong>
            <span>Task Manager</span>
          </div>
        </div>

        <div className="menu-title">MAIN MENU</div>

        <nav>
          {menu.map(([icon, label]) => (
            <button
              key={label}
              className={`nav-item ${
                activeMenu === label ? "active" : ""
              }`}
              onClick={() => setActiveMenu(label)}
            >
              <span>{icon}</span>
              {label}

              {label === "Notices" && (
                <b className="notice-count">3</b>
              )}
            </button>
          ))}
        </nav>

        <div className="profile-card">
          <div className="avatar blue">
            {userInitials}
          </div>

          <div>
            <strong>{displayName}</strong>
            <span>{displayRole}</span>
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
            <span>SoftITBD</span>
            <b>›</b>
            <strong>{activeMenu}</strong>
          </div>

          <div className="top-actions">
            <label className="search">
              <span>⌕</span>

              <input
                placeholder="Search tasks..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <button
              className="bell"
              aria-label="Notifications"
            >
              ♧
              <i />
            </button>

            <button
              className="new-task"
              onClick={() => setModalOpen(true)}
            >
              <span>＋</span>
              New Task
            </button>

            <button
              className="user-menu"
              onClick={logout}
            >
              <span className="avatar blue">
                {userInitials}
              </span>

              {displayName}

              <b>Logout</b>
            </button>
          </div>
        </header>

        <div className="content">
          <section className="welcome">
            <div>
              <h1>
                Good morning, {displayName}{" "}
                <span>👋</span>
              </h1>

              <p>
                {todayString} · Here's what's happening
                today.
              </p>
            </div>

            <button
              className="new-task mobile-new"
              onClick={() => setModalOpen(true)}
            >
              <span>＋</span>
              New Task
            </button>
          </section>

          <section className="stats-grid">
            <Stat
              icon="☑"
              color="sky"
              value={String(totalTasks)}
              label="Total Tasks"
              note="Your assigned tasks"
            />

            <Stat
              icon="◷"
              color="orange"
              value={String(inProgress)}
              label="In Progress"
              note="Currently active"
            />

            <Stat
              icon="✓"
              color="green"
              value={String(completed)}
              label="Completed"
              note={`${completionRate}% completion rate`}
            />

            <Stat
              icon="⚠"
              color="red"
              value={String(overdue)}
              label="Overdue"
              note={
                overdue > 0
                  ? "Action needed"
                  : "You're all caught up"
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
                      onClick={() => setFilter(item)}
                      className={
                        filter === item ? "selected" : ""
                      }
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="task-list">
                {filteredTasks.length === 0 ? (
                  <div style={{ padding: "30px" }}>
                    <strong>No tasks found.</strong>
                    <p>
                      Create a new task or wait for a task
                      to be assigned to you.
                    </p>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <article
                      className="task-row"
                      key={task.id}
                    >
                      <button
                        className="check"
                        aria-label={`Complete ${task.title}`}
                        onClick={() =>
                          updateTaskStatus(
                            task.id,
                            task.status === "done"
                              ? "todo"
                              : "done"
                          )
                        }
                      />

                      <div className="task-copy">
                        <h3>{task.title}</h3>

                        <p>
                          SoftITBD
                          <span>•</span>
                          {formatDueDate(task.due_date)}
                        </p>
                      </div>

                      <span
                        className={`priority ${task.priority.toLowerCase()}`}
                      >
                        {priorityLabel(task.priority)}
                      </span>

                      <select
                        className="status"
                        value={task.status}
                        onChange={(event) =>
                          updateTaskStatus(
                            task.id,
                            event.target.value
                          )
                        }
                      >
                        <option value="todo">
                          To Do
                        </option>

                        <option value="in_progress">
                          In Progress
                        </option>

                        <option value="review">
                          Review
                        </option>

                        <option value="done">
                          Done
                        </option>
                      </select>

                      <span className="avatar blue">
                        {userInitials}
                      </span>
                    </article>
                  ))
                )}
              </div>

              <button
                className="view-all"
                onClick={() => setFilter("All")}
              >
                View all tasks <span>→</span>
              </button>
            </div>

            <div className="card progress-card">
              <div className="card-head">
                <h2>Task Progress</h2>
              </div>

              <div className="chart">
                {["To Do", "In Progress", "Review", "Done"].map(
                  (label) => {
                    const count =
                      label === "To Do"
                        ? tasks.filter(
                            (task) => task.status === "todo"
                          ).length
                        : label === "In Progress"
                          ? inProgress
                          : label === "Review"
                            ? tasks.filter(
                                (task) =>
                                  task.status === "review"
                              ).length
                            : completed;

                    const percentage =
                      totalTasks === 0
                        ? 0
                        : Math.max(
                            8,
                            (count / totalTasks) * 100
                          );

                    return (
                      <div
                        className="bar-wrap"
                        key={label}
                        style={{
                          marginBottom: "18px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            marginBottom: "6px",
                          }}
                        >
                          <span>{label}</span>
                          <strong>{count}</strong>
                        </div>

                        <div
                          className="total-bar"
                          style={{
                            height: "12px",
                            width: "100%",
                          }}
                        >
                          <div
                            className="done-bar"
                            style={{
                              height: "100%",
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="progress-summary">
                <div>
                  <span>Tasks completed</span>
                  <strong>
                    {completed} <em>/ {totalTasks}</em>
                  </strong>
                </div>

                <b>{completionRate}%</b>
              </div>
            </div>
          </section>
        </div>
      </section>

      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              className="close"
              onClick={() => setModalOpen(false)}
            >
              ×
            </button>

            <h2>Create New Task</h2>

            <p>
              Add a task to the SoftITBD workspace.
            </p>

            <input
              value={taskTitle}
              onChange={(event) =>
                setTaskTitle(event.target.value)
              }
              placeholder="Task title"
            />

            <select
              value={taskPriority}
              onChange={(event) =>
                setTaskPriority(event.target.value)
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">
                Critical
              </option>
            </select>

            <label style={{ marginTop: "10px" }}>
              Due date
              <input
                type="date"
                value={taskDueDate}
                onChange={(event) =>
                  setTaskDueDate(event.target.value)
                }
              />
            </label>

            <select
              value={assigneeId}
              onChange={(event) =>
                setAssigneeId(event.target.value)
              }
            >
              <option value="">
                Assign to me
              </option>

              {teamMembers.map((member) => (
                <option
                  key={member.id}
                  value={member.id}
                >
                  {member.full_name ||
                    member.email ||
                    "Unnamed employee"}{" "}
                  · {member.role || "Employee"}
                </option>
              ))}
            </select>

            {taskError && (
              <div className="auth-error">
                {taskError}
              </div>
            )}

            <button
              className="new-task"
              disabled={savingTask}
              onClick={createTask}
            >
              {savingTask
                ? "Saving..."
                : "Create Task"}
            </button>
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
  value: string;
  label: string;
  note: string;
}) {
  return (
    <article className={`stat-card ${color}`}>
      <div className="stat-icon">{icon}</div>

      <span className="chevron">⌃</span>

      <strong>{value}</strong>

      <h2>{label}</h2>

      <p>{note}</p>
    </article>
  );
}