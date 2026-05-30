"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const UNIT = "com-todo-app-reminder";
const SERVICE_FILE = `${UNIT}.service`;
const TIMER_FILE = `${UNIT}.timer`;
const LAUNCHD_LABEL = "com.todo.app.reminder";
const LAUNCHD_PLIST = `${LAUNCHD_LABEL}.plist`;

function systemdUserDir() {
  return path.join(os.homedir(), ".config", "systemd", "user");
}

function systemdExecStartLine(execPath) {
  const p = String(execPath);
  if (/[\s"'`\\]/.test(p)) {
    const q = p.replace(/"/g, '\\"');
    return `ExecStart="${q}" --todo-reminder-tick`;
  }
  return `ExecStart=${p} --todo-reminder-tick`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function registerLinux(execPath) {
  const dir = systemdUserDir();
  fs.mkdirSync(dir, { recursive: true });
  const servicePath = path.join(dir, SERVICE_FILE);
  const timerPath = path.join(dir, TIMER_FILE);
  const svc = `[Unit]
Description=TODO background reminder (one-shot)

[Service]
Type=oneshot
${systemdExecStartLine(execPath)}
`;
  const timer = `[Unit]
Description=TODO background reminder timer

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=30s
Unit=${SERVICE_FILE}

[Install]
WantedBy=timers.target
`;
  fs.writeFileSync(servicePath, svc, "utf8");
  fs.writeFileSync(timerPath, timer, "utf8");
  execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "pipe" });
  execFileSync("systemctl", ["--user", "enable", "--now", TIMER_FILE], { stdio: "pipe" });
}

function unregisterLinux() {
  const dir = systemdUserDir();
  const servicePath = path.join(dir, SERVICE_FILE);
  const timerPath = path.join(dir, TIMER_FILE);
  try {
    execFileSync("systemctl", ["--user", "disable", "--now", TIMER_FILE], { stdio: "pipe" });
  } catch (_) {
    /* 可能未启用 */
  }
  try {
    fs.unlinkSync(timerPath);
  } catch (_) {}
  try {
    fs.unlinkSync(servicePath);
  } catch (_) {}
  try {
    execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "pipe" });
  } catch (_) {}
}

function statusLinux() {
  try {
    const o = execFileSync("systemctl", ["--user", "is-enabled", TIMER_FILE], {
      encoding: "utf8",
    });
    const line = o.trim();
    return {
      registered: line === "enabled" || line.startsWith("enabled"),
      kind: "systemd",
    };
  } catch (_) {
    return { registered: false, kind: "systemd" };
  }
}

function plistPathDarwin() {
  return path.join(os.homedir(), "Library", "LaunchAgents", LAUNCHD_PLIST);
}

function registerDarwin(execPath) {
  const plistPath = plistPathDarwin();
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  const ex = escapeXml(execPath);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${ex}</string>
    <string>--todo-reminder-tick</string>
  </array>
  <key>StartInterval</key>
  <integer>60</integer>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
`;
  fs.writeFileSync(plistPath, xml, "utf8");
  const uid = process.getuid();
  const domain = `gui/${uid}/${LAUNCHD_LABEL}`;
  try {
    execFileSync("launchctl", ["bootout", domain], { stdio: "pipe" });
  } catch (_) {}
  execFileSync("launchctl", ["bootstrap", `gui/${uid}`, plistPath], { stdio: "pipe" });
}

function unregisterDarwin() {
  const uid = process.getuid();
  const domain = `gui/${uid}/${LAUNCHD_LABEL}`;
  try {
    execFileSync("launchctl", ["bootout", domain], { stdio: "pipe" });
  } catch (_) {}
  try {
    fs.unlinkSync(plistPathDarwin());
  } catch (_) {}
}

function statusDarwin() {
  const uid = process.getuid();
  try {
    execFileSync("launchctl", ["print", `gui/${uid}/${LAUNCHD_LABEL}`], {
      stdio: "pipe",
    });
    return { registered: true, kind: "launchd" };
  } catch (_) {
    return { registered: false, kind: "launchd" };
  }
}

function register(execPath) {
  if (process.platform === "linux") {
    registerLinux(execPath);
    return { ok: true, kind: "systemd" };
  }
  if (process.platform === "darwin") {
    registerDarwin(execPath);
    return { ok: true, kind: "launchd" };
  }
  return { ok: false, error: "仅支持 Linux（systemd --user）与 macOS（LaunchAgent）" };
}

function unregister() {
  if (process.platform === "linux") {
    unregisterLinux();
    return { ok: true };
  }
  if (process.platform === "darwin") {
    unregisterDarwin();
    return { ok: true };
  }
  return { ok: true };
}

function status() {
  if (process.platform === "linux") return statusLinux();
  if (process.platform === "darwin") return statusDarwin();
  return { registered: false, kind: "none" };
}

module.exports = { register, unregister, status };
