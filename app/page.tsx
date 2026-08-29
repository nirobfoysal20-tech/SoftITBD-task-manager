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
  assignedTo: string | null;
  initials: string;
  tone: string;
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

function initials(name: string | null | undefined, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "User";
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
  const tones = ["blue", "purple", "orange", "green"];
  return tones[index % tones.length];
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
  const [taskPriority, setTaskPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [taskError, setTaskError] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  const [search, setSearch] = useState("");

  const currentName =
    profile?.full_name?.trim() ||
    profile?.email?.split("@")[0] ||
    "User";

  const currentInitials = initials(profile?.full_name, profile?.email);

  const filteredTasks = useMemo(() => {
    let result = dashboardTasks;

    if (filter !== "All") {
      result = result.filter((task) => task.status === filter);
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
  }, [dashboardTasks, filter, search]);

  const totalTasks = dashboardTasks.length;

  const inProgress = dashboardTasks.filter(
    (task) => task.status === "In Progress"
  ).length;

  const completed = dashboardTasks.filter(
    (task) => task.status === "Done"
  ).length;

  const overdue = dashboardTasks.filter((task) => {
    if (!task.dueDate || task.status === "Done") return false;

    return new Date(task.dueDate).getTime() < Date.now();
  }).length;

  const completionRate =
    totalTasks === 0 ? 0 : Math.round((completed / totalTasks) * 100);

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

      const done = tasks.filter((task) => task.status === "Done").length;

      return {
        label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
        total: tasks.length,
        done,
      };
    });
  }, [dashboardTasks]);

  const maxWeekly = Math.max(
    ...weeklyTasks.map((item) => item.total),
    1
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      setSignedIn(Boolean(data.session));
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setSignedIn(Boolean(session));

      if (!session) {
        setProfile(null);
        setDashboardTasks([]);
        setTeamMembers([]);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
          "id,title,status,priority,due_date,assigned_to,created_at"
        )
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

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
            initials: currentInitials,
            tone: taskTone(index),
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

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    setPassword("");
  }

  async function logout() {
    await supabase.auth.signOut();

    setSignedIn(false);
    setProfile(null);
    setDashboardTasks([]);
    setTeamMembers([]);
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
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
      setTaskError("Session শেষ হয়েছে। আবার login করুন।");
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
          initials: currentInitials,
          tone: "blue",
        },
        ...current,
      ]);
    }

    setTaskTitle("");
    setTaskPriority("medium");
    setAssigneeId("");
    setSavingTask(false);
    setModalOpen(false);
  }

  function renderTaskRow(task: DashboardTask) {
    return (
      <article className="task-row" key={task.id}>
        <button
          className="check"
          aria-label={`Mark ${task.title} as done`}
          onClick={() =>
            updateTaskStatus(
              task.id,
              task.status === "Done" ? "todo" : "done"
            )
          }
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
          onChange={(event) =>
            updateTaskStatus(task.id, event.target.value)
          }
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>

        <span className={`avatar ${task.tone}`}>
          {task.initials}
        </span>
      </article>
    );
  }

  function renderDashboard() {
    return (
      <>
        <section className="welcome">
          <div>
            <h1>
              Good morning, {currentName} <span>👋</span>
            </h1>

            <p>
              {today.toLocaleDateString("en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · Here&apos;s what&apos;s happening today.
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
            note={`${todayTasks} due today`}
          />

          <Stat
            icon="◷"
            color="orange"
            value={String(inProgress)}
            label="In Progress"
            note={`${Math.max(inProgress, 0)} active`}
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
            note={overdue ? "Action needed" : "Nothing overdue"}
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
                    className={filter === item ? "selected" : ""}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="task-list">
              {filteredTasks.length === 0 ? (
                <p style={{ padding: "20px" }}>
                  No tasks found.
                </p>
              ) : (
                filteredTasks.slice(0, 8).map(renderTaskRow)
              )}
            </div>

            <button
              className="view-all"
              onClick={() => setActiveMenu("My Tasks")}
            >
              View all tasks <span>→</span>
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
                        (item.total / maxWeekly) * 100
                      );

                const doneHeight =
                  item.total === 0
                    ? 0
                    : (item.done / item.total) * totalHeight;

                return (
                  <div className="bar-wrap" key={item.label}>
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
                <span>Tasks completed</span>

                <strong>
                  {completed} <em>/ {totalTasks}</em>
                </strong>
              </div>

              <b>{completionRate}%</b>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderMyTasks() {
    return (
      <section className="card task-card">
        <div className="card-head">
          <h2>My Tasks</h2>

          <button
            className="new-task"
            onClick={() => setModalOpen(true)}
          >
            ＋ New Task
          </button>
        </div>

        <div className="filters" style={{ padding: "16px" }}>
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
              className={filter === item ? "selected" : ""}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <p style={{ padding: "24px" }}>
              No tasks found.
            </p>
          ) : (
            filteredTasks.map(renderTaskRow)
          )}
        </div>
      </section>
    );
  }

  function renderTaskBoard() {
    const columns = [
      { key: "To Do", title: "To Do" },
      { key: "In Progress", title: "In Progress" },
      { key: "Review", title: "Review" },
      { key: "Done", title: "Done" },
    ];

    return (
      <section>
        <div className="welcome">
          <div>
            <h1>Task Board</h1>
            <p>Manage your tasks by workflow status.</p>
          </div>

          <button
            className="new-task"
            onClick={() => setModalOpen(true)}
          >
            ＋ New Task
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "18px",
          }}
        >
          {columns.map((column) => {
            const tasks = dashboardTasks.filter(
              (task) => task.status === column.key
            );

            return (
              <div className="card" key={column.key}>
                <div className="card-head">
                  <h2>{column.title}</h2>
                  <strong>{tasks.length}</strong>
                </div>

                <div className="task-list">
                  {tasks.length === 0 ? (
                    <p style={{ padding: "20px" }}>
                      No tasks
                    </p>
                  ) : (
                    tasks.map(renderTaskRow)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  function renderTeam() {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Team</h2>
          <span>{teamMembers.length} members</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            padding: "20px",
          }}
        >
          {teamMembers.map((member) => (
            <article
              key={member.id}
              className="card"
              style={{ padding: "18px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span className="avatar blue">
                  {initials(member.full_name, member.email)}
                </span>

                <div>
                  <strong>
                    {member.full_name ||
                      member.email ||
                      "Unnamed"}
                  </strong>

                  <p style={{ margin: "4px 0 0" }}>
                    {member.role || "Team member"}
                  </p>
                </div>
              </div>

              {member.email && (
                <p style={{ marginTop: "14px" }}>
                  {member.email}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderCalendar() {
    const calendarTasks = [...dashboardTasks]
      .filter((task) => task.dueDate)
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() -
          new Date(b.dueDate!).getTime()
      );

    return (
      <section className="card">
        <div className="card-head">
          <h2>Calendar</h2>
          <span>Upcoming task deadlines</span>
        </div>

        <div className="task-list">
          {calendarTasks.length === 0 ? (
            <p style={{ padding: "24px" }}>
              No tasks with deadlines.
            </p>
          ) : (
            calendarTasks.map(renderTaskRow)
          )}
        </div>
      </section>
    );
  }

  function renderNotices() {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Notices</h2>
        </div>

        <div style={{ padding: "24px" }}>
          <article
            className="card"
            style={{
              padding: "20px",
              marginBottom: "14px",
            }}
          >
            <h3>Welcome to SoftITBD Task Manager</h3>

            <p>
              Use the Task Board to manage your work and keep
              your tasks updated.
            </p>
          </article>

          <article
            className="card"
            style={{ padding: "20px" }}
          >
            <h3>Task status reminder</h3>

            <p>
              Please keep task statuses updated so the dashboard
              statistics remain accurate.
            </p>
          </article>
        </div>
      </section>
    );
  }

  function renderReports() {
    return (
      <section>
        <div className="welcome">
          <div>
            <h1>Reports</h1>

            <p>
              Overview of your current task performance.
            </p>
          </div>
        </div>

        <section className="stats-grid">
          <Stat
            icon="☑"
            color="sky"
            value={String(totalTasks)}
            label="Total Tasks"
            note="Assigned to you"
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
            note={`${completionRate}% completion`}
          />

          <Stat
            icon="⚠"
            color="red"
            value={String(overdue)}
            label="Overdue"
            note="Needs attention"
          />
        </section>
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Settings</h2>
        </div>

        <div style={{ padding: "24px" }}>
          <h3>Profile</h3>

          <p>
            <strong>Name:</strong> {currentName}
          </p>

          <p>
            <strong>Email:</strong>{" "}
            {profile?.email || "Not available"}
          </p>

          <p>
            <strong>Role:</strong>{" "}
            {profile?.role || "Team member"}
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
          <div
            className="brand-mark"
            style={{
              background: "transparent",
              padding: 0,
              overflow: "hidden",
            }}
          >
            <img
              src="/logo.png"
              alt="SoftITBD"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>

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
          >
            Sign in
          </button>

          <small>
            Use the Admin email and password you created in
            Supabase.
          </small>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div
            className="brand-mark"
            style={{
              background: "transparent",
              padding: 0,
              overflow: "hidden",
            }}
          >
            <img
              src="/logo.png"
              alt="SoftITBD"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>

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
                activeMenu === label ? "active" : ""
              }`}
              onClick={() => {
                setActiveMenu(label);
                setFilter("All");
              }}
            >
              <span>{icon}</span>

              {label}

              {label === "Notices" && (
                <b className="notice-count">
                  2
                </b>
              )}
            </button>
          ))}
        </nav>

        <div className="profile-card">
          <div className="avatar blue">
            {currentInitials}
          </div>

          <div>
            <strong>{currentName}</strong>
            <span>
              {profile?.role || "Team Member"}
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
            <span>SoftITBD</span>
            <b>›</b>
            <strong>{activeMenu}</strong>
          </div>

          <div className="top-actions">
            <label className="search">
              <span>⌕</span>

              <input
                placeholder="Search tasks, projects..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <button
              className="bell"
              aria-label="Notifications"
              onClick={() =>
                setActiveMenu("Notices")
              }
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
                {currentInitials}
              </span>

              {currentName}

              <b>Logout</b>
            </button>
          </div>
        </header>

        <div className="content">
          {renderActivePage()}
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

            <h2>Create New Task</h2>

            <p>
              Add a task to the SoftITBD workspace.
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

              {teamMembers.map((member) => (
                <option
                  key={member.id}
                  value={member.id}
                >
                  {member.full_name ||
                    member.email ||
                    "Unnamed employee"}{" "}
                  ·{" "}
                  {member.role ||
                    "Team member"}
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