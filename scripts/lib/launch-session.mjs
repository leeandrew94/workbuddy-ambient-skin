export async function launchCdpSession({ port, forced, launch, wait, recover, selectPort }) {
  const firstStrategy = forced ? "launch-services" : "direct";
  const firstLaunch = await launch(port, { strategy: firstStrategy });
  try {
    const targets = await wait(port, { timeoutMs: forced ? 15000 : 30000 });
    return { port, launch: firstLaunch, targets, launchRecovered: false };
  } catch (firstError) {
    if (!forced) throw firstError;
    const recovery = await recover();
    const retryPort = await selectPort(port);
    const retryLaunch = await launch(retryPort, { strategy: "direct" });
    try {
      const targets = await wait(retryPort, { timeoutMs: 30000 });
      return {
        port: retryPort, launch: retryLaunch, targets, launchRecovered: true,
        firstLaunchError: firstError.message, recovery,
      };
    } catch (retryError) {
      throw new Error(`WorkBuddy restart failed after one recovery attempt: ${firstError.message}; retry: ${retryError.message}`);
    }
  }
}
