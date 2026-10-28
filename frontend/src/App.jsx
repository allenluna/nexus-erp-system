import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, Link, useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ThemeProvider, useTheme, alpha } from "@mui/material/styles"; import CssBaseline from "@mui/material/CssBaseline";
import { AppBar, Toolbar, Typography, Button, Box, Card, Drawer, List, ListItemButton, ListItemIcon, ListItemText, IconButton, InputBase, Avatar, Menu, MenuItem, Breadcrumbs, Chip, Table, TableHead, TableRow, TableCell, TableBody, Pagination, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Skeleton, useMediaQuery, Divider } from "@mui/material";
import * as I from "@mui/icons-material";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RTip, CartesianGrid, ResponsiveContainer } from "recharts";
import { useSnackbar } from "notistack"; import api, { errMsg } from "./api.js"; import { makeTheme } from "./theme.js";

const NAV = { Dashboard: ["", I.SpaceDashboard], employees: ["Employees", I.PeopleAlt], departments: ["Departments", I.Apartment], attendance: ["Attendance", I.EventAvailable], leaveRequests: ["Leave", I.BeachAccess],
  customers: ["Customers", I.Groups], leads: ["Leads", I.Flag], suppliers: ["Suppliers", I.LocalShipping], categories: ["Categories", I.Category], products: ["Products", I.Inventory2],
  salesOrders: ["Sales Orders", I.ShoppingCart], purchaseOrders: ["Purchase Orders", I.ShoppingBag], invoices: ["Invoices", I.ReceiptLong], expenses: ["Expenses", I.Paid] };
const ROLE_NAV = { Admin: null, HR: ["employees", "departments", "attendance", "leaveRequests"], Finance: ["invoices", "expenses", "customers", "suppliers"], Sales: ["customers", "leads", "salesOrders", "products", "invoices"], Inventory: ["products", "categories", "purchaseOrders", "suppliers"] };
const STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const F = { employees: [["name"], ["email"], ["departmentId", "departments"], ["position"], ["salary", "number"], ["hireDate", "date"]], departments: [["name"]],
  attendance: [["employeeId", "employees"], ["date", "date"], ["status"]], leaveRequests: [["employeeId", "employees"], ["startDate", "date"], ["endDate", "date"]],
  customers: [["name"], ["email"], ["phone"]], leads: [["name"], ["stage", "select", STAGES], ["followUp", "date"]], suppliers: [["name"]], categories: [["name"]],
  products: [["sku"], ["name"], ["categoryId", "categories"], ["price", "number"], ["cost", "number"], ["reorderLevel", "number"]],
  salesOrders: [["customerId", "customers"], ["productId", "products"], ["qty", "number"], ["discount", "number"]], purchaseOrders: [["supplierId", "suppliers"], ["productId", "products"], ["qty", "number"]],
  expenses: [["description"], ["amount", "number"], ["date", "date"]] };
const LOOK = { customerId: "customers", supplierId: "suppliers", departmentId: "departments", employeeId: "employees", categoryId: "categories", assignedTo: "employees" };
const ACT = { salesOrders: [["confirm", "Confirm", I.CheckCircleOutline], ["cancel", "Cancel", I.CancelOutlined]], purchaseOrders: [["approve", "Approve", I.ThumbUpOffAlt], ["receive", "Receive all", I.MoveToInbox], ["cancel", "Cancel", I.CancelOutlined]],
  leaveRequests: [["approve", "Approve", I.CheckCircleOutline], ["reject", "Reject", I.CancelOutlined]], invoices: [["pay", "Record payment", I.Payments]], products: [["stock", "Adjust stock", I.Tune]] };
const OKSTATE = { confirm: ["draft"], cancel: ["draft", "confirmed", "approved"], approve: ["draft", "pending"], reject: ["pending"], receive: ["approved", "partial"], pay: ["unpaid", "partial"] };
const tone = (s) => (["paid", "approved", "confirmed", "received", "present", "won"].includes(s) ? "success" : ["cancelled", "rejected", "lost"].includes(s) ? "error" : ["pending", "draft", "unpaid", "partial", "new", "contacted", "qualified", "proposal"].includes(s) ? "warning" : "default");
const money = (n) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n || 0);
const label = (k) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/ Id$/, "");

