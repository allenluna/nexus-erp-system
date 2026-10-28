import axios from "axios";
const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((c) => { const t = localStorage.getItem("token"); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (e) => { if (e.response?.status === 401 && !e.config.url.includes("login")) { localStorage.clear(); location.href = "/login"; } return Promise.reject(e); });
export const errMsg = (e) => e.response?.data?.message || e.message;
export default api;
