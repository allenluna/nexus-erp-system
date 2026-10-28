import React from "react"; import { createRoot } from "react-dom/client"; import { BrowserRouter } from "react-router-dom";
import { SnackbarProvider } from "notistack"; import App from "./App.jsx";
createRoot(document.getElementById("root")).render(<BrowserRouter><SnackbarProvider anchorOrigin={{ vertical: "bottom", horizontal: "right" }}><App /></SnackbarProvider></BrowserRouter>);