function Login({ onDone }) {
  const [f, setF] = useState({ email: "admin@nexus.test", password: "Demo#1234" }); const [busy, setBusy] = useState(false); const nav = useNavigate(); const { enqueueSnackbar } = useSnackbar();
  const go = async () => { setBusy(true); try { const { data } = await api.post("/auth/login", f); localStorage.setItem("token", data.data.token); localStorage.setItem("user", JSON.stringify(data.data.user)); onDone(); nav("/"); } catch (e) { enqueueSnackbar(errMsg(e), { variant: "error" }); } setBusy(false); };
  return <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { md: "1.1fr 1fr" } }}>
    <Box sx={{ display: { xs: "none", md: "flex" }, flexDirection: "column", justifyContent: "center", p: 8, color: "#fff", background: "radial-gradient(circle at 20% 20%,#818cf8,#4f46e5 45%,#1e1b4b)" }}>
      <I.Hub sx={{ fontSize: 48, mb: 2 }} /><Typography variant="h3" fontWeight={800}>NexusERP</Typography><Typography sx={{ mt: 2, opacity: .85, maxWidth: 420 }}>HR, CRM, inventory, sales, procurement and finance in one workspace.</Typography></Box>
    <Box sx={{ display: "grid", placeItems: "center", p: 3 }}><Box sx={{ width: "100%", maxWidth: 380, display: "grid", gap: 2 }}>
      <Typography variant="h5">Welcome back</Typography><Typography color="text.secondary" sx={{ mt: -1 }}>Sign in to continue</Typography>
      <TextField label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <TextField label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && go()} />
      <Button size="large" variant="contained" disabled={busy} onClick={go}>Sign in</Button>
      <Typography variant="caption" color="text.secondary">Demo: admin@, hr@, finance@, sales@, inventory@nexus.test</Typography></Box></Box></Box>;
}

function Stat({ title, value, icon: Icon, color = "primary", sub }) {
  const t = useTheme(); const c = t.palette[color].main;
  return <Card sx={{ p: 2.5, display: "flex", gap: 2, alignItems: "center", transition: ".2s", "&:hover": { transform: "translateY(-3px)" } }}>
    <Box sx={{ width: 48, height: 48, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: alpha(c, .14), color: c }}><Icon /></Box>
    <Box><Typography variant="body2" color="text.secondary">{title}</Typography><Typography variant="h5">{value}</Typography>{sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}</Box></Card>;
}
function Dashboard() {
  const [s, setS] = useState(null); const t = useTheme();
  useEffect(() => { api.get("/dashboard/summary").then((r) => setS(r.data.data)).catch(() => setS(false)); }, []);
  if (s === false) return <Typography color="text.secondary">Could not load the dashboard.</Typography>;
  if (!s) return <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 2 }}>{[...Array(8)].map((_, i) => <Skeleton key={i} variant="rounded" height={90} />)}</Box>;
  const cards = [["Invoiced", money(s.invoiced), I.RequestQuote, "primary"], ["Collected", money(s.collected), I.AccountBalanceWallet, "success"], ["Expenses", money(s.expenses), I.TrendingDown, "error"], ["Net (cash)", money(s.netProfit), I.TrendingUp, "secondary"],
    ["Receivables", money(s.receivables), I.Schedule, "warning", `${s.overdueInvoices} overdue`], ["Employees", s.employees, I.PeopleAlt, "primary"], ["Customers", s.customers, I.Groups, "secondary"], ["Low stock", s.lowStockCount, I.WarningAmber, "error", `${s.pendingApprovals} pending approvals`]];
  return <Box sx={{ display: "grid", gap: 2.5 }}>
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 2 }}>{cards.map(([a, b, c, d, e]) => <Stat key={a} title={a} value={b} icon={c} color={d} sub={e} />)}</Box>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2.5 }}>
      <Card sx={{ p: 3 }}><Typography variant="h6">Revenue vs expenses</Typography><Typography variant="body2" color="text.secondary" mb={2}>Collected payments and recorded expenses by month</Typography>
        <Box sx={{ height: 280 }}><ResponsiveContainer><AreaChart data={s.monthly}><defs>{[["r", t.palette.primary.main], ["e", t.palette.error.main]].map(([id, c]) => <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c} stopOpacity={.35} /><stop offset="95%" stopColor={c} stopOpacity={0} /></linearGradient>)}</defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.palette.divider} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={60} /><RTip formatter={(v) => money(v)} contentStyle={{ borderRadius: 12, border: "none" }} />
          <Area type="monotone" dataKey="revenue" stroke={t.palette.primary.main} fill="url(#r)" strokeWidth={2.5} /><Area type="monotone" dataKey="expenses" stroke={t.palette.error.main} fill="url(#e)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></Box></Card>
      <Card sx={{ p: 3 }}><Typography variant="h6" mb={1}>Low-stock alerts</Typography>{s.lowStock.length === 0 && <Typography color="text.secondary">All stocked up 🎉</Typography>}
        {s.lowStock.slice(0, 6).map((p) => <Box key={p.id} sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: `1px solid ${t.palette.divider}` }}><Typography>{p.name}</Typography><Chip size="small" color="error" label={`${p.stock} left`} /></Box>)}</Card></Box>
    <Card sx={{ p: 3 }}><Typography variant="h6" mb={1}>Recent activity</Typography>{s.recentActivity.map((a) => <Box key={a.id} sx={{ display: "flex", gap: 1.5, py: 1, alignItems: "center" }}><I.FiberManualRecord sx={{ fontSize: 10 }} color="primary" /><Typography variant="body2" sx={{ flex: 1 }}>{a.action}</Typography><Typography variant="caption" color="text.secondary">{a.user} · {a.at.slice(0, 16).replace("T", " ")}</Typography></Box>)}</Card></Box>;
}

