// A unique route for private-screen authentication handoffs.
//
// Reuse the primary OTP-first landing experience instead of maintaining a
// second sign-in implementation. The `auth=otp` query parameter opens the
// email-code form immediately and `returnTo` is handled by LandingScreen after
// the session is established.
export { default } from '../index';
