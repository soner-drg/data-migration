import * as babel from "@babel/core";
import * as fs from "fs";
import * as path from "path";

import { MigrationScript, ScriptContext } from "./";

import Configuration from "./Config";
import { MissingParameters } from "./Errors";
import { getMigrationsPath } from "./methods";
import { Logger } from "./Logger";

export function checkParameters(
  label: string,
  requiredParams: Array<string>,
  params: { [key: string]: any }
) {
  const missingParams = requiredParams.filter((key) => !params[key]);
  if (missingParams.length > 0) {
    throw new MissingParameters(label, missingParams);
  }
}

export function createLogger(observer?: ZenObservable.Observer<any>) {
  return function (message: string) {
    if (observer && observer.next) {
      observer.next(message);
    } else {
      // tslint:disable-next-line:no-console
      console.log(message);
    }
  };
}

export function createErrorLogger(observer?: ZenObservable.Observer<any>) {
  return function log(message: string) {
    if (observer && observer.error) {
      observer.error(message);
    } else {
      // tslint:disable-next-line:no-console
      console.error(message);
    }
  };
}

export class CompileScriptError extends Error {
  constructor(public filename: string) {
    super(`Error while compiling ${filename}`);
  }
}

export async function loadScript<T>(filename: string): Promise<T> {
  const transformResult = await babel.transformFileAsync(filename, {
    presets: ["@babel/preset-typescript", ["@babel/preset-env", { targets: { node: true } }]],
    cwd: process.cwd(),
  });

  let script: T;

  if (transformResult?.code) {
    // tslint:disable-next-line:no-eval
    script = eval(transformResult.code);
  } else {
    throw new CompileScriptError(filename);
  }

  // @ts-ignore
  return script;
}

export interface GetAllScripts {
  config: Configuration;
  scope?: string;
  log: Logger;
}
export async function getAllScripts({
  config,
  scope,
  log,
}: GetAllScripts): Promise<Map<string, MigrationScript>> {
  let scripts = new Map<string, MigrationScript>();
  const migrationsPath = getMigrationsPath(config, scope);
  let scriptFiles = fs
    .readdirSync(migrationsPath)
    .filter((fname: string) => /\.(t|j)s$/gi.test(fname));

  for (const fname of scriptFiles) {
    let script: MigrationScript;
    try {
      const filename = path.join(migrationsPath, fname);
      script = await loadScript<MigrationScript>(filename);
    } catch (ex) {
      log(ex.message);
      const errorMessage = ex.message;
      script = {
        async up(context: ScriptContext, log: Logger) {
          log(errorMessage);
          throw new Error(errorMessage);
        },
        async down(context: ScriptContext, log: Logger) {
          log(errorMessage);
          throw new Error(errorMessage);
        },
      };
    }

    scripts.set(fname, script);
  }

  return scripts;
}
