import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Yazı tipleri (Türkçe karakterler latin-ext alt kümesinde; tarayıcı yalnızca gerekeni indirir)
import "@fontsource/pixelify-sans/500.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource-variable/nunito/wght.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
