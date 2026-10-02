// Run the whole suite in a time zone west of UTC. Due dates are calendar dates
// stored at midnight UTC, so this is the zone where formatting them naively
// shows the previous day (the bug the original app shipped with).
export function setup() {
  process.env.TZ = 'America/Los_Angeles';
}
