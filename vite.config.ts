import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

function mediaStreamPlugin() {
  return {
    name: "vite-media-stream",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (!req.url?.startsWith("/media-stream")) return next();
        try {
          const url = new URL(req.url, "http://localhost:1420");
          let filePath = url.searchParams.get("path");
          if (!filePath) {
            res.statusCode = 400;
            res.end("Missing file path");
            return;
          }

          // Unwrap asset:// if passed
          if (filePath.startsWith("asset://localhost/")) {
            filePath = decodeURIComponent(filePath.replace("asset://localhost/", ""));
          }

          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end("Media File Not Found");
            return;
          }

          const stat = fs.statSync(filePath);
          const totalSize = stat.size;
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mkv": "video/webm",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/mp4",
          };
          const contentType = mimeTypes[ext] || "video/mp4";

          const range = req.headers.range;
          if (!range) {
            res.writeHead(200, {
              "Content-Length": totalSize,
              "Content-Type": contentType,
              "Accept-Ranges": "bytes",
              "Access-Control-Allow-Origin": "*",
            });
            fs.createReadStream(filePath).pipe(res);
            return;
          }

          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
          const chunkSize = end - start + 1;

          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
          });

          fs.createReadStream(filePath, { start, end }).pipe(res);
        } catch (err: any) {
          res.statusCode = 500;
          res.end(err.message);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mediaStreamPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
  },
  clearScreen: false,
});
