export async function stopForRestart({ restartConfirmed, quit, forceQuit }) {
  try {
    const shutdown = await quit();
    return { shutdown, forceRestarted: false };
  } catch (error) {
    if (restartConfirmed !== "confirmed") throw error;
    const shutdown = await forceQuit();
    return { shutdown, forceRestarted: Boolean(shutdown.forced), gracefulError: error.message };
  }
}
