import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { CustomerAuthProvider } from "./auth/CustomerAuthContext";
import theme from "./theme";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* CssBaseline resets browser defaults (margins, font smoothing, box-sizing) the same
        way index.css used to do by hand, plus applies theme.palette.background.default as
        the page background — one less thing for index.css to own. */}
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        {/* Two independent providers, not one combined "auth" provider — staff and customer
            sessions are separate identity systems that happen to coexist in the same app (see
            auth/CustomerAuthContext.tsx). Nesting order doesn't matter, since neither reads
            from the other. */}
        <AuthProvider>
          <CustomerAuthProvider>
            <App />
          </CustomerAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
