/**
 * Markdown → HTML（供浏览器打印成 PDF）
 * 用法：node scripts/md-to-html.ts <input.md> <output.html>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "marked";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("用法：node scripts/md-to-html.ts <input.md> <output.html>");
  process.exit(1);
}

const md = readFileSync(input, "utf8");
const body = marked.parse(md, { async: false }) as string;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>家系 · 技术文档</title>
<style>
  @page { size: A4; margin: 17mm 16mm 16mm; }
  body {
    font-family: "PingFang SC", "Microsoft YaHei", system-ui, serif;
    font-size: 10.5pt; line-height: 1.78; color: #1a1d1b;
    margin: 0; max-width: none;
  }
  h1 { font-size: 19pt; margin: 0 0 12pt; color: #0f5f4c; page-break-after: avoid; }
  h2 {
    font-size: 13.5pt; margin: 18pt 0 7pt; color: #0f5f4c;
    border-bottom: 1px solid #d8ded9; padding-bottom: 3pt;
    page-break-after: avoid; page-break-before: auto;
  }
  h3 { font-size: 11.5pt; margin: 13pt 0 5pt; color: #14181a; page-break-after: avoid; }
  p { margin: 0 0 7pt; text-align: justify; }
  table {
    width: 100%; border-collapse: collapse; margin: 7pt 0 11pt;
    font-size: 9.5pt; page-break-inside: avoid;
  }
  th, td { border: 1px solid #d8ded9; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f1f4f2; font-weight: 600; }
  code {
    font-family: Menlo, Consolas, monospace; font-size: 9pt;
    background: #f3f5f3; padding: 1pt 3pt; border-radius: 2pt;
  }
  pre {
    background: #f6f8f6; padding: 7pt 9pt; border-radius: 4pt;
    overflow-x: auto; page-break-inside: avoid; font-size: 8.8pt; line-height: 1.55;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    margin: 7pt 0; padding: 6pt 10pt;
    border-left: 3pt solid #c2610f; background: #fbf6f0; color: #5b4a2e;
    page-break-inside: avoid;
  }
  blockquote p { margin: 0; }
  ul, ol { margin: 0 0 7pt; padding-left: 17pt; }
  li { margin-bottom: 2.5pt; }
  hr { border: none; border-top: 1px solid #e2e6e2; margin: 14pt 0; }
  strong { font-weight: 600; }
</style>
</head>
<body>${body}</body>
</html>`;

writeFileSync(output, html, "utf8");
console.log("已生成:", output);
