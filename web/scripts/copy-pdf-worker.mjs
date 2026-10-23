// Copia el worker de PDF.js a public/ para servirlo como archivo estático.
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
await mkdir(path.join(root, "public"), { recursive: true });
await copyFile(
  path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
  path.join(root, "public/pdf.worker.min.mjs"),
);
