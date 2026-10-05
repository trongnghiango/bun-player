import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFile } from "node:child_process";

function mediaStreamPlugin() {
  return {
    name: "vite-media-stream",
    configureServer(server: any) {
      // API to extract embedded subtitles from video via ffmpeg
      server.middlewares.use("/api/extract-subtitles", (req: any, res: any) => {
        let body = "";
        req.on("data", (chunk: any) => (body += chunk));
        req.on("end", () => {
          try {
            const { videoPath } = JSON.parse(body || "{}");
            if (!videoPath) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing videoPath" }));
              return;
            }
            execFile("ffmpeg", ["-v", "error", "-i", videoPath, "-map", "0:s:0", "-f", "webvtt", "-"], (err, stdout) => {
              if (err || !stdout || !stdout.trim()) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "No embedded subtitles found" }));
                return;
              }
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ vtt: stdout }));
            });
          } catch (e: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      // API to export video with embedded subtitles into a single MP4 file
      server.middlewares.use("/api/export-mp4", (req: any, res: any) => {
        let body = "";
        req.on("data", (chunk: any) => (body += chunk));
        req.on("end", () => {
          try {
            const { videoPath, vttContent, outputPath } = JSON.parse(body || "{}");
            const tempVtt = path.join(os.tmpdir(), `bun_sub_${Date.now()}.vtt`);
            fs.writeFileSync(tempVtt, vttContent, "utf-8");

            execFile(
              "ffmpeg",
              [
                "-y",
                "-i", videoPath,
                "-i", tempVtt,
                "-c:v", "copy",
                "-c:a", "copy",
                "-c:s", "mov_text",
                outputPath,
              ],
              (err, _stdout, stderr) => {
                try { fs.unlinkSync(tempVtt); } catch {}
                if (err) {
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: stderr || err.message }));
                  return;
                }
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, path: outputPath }));
              }
            );
          } catch (e: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      // Media streaming with HTTP Range support
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
