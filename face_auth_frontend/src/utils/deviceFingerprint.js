const STORAGE_KEY = "secure-hub-device-id";
const NAME_KEY = "secure-hub-device-name";

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `dev-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function _buildDeviceName() {
  const ua = navigator.userAgent;
  let browser = "Browser";
  let os = "Unknown OS";

  // Brave UA often includes Chrome, so detect Brave first.
  if (typeof navigator !== "undefined" && navigator.brave) browser = "Brave";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/")) browser = "Opera";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";

  if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} on ${os}`;
}

/**
 * Returns { deviceId, deviceName }
 * Uses per-browser-profile storage.
 * Incognito/private sessions usually get isolated storage => separate device id.
 */
export function getDeviceInfo() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedName = localStorage.getItem(NAME_KEY);

    if (stored && storedName) {
      return { deviceId: stored, deviceName: storedName };
    }

    const deviceId = randomId();
    const deviceName = _buildDeviceName();
    localStorage.setItem(STORAGE_KEY, deviceId);
    localStorage.setItem(NAME_KEY, deviceName);
    return { deviceId, deviceName };
  } catch {
    // Storage may be restricted in hardened/private mode.
    return {
      deviceId: randomId(),
      deviceName: _buildDeviceName(),
    };
  }
}
