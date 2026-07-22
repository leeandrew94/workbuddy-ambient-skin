import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("macOS apply uses one synchronous restart pipeline", async () => {
  const script = await readFile(new URL("../scripts/apply.command", import.meta.url), "utf8");
  assert.match(script, /osascript.*WorkBuddy.*quit/);
  assert.match(script, /pkill -9 -f '\/Applications\/WorkBuddy/);
  assert.match(script, /nohup .*Electron.*--remote-debugging-port/);
  assert.match(script, /curl --noproxy '\*'.*json\/version/);
  assert.match(script, /json\/list/);
  assert.match(script, /inject --theme/);
  assert.match(script, /verify/);
  assert.doesNotMatch(script, /pending|apply-request|apply-result|worker/);
});

test("Agent apply opens a disposable command through LaunchServices", async () => {
  const source = await readFile(new URL("../scripts/ambient.mjs", import.meta.url), "utf8");
  assert.match(source, /workbuddy-ambient-apply-.*\.command/);
  assert.match(source, /"\/usr\/bin\/open", \[launcher\]/);
  assert.match(source, /rm -f/);
  assert.doesNotMatch(source, /tell application \\"Terminal\\"|do script|launchctl/);
});
