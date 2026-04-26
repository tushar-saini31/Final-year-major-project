const DUMMY_OTP = "123456";

export async function sendDummyOtp(profile) {
  return mode === "register" 
    ? await registerStart(profile)
    : await loginStart({ username: profile.username });
}

export async function verifyOtp(payload) {
  return await verifyOtpReal(payload);
}
