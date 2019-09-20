import { Driver } from "../DriverTypes";

import { getAllScripts } from "../Utils";

import Configuration from "../Config";
import MigrationScript, { MigrationExecutor } from "../MigrationScript";
import createScriptContext from "./CreateScriptContext";

export default async function getUpScripts(
  config: Configuration,
  drivers: Map<string, Driver>,
  log: (message: string) => void
): Promise<Array<{ name: string; up: MigrationExecutor<void> }>> {
  let result = new Array<{ name: string; up: MigrationExecutor<void> }>();

  let scripts = await getAllScripts(config, log);

  const context = createScriptContext(drivers);

  for (const fname of scripts.keys()) {
    const script = scripts.get(fname) as MigrationScript;

    let hasRun = false;

    if (script.hasRun) {
      hasRun = await script.hasRun(context, log);
    }

    if (!hasRun) {
      result.push({
        name: fname,
        up: script.up
      });
    }
  }

  return result;
}
