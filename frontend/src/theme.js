import { createTheme } from "@mui/material/styles";
export const makeTheme = (mode) => {
  const d = mode === "dark", line = d ? "rgba(255,255,255,.07)" : "rgba(16,24,40,.07)";
  return createTheme({
    palette: { mode, primary: { main: "#6366f1" }, secondary: { main: "#14b8a6" }, success: { main: "#10b981" }, warning: { main: "#f59e0b" }, error: { main: "#ef4444" },
      background: d ? { default: "#0b1020", paper: "#121a2f" } : { default: "#f4f5fb", paper: "#ffffff" }, divider: line },
    shape: { borderRadius: 14 },
    typography: { fontFamily: "Inter, system-ui, sans-serif", h4: { fontWeight: 700 }, h5: { fontWeight: 700 }, h6: { fontWeight: 700 }, button: { textTransform: "none", fontWeight: 600 } },
    components: {
      MuiCard: { styleOverrides: { root: { backgroundImage: "none", border: `1px solid ${line}`, boxShadow: d ? "none" : "0 1px 2px rgba(16,24,40,.04),0 12px 32px rgba(16,24,40,.06)" } } },
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 10 } } },
      MuiTableCell: { styleOverrides: { root: { borderColor: line }, head: { fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".6px", color: d ? "#8f9bb8" : "#7b849b", whiteSpace: "nowrap" } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
      MuiDialog: { styleOverrides: { paper: { backgroundImage: "none", borderRadius: 18 } } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
    },
  });
};
