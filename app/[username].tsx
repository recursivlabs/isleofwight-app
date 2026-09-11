// Root-level /<username> profile route — mirrors legacy minds.com/<username> so
// external links to Minds profiles survive the cutover. /user/<username> stays as
// a permanent alias (both render the same screen). Expo-router resolves static
// routes (/discover, /wallet, /create, …) BEFORE this dynamic segment, so only
// non-route single-segment paths fall through to a profile; a non-existent handle
// shows the screen's built-in "user not found" state. Reserved usernames are
// blocked at signup server-side, so they never become real profiles here.
export { default } from './user/[username]';
