export async function stopForRestart({ restartConfirmed, forceQuit }) {
  if (restartConfirmed !== "confirmed") throw new Error("restart requires --restart confirmed");
  const shutdown = await forceQuit();
  return { shutdown, forceRestarted: Boolean(shutdown.forced) };
}
