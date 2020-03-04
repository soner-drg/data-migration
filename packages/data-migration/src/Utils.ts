import * as babel from "@babel/core";
import * as fs from "fs";
import * as path from "path";

import { MigrationScript } from "../src";

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
  return function(message: string) {
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

export async function loadScript<T>(filename: string): Promise<T> {
  const transformResult = await babel.transformFileAsync(filename, {
    presets: ["@babel/preset-typescript", ["@babel/preset-env", { targets: { node: true } }]],
    cwd: process.cwd(),
  });

  let script: T;
  if (transformResult && transformResult.code) {
    // tslint:disable-next-line:no-eval
    script = eval(transformResult.code);
  }

  // @ts-ignore
  return script;
}

export async function getAllScripts(
  config: Configuration,
  log: Logger
): Promise<Map<string, MigrationScript>> {
  let scripts = new Map<string, MigrationScript>();
  let scriptFiles = fs
    .readdirSync(getMigrationsPath(config))
    .filter((fname: string) => /\.(t|j)s$/gi.test(fname));

  for (const fname of scriptFiles) {
    try {
      const filename = path.join(getMigrationsPath(config), fname);
      const script = await loadScript<MigrationScript>(filename);

      scripts.set(fname, script);
    } catch (ex) {
      log(ex.message);
    }
  }

  return scripts;
}
