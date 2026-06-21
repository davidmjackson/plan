// Minimal static host for sprintplan. v1 has no server-side logic: state lives
// client-side (local storage + JSON export). Express is used for suite parity
// and to give a future sync layer (ws) a home. Keep this thin.
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT || 3004;

app.use(express.static(join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`sprintplan listening on http://localhost:${PORT}`);
});