function FormDialog({ open, title, fields, initial = {}, onClose, onSubmit }) {
  const [v, setV] = useState(initial); const [opts, setOpts] = useState({}); const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  useEffect(() => { setV(initial); setErrs({}); }, [open]);
  useEffect(() => { if (!open) return; fields.forEach(([k, t]) => { if (t && !["number", "date", "select"].includes(t)) api.get(`/${t}`, { params: { limit: 100 } }).then((r) => setOpts((o) => ({ ...o, [k]: r.data.data }))).catch(() => {}); }); }, [open]);
  const submit = async () => { setBusy(true); try { await onSubmit(v); onClose(); } catch (e) { setErrs(e.response?.data?.errors || {}); if (!e.response?.data?.errors) onClose(errMsg(e)); } setBusy(false); };
  return <Dialog open={open} onClose={() => onClose()} fullWidth maxWidth="sm"><DialogTitle>{title}</DialogTitle>
    <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>{fields.map(([k, t, o]) => {
      const common = { key: k, label: label(k), value: v[k] ?? "", error: !!errs[k], helperText: errs[k] && String(errs[k]), onChange: (e) => setV({ ...v, [k]: e.target.value }), fullWidth: true };
      if (t === "select" || (t && !["number", "date"].includes(t))) { const list = t === "select" ? o.map((x) => ({ id: x, name: x })) : opts[k] || []; return <TextField select SelectProps={{ native: true }} {...common} InputLabelProps={{ shrink: true }}><option value="" />{list.map((x) => <option key={x.id} value={x.id}>{x.name || x.sku || x.number}</option>)}</TextField>; }
      return <TextField {...common} type={t || "text"} InputLabelProps={t === "date" ? { shrink: true } : undefined} />; })}
      {errs.items && <Typography color="error" variant="body2">{String(errs.items)}</Typography>}</DialogContent>
    <DialogActions sx={{ p: 2.5 }}><Button onClick={() => onClose()}>Cancel</Button><Button variant="contained" disabled={busy} onClick={submit}>Save</Button></DialogActions></Dialog>;
}

