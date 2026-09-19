import React from "react";
import { createRoot } from "react-dom/client";
import { TileExtension } from "./TileExtension";

export { TileExtension } from "./TileExtension";

const mount = () => {
  const root = document.body.appendChild(document.createElement("div"));
  document.body.style.margin = "0";
  document.body.style.height = root.style.height = "100%";
  createRoot(root).render(<TileExtension />);
};

const isTestEnv =
  typeof process !== "undefined" && Boolean(process.env?.JEST_WORKER_ID);

if (typeof window !== "undefined" && !isTestEnv) {
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
}
