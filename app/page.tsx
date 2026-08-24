"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

type TaskStatus = "All" | "In Progress" | "To Do" | "Review";
type TeamMember = { id: string; full_name: string | null; email: string | null; role: string };

const demoTasks = [
  { title: "Design new API documentation", project: "DevOps", due: "Due Aug 24", priority: "High", status: "In Progress", initials: "FA", tone: "blue" },
  { title: "Fix auth token expiry bug on mobile app", project: "Mobile App", due: "Due Aug 25", priority: "Critical", status: "In Progress", initials: "SK", tone: "purple" },
  { title: "Prepare social media campaign report", project: "Marketing", due: "Due Aug 26", priority: "Medium", status: "To Do", initials: "NA", tone: "orange" },
  { title: "Review client dashboard feedback", project: "Web Team", due: "Due Aug 27", priority: "Low", status: "Review", initials: "RA", tone: "green" },
];
const menu = [["▦", "Dashboard"], ["☑", "My Tasks"], ["▤", "Task Board"], ["♧", "Team"], ["□", "Calendar"], ["♧", "Notices"], ["▥", "Reports"], ["⚙", "Settings"]];
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);

export default function Home() {
  const [filter, setFilter] = useState<TaskStatus>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [dashboardTasks, setDashboardTasks] = useState(demoTasks);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskError, setTaskError] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const filteredTasks = useMemo(() => filter === "All" ? dashboardTasks : dashboardTasks.filter((task) => task.status === filter), [filter, dashboardTasks]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSignedIn(Boolean(data.session)); setCheckingSession(false); });
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    supabase.from("tasks").select("title,status,priority,due_date").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error || !data?.length) return;
      setDashboardTasks(data.map((task) => ({
        title: task.title,
        project: "SoftITBD",
        due: task.due_date ? `Due ${new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No deadline",
        priority: task.priority.charAt(0).toUpperCase() + task.priority.slice(1),
        status: task.status === "in_progress" ? "In Progress" : task.status === "todo" ? "To Do" : task.status === "review" ? "Review" : "Done",
        initials: "RA",
        tone: "blue",
      })));
    });
  }, [signedIn]);
  useEffect(() => {
    if (!signedIn) return;
    supabase.from("profiles").select("id,full_name,email,role").order("full_name").then(({ data }) => {
      if (data) setTeamMembers(data);
    });
  }, [signedIn]);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message); else setSignedIn(true);
  }
  async function createTask() {
    if (!taskTitle.trim()) { setTaskError("Task title লিখুন।"); return; }
    setSavingTask(true); setTaskError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTaskError("Session শেষ হয়েছে। আবার login করুন।"); setSavingTask(false); return; }
    const { error } = await supabase.from("tasks").insert({ title: taskTitle.trim(), priority: taskPriority, status: "todo", created_by: user.id, assigned_to: assigneeId || user.id });
    if (error) { setTaskError(error.message); setSavingTask(false); return; }
    setDashboardTasks((current) => [{ title: taskTitle.trim(), project: "SoftITBD", due: "No deadline", priority: taskPriority.charAt(0).toUpperCase() + taskPriority.slice(1), status: "To Do", initials: "RA", tone: "blue" }, ...current]);
    setTaskTitle(""); setTaskPriority("medium"); setAssigneeId(""); setSavingTask(false); setModalOpen(false);
  }
  if (checkingSession) return <main className="loading-screen">Loading SoftITBD Task Manager…</main>;
  if (!signedIn) return <main className="login-screen"><form className="login-card" onSubmit={signIn}><div className="brand-mark">✓</div><h1>SoftITBD</h1><p>Task Manager</p><h2>Welcome back</h2><label>Office email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@softitbd.com" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>{authError && <div className="auth-error">{authError}</div>}<button className="new-task" type="submit">Sign in</button><small>Use the Admin email and password you created in Supabase.</small></form></main>;
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">✓</div><div><strong>SoftITBD</strong><span>Task Manager</span></div></div><div className="menu-title">MAIN MENU</div><nav>{menu.map(([icon, label]) => <button key={label} className={`nav-item ${activeMenu === label ? "active" : ""}`} onClick={() => setActiveMenu(label)}><span>{icon}</span>{label}{label === "Notices" && <b className="notice-count">3</b>}</button>)}</nav><div className="profile-card"><div className="avatar blue">RA</div><div><strong>Rahim Ahmed</strong><span>Project Manager</span></div><button aria-label="More options">⋮</button></div></aside>
    <section className="workspace"><header className="topbar"><div className="breadcrumb"><span>SoftITBD</span><b>›</b><strong>{activeMenu}</strong></div><div className="top-actions"><label className="search"><span>⌕</span><input placeholder="Search tasks, projects..." /></label><button className="bell" aria-label="Notifications">♧<i /></button><button className="new-task" onClick={() => setModalOpen(true)}><span>＋</span> New Task</button><button className="user-menu"><span className="avatar blue">RA</span> Rahim <b>⌄</b></button></div></header><div className="content"><section className="welcome"><div><h1>Good morning, Rahim <span>👋</span></h1><p>Sunday, 24 August 2026 · Here&apos;s what&apos;s happening today.</p></div><button className="new-task mobile-new" onClick={() => setModalOpen(true)}><span>＋</span> New Task</button></section><section className="stats-grid"><Stat icon="☑" color="sky" value="148" label="Total Tasks" note="+12 this week" /><Stat icon="◷" color="orange" value="43" label="In Progress" note="8 due today" /><Stat icon="✓" color="green" value="97" label="Completed" note="65% completion rate" /><Stat icon="⚠" color="red" value="8" label="Overdue" note="Action needed" /></section><section className="dashboard-grid"><div className="card task-card"><div className="card-head"><h2>My Tasks Today</h2><div className="filters">{(["All", "In Progress", "To Do", "Review"] as TaskStatus[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "selected" : ""}>{item}</button>)}</div></div><div className="task-list">{filteredTasks.map((task) => <article className="task-row" key={task.title}><button className="check" aria-label={`Complete ${task.title}`} /><div className="task-copy"><h3>{task.title}</h3><p>{task.project}<span>•</span>{task.due}</p></div><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span><span className="status">{task.status}</span><span className={`avatar ${task.tone}`}>{task.initials}</span></article>)}</div><button className="view-all" onClick={() => setFilter("All")}>View all tasks <span>→</span></button></div><div className="card progress-card"><div className="card-head"><h2>Weekly Progress</h2><div className="legend"><span><i className="done-dot" />Done</span><span><i className="total-dot" />Total</span></div></div><div className="chart">{[58, 75, 48, 91, 74, 40, 31].map((height, index) => <div className="bar-wrap" key={index}><div className="total-bar" style={{ height: `${Math.min(height + 15, 100)}%` }}><div className="done-bar" style={{ height: `${height}%` }} /></div><span>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span></div>)}</div><div className="progress-summary"><div><span>Tasks completed</span><strong>24 <em>/ 36</em></strong></div><b>67%</b></div></div></section></div></section>
    {modalOpen && <div className="modal-backdrop" onClick={() => setModalOpen(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setModalOpen(false)}>×</button><h2>Create New Task</h2><p>Add a task to the SoftITBD workspace.</p><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task title" /><select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Assign to me</option>{teamMembers.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email || "Unnamed employee"} · {member.role}</option>)}</select>{taskError && <div className="auth-error">{taskError}</div>}<button className="new-task" disabled={savingTask} onClick={createTask}>{savingTask ? "Saving..." : "Create Task"}</button></div></div>}
  </main>;
}
function Stat({ icon, color, value, label, note }: { icon: string; color: string; value: string; label: string; note: string }) { return <article className={`stat-card ${color}`}><div className="stat-icon">{icon}</div><span className="chevron">⌃</span><strong>{value}</strong><h2>{label}</h2><p>{note}</p></article>; }
