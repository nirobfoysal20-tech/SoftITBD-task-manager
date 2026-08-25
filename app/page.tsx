"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

type TaskStatus = "All" | "In Progress" | "To Do" | "Review" | "Done";

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
  initials: string;
  tone: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

function statusLabel(status: string) {
  if (status === "in_progress") return "In Progress";
  if (status === "todo") return "To Do";
  if (status === "review") return "Review";
  if (status === "done") return "Done";
  return status;
}

function capitalize(value: string | null | undefined) {
  if (!value) return "Medium";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

function formatDueDate(date: string | null) {
  if (!date) return "No deadline";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "No deadline";

  return `Due ${parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function getStatusValue(status: string) {
  if (status === "In Progress") return "in_progress";
  if (status === "To Do") return "todo";
  if (status === "Review") return "review";
  return "done";
}

function getTone(index: number) {
  const tones = ["blue", "purple", "orange", "green"];
  return tones[index % tones.length];
}

export default function Home() {
  const [filter, setFilter] = useState<TaskStatus>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("Dashboard");

  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [dashboardTasks, setDashboardTasks] = useState<
    DashboardTask[]
  >([]);

  const [tasksLoading, setTasksLoading] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskError, setTaskError] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assigneeId, setAssigneeId] = useState("");

  const displayName =
    profile?.full_name ||
    profile?.email?.split("@")[0] ||
    email.split("@")[0] ||
    "User";

  const displayRole = profile?.role || "Team Member";

  const initials = initialsFromName(displayName);

  const filteredTasks = useMemo(() => {
    if (filter === "All") return dashboardTasks;

    return dashboardTasks.filter(
      (task) => task.status === filter
    );
  }, [filter, dashboardTasks]);

  const totalTasks = dashboardTasks.length;

  const inProgressTasks = dashboardTasks.filter(
    (task) => task.status === "In Progress"
  ).length;

  const completedTasks = dashboardTasks.filter(
    (task) => task.status === "Done"
  ).length;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const overdueTasks = dashboardTasks.filter((task) => {
    if (!task.dueDate) return false;
    if (task.status === "Done") return false;

    const due = new Date(task.dueDate);

    return !Number.isNaN(due.getTime()) && due < today;
  }).length;

  const completionRate =
    totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Profile loading error:", error);
      setProfile(null);
      return;
    }

    if (data) {
      setProfile(data);
    } else {
      setProfile(null);
    }
  }

  async function loadMyTasks(userId: string) {
    setTasksLoading(true);

    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id,title,status,priority,due_date,assigned_to,created_at"
      )
      .eq("assigned_to", userId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Task loading error:", error);
      setDashboardTasks([]);
      setTasksLoading(false);
      return;
    }

    const tasks: DashboardTask[] = (data || []).map(
      (task, index) => ({
        id: task.id,
        title: task.title,
        project: "SoftITBD",
        due: formatDueDate(task.due_date),
        dueDate: task.due_date,
        priority: capitalize(task.priority),
        status: statusLabel(task.status),
        initials,
        tone: getTone(index),
      })
    );

    setDashboardTasks(tasks);
    setTasksLoading(false);
  }

  async function loadTeamMembers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .order("full_name");

    if (error) {
      console.error("Team loading error:", error);
      return;
    }

    if (data) {
      setTeamMembers(data);
    }
  }

  async function loadUserData(userId: string) {
    await Promise.all([
      loadProfile(userId),
      loadMyTasks(userId),
      loadTeamMembers(),
    ]);
  }

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSignedIn(Boolean(session));

      if (session?.user) {
        await loadUserData(session.user.id);
      }

      if (mounted) {
        setCheckingSession(false);
      }
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setSignedIn(true);
          await loadUserData(session.user.id);
        } else {
          setSignedIn(false);
          setProfile(null);
          setDashboardTasks([]);
          setTeamMembers([]);
        }

        setCheckingSession(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setAuthError("");
    setLoginLoading(true);

    const { error } =
      await supabase.auth.signInWithPassword({
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

    setSignedIn(false);
    setProfile(null);
    setDashboardTasks([]);
    setTeamMembers([]);
    setFilter("All");
    setActiveMenu("Dashboard");
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
      console.error("Status update error:", error);
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
      })
      .select(
        "id,title,status,priority,due_date,assigned_to,created_at"
      )
      .single();

    if (error) {
      console.error("Create task error:", error);
      setTaskError(error.message);
      setSavingTask(false);
      return;
    }

    if (data) {
      const newTask: DashboardTask = {
        id: data.id,
        title: data.title,
        project: "SoftITBD",
        due: formatDueDate(data.due_date),
        dueDate: data.due_date,
        priority: capitalize(data.priority),
        status: statusLabel(data.status),
        initials,
        tone: "blue",
      };

      setDashboardTasks((current) => [
        newTask,
        ...current,
      ]);
    }

    setTaskTitle("");
    setTaskPriority("medium");
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
        <form
          className="login-card"
          onSubmit={signIn}
        >
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
            <div className="auth-error">
              {authError}
            </div>
          )}

          <button
            className="new-task"
            type="submit"
            disabled={loginLoading}
          >
            {loginLoading
              ? "Signing in..."
              : "Sign in"}
          </button>

          <small>
            Use the Admin email and password you
            created in Supabase.
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

        <div className="menu-title">
          MAIN MENU
        </div>

        <nav>
          {menu.map(([icon, label]) => (
            <button
              key={label}
              className={`nav-item ${
                activeMenu === label
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveMenu(label)
              }
            >
              <span>{icon}</span>
              {label}

              {label === "Notices" && (
                <b className="notice-count">
                  3
                </b>
              )}
            </button>
          ))}
        </nav>

        <div className="profile-card">
          <div className="avatar blue">
            {initials}
          </div>

          <div>
            <strong>{displayName}</strong>
            <span>{displayRole}</span>
          </div>

          <button
            aria-label="Logout"
            onClick={logout}
          >
            ↪
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
                placeholder="Search tasks, projects..."
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
              onClick={() =>
                setModalOpen(true)
              }
            >
              <span>＋</span>
              New Task
            </button>

            <button
              className="user-menu"
              onClick={logout}
            >
              <span className="avatar blue">
                {initials}
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
                {new Date().toLocaleDateString(
                  "en-US",
                  {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }
                )}{" "}
                · Here&apos;s what&apos;s happening
                today.
              </p>
            </div>

            <button
              className="new-task mobile-new"
              onClick={() =>
                setModalOpen(true)
              }
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
              value={String(
                inProgressTasks
              )}
              label="In Progress"
              note="Currently working"
            />

            <Stat
              icon="✓"
              color="green"
              value={String(
                completedTasks
              )}
              label="Completed"
              note={`${completionRate}% completion rate`}
            />

            <Stat
              icon="⚠"
              color="red"
              value={String(
                overdueTasks
              )}
              label="Overdue"
              note={
                overdueTasks > 0
                  ? "Action needed"
                  : "Everything on track"
              }
            />
          </section>

          <section className="dashboard-grid">
            <div className="card task-card">
              <div className="card-head">
                <h2>
                  My Tasks Today
                </h2>

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

              <div className="task-list">
                {tasksLoading ? (
                  <p
                    style={{
                      padding: "20px",
                    }}
                  >
                    Loading tasks...
                  </p>
                ) : filteredTasks.length === 0 ? (
                  <p
                    style={{
                      padding: "20px",
                    }}
                  >
                    No tasks found.
                  </p>
                ) : (
                  filteredTasks.map(
                    (task) => (
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
                              "done"
                            )
                          }
                        >
                          {task.status ===
                            "Done" && "✓"}
                        </button>

                        <div className="task-copy">
                          <h3>
                            {task.title}
                          </h3>

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
                          value={getStatusValue(
                            task.status
                          )}
                          onChange={(
                            event
                          ) =>
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

                        <span
                          className={`avatar ${task.tone}`}
                        >
                          {task.initials}
                        </span>
                      </article>
                    )
                  )
                )}
              </div>

              <button
                className="view-all"
                onClick={() =>
                  setFilter("All")
                }
              >
                View all tasks{" "}
                <span>→</span>
              </button>
            </div>

            <div className="card progress-card">
              <div className="card-head">
                <h2>
                  Task Progress
                </h2>

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
                {[
                  "To Do",
                  "In Progress",
                  "Review",
                  "Done",
                ].map((status) => {
                  const count =
                    dashboardTasks.filter(
                      (task) =>
                        task.status === status
                    ).length;

                  const max =
                    Math.max(
                      dashboardTasks.length,
                      1
                    );

                  const height =
                    (count / max) * 100;

                  return (
                    <div
                      className="bar-wrap"
                      key={status}
                    >
                      <div
                        className="total-bar"
                        style={{
                          height: "100%",
                        }}
                      >
                        <div
                          className="done-bar"
                          style={{
                            height: `${Math.max(
                              height,
                              count > 0
                                ? 8
                                : 0
                            )}%`,
                          }}
                        />
                      </div>

                      <span>
                        {status ===
                        "In Progress"
                          ? "Progress"
                          : status}
                      </span>
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
                    {completedTasks}{" "}
                    <em>
                      / {totalTasks}
                    </em>
                  </strong>
                </div>

                <b>
                  {completionRate}%
                </b>
              </div>
            </div>
          </section>
        </div>
      </section>

      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={() =>
            setModalOpen(false)
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
                setModalOpen(false)
              }
            >
              ×
            </button>

            <h2>
              Create New Task
            </h2>

            <p>
              Add a task to the SoftITBD
              workspace.
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
                  event.target.value
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
                    value={member.id}
                  >
                    {member.full_name ||
                      member.email ||
                      "Unnamed employee"}{" "}
                    ·{" "}
                    {member.role ||
                      "Team Member"}
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
    <article
      className={`stat-card ${color}`}
    >
      <div className="stat-icon">
        {icon}
      </div>

      <span className="chevron">
        ⌃
      </span>

      <strong>{value}</strong>

      <h2>{label}</h2>

      <p>{note}</p>
    </article>
  );
}