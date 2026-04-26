import axios from "axios";

const BASE = "http://127.0.0.1:8000";

export const registerFace = async (username, imageBlob) => {
  const form = new FormData();
  form.append("username", username);
  form.append("file", imageBlob, "photo.jpg");
  const res = await axios.post(`${BASE}/face/register`, form);
  return res.data;
};

export const loginFace = async (username, imageBlob) => {
  const form = new FormData();
  form.append("username", username);
  form.append("file", imageBlob, "photo.jpg");
  const res = await axios.post(`${BASE}/face/login`, form);
  return res.data;
};