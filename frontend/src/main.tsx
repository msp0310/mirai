import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";

import { router } from "./app/routing/router";
import { AppErrorBoundary } from "./components/feedback/AppErrorBoundary";

import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/noto-sans-jp/index.css";
import "./styles.css";

document.title = "COMPASS";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  </React.StrictMode>,
);