function Collection() {
  const { col } = useParams(); const { enqueueSnackbar } = useSnackbar(); const [sp, setSp] = useSearchParams(); const q = sp.get("q") || "";
  const [rows, setRows] = useState(null); const [pg, setPg] = useState({ totalPages: 1, total: 0 }); const [page, setPage] = useState(1); const [tick, setTick] = useState(0); const [map, setMap] = useState({});
  const [dlg, setDlg] = useState(null); const [del, setDel] = useState(null); const [sort, setSort] = useState("-createdAt");
  useEffect(() => setPage(1), [col, q]);
  useEffect(() => { setRows(null); api.get(`/${col}`, { params: { q, page, sort } }).then((r) => { setRows(r.data.data); setPg(r.data.pagination); }).catch((e) => { setRows([]); enqueueSnackbar(errMsg(e), { variant: "error" }); }); }, [col, q, page, tick, sort]);
  useEffect(() => { Object.entries(LOOK).forEach(([k, c]) => { if (map[c]) return; api.get(`/${c}`, { params: { limit: 100 } }).then((r) => setMap((m) => ({ ...m, [c]: Object.fromEntries(r.data.data.map((x) => [x.id, x.name])) }))).catch(() => {}); }); }, []);
  const run = async (fn, ok = "Done") => { try { await fn(); enqueueSnackbar(ok, { variant: "success" }); setTick((x) => x + 1); } catch (e) { enqueueSnackbar(errMsg(e), { variant: "error" }); } };
  const keys = rows?.[0] ? Object.keys(rows[0]).filter((k) => !["id", "createdAt", "items", "salesOrderId", "subtotal", "tax", "passwordHash"].includes(k) && typeof rows[0][k] !== "object").slice(0, 7) : [];
  const cell = (r, k) => { const v = r[k]; if (k === "status" || k === "stage") return <Chip size="small" color={tone(v)} variant="outlined" label={v} />; if (LOOK[k] && map[LOOK[k]]?.[v]) return map[LOOK[k]][v]; if (["total", "paid", "balance", "price", "cost", "amount", "salary"].includes(k)) return money(v); return String(v ?? "—"); };
  const stockFields = [["type", "select", ["in", "out", "adjust"]], ["qty", "number"], ["note"]];
  const act = (a, r) => { if (a === "pay") return setDlg({ title: "Record payment", fields: [["amount", "number"]], initial: { amount: r.balance }, onSubmit: (v) => api.post(`/invoices/${r.id}/pay`, { amount: Number(v.amount) }).then(() => setTick((x) => x + 1)) });
    if (a === "stock") return setDlg({ title: `Adjust stock — ${r.name}`, fields: stockFields, initial: { type: "in" }, onSubmit: (v) => api.post(`/products/${r.id}/stock`, { ...v, qty: Number(v.qty) }).then(() => setTick((x) => x + 1)) });
    const body = a === "receive" ? { items: r.items.filter((l) => l.qty > l.received).map((l) => ({ productId: l.productId, qty: l.qty - l.received })) } : {}; run(() => api.post(`/${col}/${r.id}/${a}`, body), "Updated"); };
  const build = (v) => (col === "salesOrders" || col === "purchaseOrders") ? { [col === "salesOrders" ? "customerId" : "supplierId"]: v[col === "salesOrders" ? "customerId" : "supplierId"], items: [{ productId: v.productId, qty: Number(v.qty), discount: Number(v.discount || 0) }] } : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, F[col].find((f) => f[0] === k)?.[1] === "number" && x !== "" ? Number(x) : x]));
  const fields = F[col] || [];
  return <Card><Box sx={{ p: 2.5, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
    <Box sx={{ flex: 1 }}><Typography variant="h6">{NAV[col]?.[0] || col}</Typography><Typography variant="body2" color="text.secondary">{pg.total} records</Typography></Box>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, borderRadius: 2.5, bgcolor: (t) => alpha(t.palette.text.primary, .05) }}><I.Search fontSize="small" /><InputBase placeholder="Search…" value={q} onChange={(e) => setSp(e.target.value ? { q: e.target.value } : {})} /></Box>
    {fields.length > 0 && <Button variant="contained" startIcon={<I.Add />} onClick={() => setDlg({ title: `New ${NAV[col]?.[0]}`, fields, initial: {}, onSubmit: (v) => api.post(`/${col}`, build(v)).then(() => setTick((x) => x + 1)) })}>New</Button>}</Box>
    <Divider /><Box sx={{ overflowX: "auto" }}><Table size="medium"><TableHead><TableRow>{keys.map((k) => <TableCell key={k} onClick={() => setSort(sort === k ? "-" + k : k)} sx={{ cursor: "pointer" }}>{label(k)}</TableCell>)}<TableCell align="right">Actions</TableCell></TableRow></TableHead>
      <TableBody>{rows === null && [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={keys.length + 1 || 3}><Skeleton /></TableCell></TableRow>)}
        {rows?.length === 0 && <TableRow><TableCell colSpan={9} align="center" sx={{ py: 8 }}><I.Inbox sx={{ fontSize: 40, opacity: .4 }} /><Typography color="text.secondary">Nothing here yet</Typography></TableCell></TableRow>}
        {rows?.map((r) => <TableRow key={r.id} hover>{keys.map((k, i) => <TableCell key={k} sx={i === 0 ? { fontWeight: 600 } : undefined}>{cell(r, k)}</TableCell>)}
          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>{(ACT[col] || []).filter(([a]) => !OKSTATE[a] || OKSTATE[a].includes(r.status)).map(([a, n, Ic]) => <Tooltip key={a} title={n}><IconButton size="small" onClick={() => act(a, r)}><Ic fontSize="small" /></IconButton></Tooltip>)}
            {fields.length > 0 && !["salesOrders", "purchaseOrders"].includes(col) && <Tooltip title="Edit"><IconButton size="small" onClick={() => setDlg({ title: "Edit", fields, initial: r, onSubmit: (v) => api.patch(`/${col}/${r.id}`, build(v)).then(() => setTick((x) => x + 1)) })}><I.EditOutlined fontSize="small" /></IconButton></Tooltip>}
            {!["invoices"].includes(col) && <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDel(r)}><I.DeleteOutline fontSize="small" /></IconButton></Tooltip>}</TableCell></TableRow>)}</TableBody></Table></Box>
    <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end" }}><Pagination page={page} count={pg.totalPages || 1} onChange={(_, p) => setPage(p)} color="primary" shape="rounded" /></Box>
    {dlg && <FormDialog open {...dlg} onClose={(m) => { setDlg(null); if (m) enqueueSnackbar(m, { variant: "error" }); else enqueueSnackbar("Saved", { variant: "success" }); }} />}
    <Dialog open={!!del} onClose={() => setDel(null)}><DialogTitle>Delete this record?</DialogTitle><DialogContent><Typography color="text.secondary">This can't be undone.</Typography></DialogContent>
      <DialogActions sx={{ p: 2 }}><Button onClick={() => setDel(null)}>Cancel</Button><Button color="error" variant="contained" onClick={() => { const r = del; setDel(null); run(() => api.delete(`/${col}/${r.id}`), "Deleted"); }}>Delete</Button></DialogActions></Dialog></Card>;
}

