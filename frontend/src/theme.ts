import { createTheme, responsiveFontSizes } from "@mui/material/styles";

// One theme object, used everywhere via <ThemeProvider> in main.tsx — this is the single
// place that defines "what this app looks like." Changing the brand color, corner radius, or
// font later means editing this file, not hunting through every page's inline styles (which
// is exactly the problem the old plain-inline-style version of this app had).
//
// Color choice: a clinical teal as the primary color (calm, trustworthy — fits a
// doctor/salon/dentist booking tool) with a warm amber secondary for things that deserve
// extra attention (the "confirm booking" CTA, late/warning states).
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f6e56",
      light: "#3d8f79",
      dark: "#0a4d3c",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#b26a00",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f4f6f5",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600, fontSize: "1.75rem" },
    h5: { fontWeight: 600, fontSize: "1.35rem" },
    h6: { fontWeight: 600, fontSize: "1.1rem" },
    button: { textTransform: "none", fontWeight: 500 },
  },
  components: {
    // MUI's default elevated-paper shadow is heavier than Material 3's flatter cards —
    // a subtle border + light shadow reads cleaner across both light backgrounds and dense
    // tables than the default drop shadow does.
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid rgba(0,0,0,0.08)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderBottom: "1px solid rgba(0,0,0,0.08)",
        },
      },
    },
  },
});

// Scales h1-h6/body font sizes down slightly on narrow viewports instead of one fixed size
// for every breakpoint — part of the "responsive" requirement, handled once here instead of
// per-page media queries.
export default responsiveFontSizes(theme);
