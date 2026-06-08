// Storage keys (all under storage.local).
export const STORAGE_KEYS = {
  settings: "settings",
  logs: "logs",
  status: "status",
  runtime: "runtime",
};

// Heartbeat bounds. 30 s is the shared floor: Chromium clamps < 0.5 min to
// 30 s; Firefox honors the value, so 30 s is safe on both.
export const MIN_HEARTBEAT_SECONDS = 30;
export const DEFAULT_HEARTBEAT_SECONDS = 60;

// Ring-buffer cap for execution logs.
export const MAX_LOGS = 200;

// Name of the recurring heartbeat alarm.
export const HEARTBEAT_ALARM_NAME = "heartbeat";