function Shell({ mode, toggle }) {
  const user = JSON.parse(localStorage.getItem("user") || "null"); const loc = useLocation(); const nav = useNavigate(); const mobile = useMediaQuery((t) => t.breakpoints.down("md"));
  const [open, setOpen] = useState(true); const [mob, setMob] = useState(false); const [anchor, setAnchor] = useState(null); const [nq, setNq] = useState("");
  if (!user) return <Navigate to="/login" />;
  const items = (ROLE_NAV[user.role] || Object.keys(NAV).filter((k) => k !== "Dashboard")); const W = open ? 264 : 80; const cur = loc.pathname.split("/")[1];
  const drawer = <Box sx={{ height: "100%", display: "flex", flexDirection: "column", background: (t) => t.palette.mode === "dark" ? "#0e1527" : "#fff" }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2.5, height: 72 }}><Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: "grid", placeItems: "center", color: "#fff", background: "linear-gradient(135deg,#818cf8,#4f46e5)" }}><I.Hub /></Box>{(open || mobile) && <Typography variant="h6">NexusERP</Typography>}</Box>
    <List sx={{ px: 1.5, flex: 1, overflowY: "auto" }}>{["Dashboard", ...items].map((k) => { const [n, Ic] = NAV[k]; const sel = k === "Dashboard" ? !cur : cur === k;
      return <Tooltip key={k} placement="right" title={open || mobile ? "" : n || k}><ListItemButton selected={sel} onClick={() => { nav(k === "Dashboard" ? "/" : `/${k}`); setMob(false); }} sx={{ borderRadius: 2.5, mb: .5, px: 2, "&.Mui-selected": { bgcolor: (t) => alpha(t.palette.primary.main, .14), color: "primary.main" } }}>
        <ListItemIcon sx={{ minWidth: 38, color: "inherit" }}><Ic /></ListItemIcon>{(open || mobile) && <ListItemText primary={n || "Dashboard"} primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} />}</ListItemButton></Tooltip>; })}</List></Box>;
  return <Box sx={{ display: "flex", minHeight: "100vh" }}>
    {mobile ? <Drawer open={mob} onClose={() => setMob(false)} PaperProps={{ sx: { width: 264 } }}>{drawer}</Drawer> : <Drawer variant="permanent" sx={{ width: W, transition: ".2s", "& .MuiDrawer-paper": { width: W, transition: ".2s", overflowX: "hidden", borderRight: (t) => `1px solid ${t.palette.divider}` } }}>{drawer}</Drawer>}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ backdropFilter: "blur(14px)", bgcolor: (t) => alpha(t.palette.background.default, .75), borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
        <Toolbar sx={{ gap: 1.5 }}><IconButton onClick={() => (mobile ? setMob(true) : setOpen(!open))}>{open && !mobile ? <I.MenuOpen /> : <I.Menu />}</IconButton>
          <Breadcrumbs sx={{ flex: 1, display: { xs: "none", sm: "block" } }}><Link to="/" style={{ color: "inherit", textDecoration: "none" }}>Home</Link><Typography color="text.primary" fontWeight={600}>{cur ? NAV[cur]?.[0] || cur : "Dashboard"}</Typography></Breadcrumbs>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: .3, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, .06) }}><I.Search fontSize="small" /><InputBase placeholder="Search…" value={nq} onChange={(e) => setNq(e.target.value)} onKeyDown={(e) => e.key === "Enter" && nav(`/${cur || items[0]}?q=${encodeURIComponent(nq)}`)} sx={{ width: { xs: 90, sm: 180 } }} /></Box>
          <IconButton onClick={toggle}>{mode === "dark" ? <I.LightMode /> : <I.DarkMode />}</IconButton>
          <IconButton onClick={(e) => setAnchor(e.currentTarget)}><Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 14 }}>{user.email[0].toUpperCase()}</Avatar></IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}><Box sx={{ px: 2, py: 1 }}><Typography fontWeight={600}>{user.email}</Typography><Chip size="small" label={user.role} color="primary" sx={{ mt: .5 }} /></Box><Divider />
            <MenuItem onClick={() => { localStorage.clear(); location.href = "/login"; }}><ListItemIcon><I.Logout fontSize="small" /></ListItemIcon>Logout</MenuItem></Menu></Toolbar></AppBar>
      <Box sx={{ p: { xs: 2, md: 4 } }}><Routes><Route index element={<Dashboard />} /><Route path=":col" element={<Collection />} /></Routes></Box></Box></Box>;
}
export default function App() {
  const [mode, setMode] = useState(localStorage.getItem("mode") || "light"); const [, force] = useState(0); const theme = useMemo(() => makeTheme(mode), [mode]);
  const toggle = () => { const m = mode === "dark" ? "light" : "dark"; localStorage.setItem("mode", m); setMode(m); };
  return <ThemeProvider theme={theme}><CssBaseline /><Routes><Route path="/login" element={<Login onDone={() => force((x) => x + 1)} />} /><Route path="/*" element={<Shell mode={mode} toggle={toggle} />} /></Routes></ThemeProvider>;
}
