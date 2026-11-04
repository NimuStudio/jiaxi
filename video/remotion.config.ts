import { Config } from "@remotion/cli/config";

// 这台机器访问不到 storage.googleapis.com，Remotion 无法自动下载
// Chrome Headless Shell；改用系统已装的 Edge（同为 Chromium 内核）。
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER ??
    "C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe",
);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
