import axios from "axios";

const BASE = "http://127.0.0.1:8000";

export async function registerStart(profile) {
  try {
    const res = await axios.post(`${BASE}/auth/register/start`, {
      username:    profile.username.trim(),
      full_name:   profile.fullName,
      email:       profile.email,
      phone:       profile.phone || null,
      designation: profile.designation || null,
      password:    profile.password,
    });
    return res.data;
  } catch (err) {
    console.error("registerStart error:", err.response?.status, err.response?.data);
    throw err;
  }
}

// Now sends username + email + password — backend verifies all three
export async function loginStart({ username, email, password }) {
  try {
    const res = await axios.post(`${BASE}/auth/login/start`, {
      username: username.trim(),
      email:    email.trim().toLowerCase(),
      password,
    });
    return res.data;
  } catch (err) {
    console.error("loginStart error:", err.response?.status, err.response?.data);
    throw err;
  }
}

export async function verifyOtp({ username, otp_code }) {
  try {
    const res = await axios.post(`${BASE}/auth/otp/verify`, { username, otp_code });
    return res.data;
  } catch (err) {
    console.error("verifyOtp error:", err.response?.status, err.response?.data);
    throw err;
  }
}