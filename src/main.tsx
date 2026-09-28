import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SubmitterApp from "./SubmitterApp";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/^\/submit(?:\/|$)/.test(window.location.pathname) ? <SubmitterApp /> : <App />}
  </React.StrictMode>,
);
