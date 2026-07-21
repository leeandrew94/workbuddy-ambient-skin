export async function stopForRestart({ forceRestart, quit, forceQuit }) {
  try {
    const shutdown = await quit();
    return { shutdown, forceRestarted: false };
  } catch (error) {
    if (forceRestart !== "confirmed") throw error;
    const shutdown = await forceQuit();
    return { shutdown, forceRestarted: Boolean(shutdown.forced), gracefulError: error.message };
  }
}
