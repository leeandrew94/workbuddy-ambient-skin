export function chooseApplyPath({ targetsAvailable, authenticated, restartConfirmed }) {
  if (targetsAvailable && authenticated) return "direct";
  if (restartConfirmed) return "handoff";
  return "needs-restart";
}
