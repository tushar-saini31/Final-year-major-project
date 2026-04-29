import axios from "axios";

const BASE = "http://127.0.0.1:8000";
let cachedPublicIp = null;

async function getPublicIp() {
  if (cachedPublicIp) return cachedPublicIp;
  try {
    const res = await fetch("https://api64.ipify.org?format=json");
    if (!res.ok) return null;
    const data = await res.json();
    cachedPublicIp = data?.ip || null;
    return cachedPublicIp;
  } catch {
    return null;
  }
}

export async function registerStart(profile) {
  try {
    const ip = await getPublicIp();
    const res = await axios.post(`${BASE}/auth/register/start`, {
      username:    profile.username.trim(),
      full_name:   profile.fullName,
      email:       profile.email,
      phone:       profile.phone || null,
      designation: profile.designation || null,
      password:    profile.password,
      device_id:   profile.device_id || null,
      device_name: profile.device_name || null,
    }, {
      headers: ip ? { "X-Client-IP": ip } : {},
    });
    return res.data;
  } catch (err) {
    console.error("registerStart error:", err.response?.status, err.response?.data);
    throw err;
  }
}

// Now sends username + email + password — backend verifies all three
export async function loginStart({ username, email, password, device_id, device_name }) {
  try {
    const ip = await getPublicIp();
    const res = await axios.post(`${BASE}/auth/login/start`, {
      username: username.trim(),
      email:    email.trim().toLowerCase(),
      password,
      device_id: device_id || null,
      device_name: device_name || null,
    }, {
      headers: ip ? { "X-Client-IP": ip } : {},
    });
    return res.data;
  } catch (err) {
    console.error("loginStart error:", err.response?.status, err.response?.data);
    throw err;
  }
}

export async function verifyOtp({ username, otp_code }) {
  try {
    const ip = await getPublicIp();
    const res = await axios.post(`${BASE}/auth/otp/verify`, { username, otp_code }, {
      headers: ip ? { "X-Client-IP": ip } : {},
    });
    return res.data;
  } catch (err) {
    console.error("verifyOtp error:", err.response?.status, err.response?.data);
    throw err;
  }
}

export async function adminLogin({ password }) {
  try {
    const res = await axios.post(`${BASE}/auth/admin/login`, { password });
    return res.data;
  } catch (err) {
    console.error("adminLogin error:", err.response?.status, err.response?.data);
    throw err;
  }
}
