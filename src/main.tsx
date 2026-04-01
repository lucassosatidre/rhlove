import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log('[RHLove] main.tsx mounting...');
const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error('[RHLove] #root element not found!');
} else {
  createRoot(rootEl).render(<App />);
  console.log('[RHLove] App rendered');
}
