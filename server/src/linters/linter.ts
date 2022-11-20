// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT

/* eslint-disable no-console */
import * as which from 'which';
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import { InternalDiagnostic } from '../server';
import { Settings } from '../settings';
import { path as sysPath } from '../utils';
import * as cross_spawn from 'cross-spawn';
import * as child_process from 'child_process';

const substituteVariables = require('var-expansion').substituteVariables; // no types available
const slash = require('slash'); // no types available

export interface IExpansionResult {
    error?: any;
    result?: string;
}

export const headerExts = ['.h', '.H', '.hh', '.hpp', '.h++', '.hxx'];

export enum Lint {
    ON_SAVE = 1,
    ON_TYPE = 2,
    ON_BUILD = 3,
}

export function toLint(s: string): Lint {
    switch (s) {
        case 'onSave': return Lint.ON_SAVE;
        case 'onType': return Lint.ON_TYPE;
        case 'onBuild': return Lint.ON_BUILD;
        default:
            throw Error('Unknown onLint value of ' + s);
    }
}

export function fromLint(lint: Lint): string {
    switch (lint) {
        case Lint.ON_SAVE: return 'ON_SAVE';
        case Lint.ON_TYPE: return 'ON_TYPE';
        case Lint.ON_BUILD: return 'ON_BUILD';
        default:
            throw Error('Unknown enum Lint value of ' + lint);
    }
}

export class PathEnv {
    private paths: Array<string> = [];

    constructor() {
        if (process.env.PATH) { this.paths = process.env.PATH.split(path.delimiter); }
    }

    append(p: string | Array<string>) {
        // assert(p.includes(path.delimiter) !== true);

        this.paths = this.deduplicate(this.paths.concat(...p));
    }

    prepend(p: string | Array<string>) {
        // assert(p.includes(path.delimiter) !== true);

        if (typeof p === 'string') {
            p = [p];
        }

        this.paths = this.deduplicate(p.concat(...this.paths));
    }

    protected deduplicate(array: ReadonlyArray<string>) {
        return Array.from(new Set(array));
    }

    toString() {
        return this.paths.join(path.delimiter);
    }
}

export class Linter {
    protected name: string;
    protected settings: Settings;
    protected workspaceRoot: string;
    protected enabled: boolean;
    protected active: boolean;
    protected executable: string = '';
    protected configFile: string = '';
    protected requireConfig: boolean;
    protected language: string;
    protected standard: string[];
    protected defines: string[];
    protected undefines: string[];
    protected includePaths: string[];

    protected constructor(name: string, settings: Settings, workspaceRoot: string, requireConfig: boolean) {
        this.name = name;
        this.settings = settings;
        this.workspaceRoot = workspaceRoot;
        this.requireConfig = requireConfig;
        this.enabled = true;
        this.active = true;
        this.language = settings.language;
        this.standard = settings.standard;
        this.defines = settings.defines;
        this.undefines = settings.undefines;
        this.includePaths = settings.includePaths;
    }

    protected cascadeCommonSettings(key: string) {
        let checkKey = (item: string): boolean => {
            return this.settings[key as keyof Settings].hasOwnProperty(item) &&
                this.settings[key as keyof Settings].hasOwnProperty(item) !== null &&
                (this.settings[key as keyof Settings] as any)[item] !== null;
        };

        let maybe = (orig: string[] | string, maybeKey: string) => {
            if (checkKey(maybeKey)) {
                if (_.isArray(orig) || _.isString(orig)) {
                    return (this.settings[key as keyof Settings] as any)[maybeKey];
                }
            }

            return orig;
        };

        this.language = maybe(this.language, 'language');
        this.standard = maybe(this.standard, 'standard');
        this.defines = maybe(this.defines, 'defines');
        this.undefines = maybe(this.undefines, 'undefines');
        this.includePaths = maybe(this.includePaths, 'includePaths');
    }

    protected setExecutable(fileName: string) {
        this.executable = fileName;
    }

    protected setConfigFile(fileName: string) {
        this.configFile = fileName;
    }

