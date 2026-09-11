// Keep the conventional /login URL out of the root [username] profile route.
// Reuse the canonical OTP-first landing experience so this alias cannot drift
// into a second authentication implementation. Query parameters such as
// returnTo are read by LandingScreen and preserved after authentication.
export { default } from './index';