    public Name(): string {
        return this.name;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public isActive(): boolean {
        return this.active;
    }

    public enable() {
        this.enabled = true;
    }

    public disable() {
        this.enabled = false;
    }

    public async initialize() {
        await this.maybeEnable().catch(() => {
            // empty
        });
        return this;
    }

    private async maybeEnable() {
        if (!this.isEnabled()) {
            return Promise.resolve('');
        }

        return this.maybeExecutablePresent()
            .then((val) => {
                this.executable = val;

                return this.maybeConfigFilePresent();
            });
    }

    private maybeExecutablePresent(): Promise<string> {
        return new Promise((resolve, reject) => {
            let paths = new PathEnv();

            paths.prepend(path.resolve(__dirname, '../../..'));

            which(this.executable, { path: paths.toString() }, (err: any, result: any) => {
                if (err) {
                    this.disable();

                    if (this.settings.debug) {
                        console.log(`The executable was not found for ${this.name}; looked for ${this.executable}`);
                    }

                    reject(Error(`The executable was not found for ${this.name}, disabling linter`));
                }
                else {
                    resolve(result);
                }
            });
        });
    }

    private async maybeConfigFilePresent(): Promise<string> {
        if (!this.requireConfig) {
            return Promise.resolve('');
        }

        return this.locateFile(this.workspaceRoot, this.configFile)
            .then((val) => {
                this.configFile = val;

                this.enable();

                return val;
            })
            .catch(() => {
                this.disable();

                console.log(`The configuration file was not found for ${this.name}; looked for ${this.configFile}`);

                throw Error(`could not locate configuration file for ${this.name}, disabling linter`);
            });
    }

    protected locateFile(directory: string, fileName: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let parent = directory;

            do {
                directory = parent;

                const location: string = (() => {
                    if (path.isAbsolute(fileName)) {
                        return fileName;
                    } else {
                        return path.join(directory, fileName);
                    }
                })();

                try {
                    fs.accessSync(location, fs.constants.R_OK);
                    resolve(location);
                } catch (e) {
                    // do nothing
                }

                parent = path.dirname(directory);
            } while (parent !== directory);

            reject('could not locate file within project workspace');
        });
    }

    protected expandVariables(str: string): IExpansionResult {
        process.env.workspaceRoot = this.workspaceRoot;
        process.env.workspaceFolder = this.workspaceRoot;
        let { value, error } = substituteVariables(str, { env: process.env });

        if (error) {
            return { error: error };
        } else if (value === '') {
            return { error: `Expanding '${str}' resulted in an empty string.` };
        } else {
            return { result: slash(value) };
        }
    }

    protected buildCommandLine(fileName: string, tmpFileName: string): string[] {
        return [this.executable, fileName, tmpFileName];
    }

    protected runLinter(params: string[], workspaceDir: string): child_process.SpawnSyncReturns<string> {
        let cmd = params.shift() || this.executable;

        if (this.settings.debug) {
            console.log('executing: ', cmd, params.join(' '));
        }

        return cross_spawn.sync(cmd, params, { 'cwd': workspaceDir, encoding: 'utf8' });
    }

    public lint(fileName: string, directory: null | string, tmpFileName: string): InternalDiagnostic[] {
        if (!this.enabled) { return []; }

        let result = this.runLinter(this.buildCommandLine(fileName, tmpFileName), directory || this.workspaceRoot);
        let stdout = result.stdout !== null ? result.stdout.replace(/\r/g, '').split('\n') : [];
        let stderr = result.stderr !== null ? result.stderr.replace(/\r/g, '').split('\n') : [];

        if (this.settings.debug) {
            console.log(stdout);
            console.log(stderr);
        }

        if (result.status !== 0) {
            console.log(`${this.name} exited with status code ${result.status}`);
        }

        return this.parseLines(stdout.concat(stderr));
    }

    protected isQuote(ch: string): boolean {
        return ch === '\'' || ch === '\"';
    }

    protected parseLines(lines: string[]): InternalDiagnostic[] {
        let results: InternalDiagnostic[] = [];
        let currentParsed: InternalDiagnostic | null = null;

        lines.forEach(line => {
            if (this.isQuote(line.charAt(0))) {
                line = line.substring(1);

                if (this.isQuote(line.charAt(line.length - 1))) {
                    line = line.substring(0, line.length - 1);
                }
            }

            let parsed = this.parseLine(line);
            if (parsed) {
                // check for parse error
                if (parsed.parseError) {
                    if (this.settings.ignoreParseErrors) {
                        console.log(parsed.parseError);
                        return;
                    } else {
                        throw Error(parsed.parseError);
                    }
                }

                ({ currentParsed, parsed } = this.transformParse(currentParsed, parsed));

                if (currentParsed !== null && !currentParsed.parseError) {
                    // output an entry
                    results.push(currentParsed);
                }

                currentParsed = parsed;
            }
        });

        if (currentParsed !== null) {
            // output an entry
            results.push(currentParsed);
        }

        return results;
    }

    protected transformParse(currentParsed: InternalDiagnostic | null, parsed: InternalDiagnostic | null) {
        return { currentParsed: currentParsed, parsed: parsed };
    }

    protected parseLine(_line: string): InternalDiagnostic | null {
        return null;
    }

    protected isValidLanguage(language: string): boolean {
        const allowLanguages = ['c', 'c++'];
        return _.includes(allowLanguages, language);
    }

    protected getIncludePathParams(): string[] {
        let paths = this.includePaths;
        let params: string[] = [];

        if (paths) {
            _.each(paths, (element: string) => {
                let value = this.expandVariables(element);
                if (value.error) {
                    console.log(`Error expanding include path '${element}': ${value.error.message}`);
                } else {
                    params.push(`-I`);
                    params.push(`${sysPath(value.result!)}`);
                }
            });
        }

        return params;
    }

    protected expandedArgsFor(key: string, joined: boolean, values: string[] | null, defaults: string[] | null): string[] {
        let params: string[] = [];
        let elaborateArguments = (element: string) => {
            if (element === '') {
                return;
            }
            let value = this.expandVariables(element);
            if (value.error) {
                console.log(`Error expanding '${element}': ${value.error.message}`);
            } else {
                if (joined) {
                    params.push(`${key}${value.result}`);
                } else {
                    params.push(key);
                    params.push(`${value.result}`);
                }
            }
        };

        _.each(values ? values : defaults, elaborateArguments);

        return params;
    }
}
