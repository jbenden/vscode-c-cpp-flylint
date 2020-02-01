import * as which from 'which';
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from 'child_process';
import * as _ from "lodash";
import { Settings } from "../settings";
import { isString } from 'util';
import { Linter } from './linter';

export class CppCheck extends Linter {
    constructor(settings: Settings, workspaceRoot: string) {
        super('CppCheck', settings, workspaceRoot, false);
        this.cascadeCommonSettings('cppcheck');

        this.executable = settings['c-cpp-flylint'].cppcheck.executable;
        this.configFile = settings['c-cpp-flylint'].cppcheck.configFile;
        this.active = this.enabled = settings['c-cpp-flylint'].cppcheck.enable;
    }

    protected buildCommandLine(fileName: string, tmpFileName: string): string[] {
        tmpFileName;

        let enableParams = this.settings['c-cpp-flylint'].cppcheck.unusedFunctions
                            ? [ '--enable=warning,style,performance,portability,information,unusedFunction' ]
                            : [ '--enable=warning,style,performance,portability,information' ];
        let addonParams = this.getAddonParams();
        let includeParams = this.getIncludePathParams();
        let suppressionParams = this.getSuppressionParams();
        let languageParam = this.getLanguageParam();
        let platformParams = this.getPlatformParams();
        let standardParams = this.expandedArgsFor(
            '--std=',
            true,
            this.standard,
            ['c11', 'c++11']);
        let defineParams = this.expandedArgsFor(
            '-D',
            true,
            this.defines,
            null);
        let undefineParams = this.expandedArgsFor(
            '-U',
            true,
            this.undefines,
            null);

        let args = [ this.executable ]
            .concat(['--inline-suppr'])
            .concat(enableParams)
            .concat(addonParams)
            .concat(includeParams)
            .concat(standardParams)
            .concat(defineParams)
            .concat(undefineParams)
            .concat(suppressionParams)
            .concat(languageParam)
            .concat([platformParams])
            .concat([`--template="{file}  {line}  {severity} {id}: {message}"`]);

        if (this.settings['c-cpp-flylint'].cppcheck.verbose === true) {
            args.push('--verbose');
        }

        if (this.settings['c-cpp-flylint'].cppcheck.force) {
            args.push('--force');
        }

        if (this.settings['c-cpp-flylint'].cppcheck.inconclusive === true) {
            args.push('--inconclusive');
        }

        args.push(fileName);

        return args;
    }

    protected parseLine(line: string) {
        let regex = /^(.+?)\s\s([0-9]+)\s([0-9]+\s)?\s(style|information|portability|performance|warning|error)\s(.+?):\s(.*)$/;
        let regexArray: RegExpExecArray | null;

        let excludeRegex = /^((Checking |Defines:|Undefines:|Includes:|Platform:|.*information missingInclude.*).*|)$/;

        if (excludeRegex.exec(line) != null) {
            // skip this line, so return that fact....
            return {};
        }

        if ((regexArray = regex.exec(line)) != null) {
            return {
                fileName: regexArray[1],
                line: parseInt(regexArray[2]) - 1,
                column: parseInt(regexArray[3]) || 0,
                severity: this.getSeverityCode(regexArray[4]),
                code: regexArray[5],
                message: regexArray[6],
                source: 'CppCheck',
            };
        } else {
            return { parseError: 'Line could not be parsed: ' + line };
        }
    }

    private getSeverityCode(severity: string): string {
        return this.settings['c-cpp-flylint'].cppcheck.severityLevels[severity];
    }

    private isValidStandard(standard: string): boolean {
        const allowedStandards = [ 'posix', 'c89', 'c99', 'c11', 'c++03', 'c++11' ];
        return _.includes(allowedStandards, standard);
    }

    private isValidPlatform(platform: string): boolean {
        const allowedPlatforms = [ 'avr8', 'unix32', 'unix64', 'win32A', 'win32W', 'win64', 'native' ];
        return _.includes(allowedPlatforms, platform);
    }

    private getPlatformParams() {
        let platform = this.settings['c-cpp-flylint'].cppcheck.platform;

        if (platform) {
            if (!this.isValidPlatform(platform)) {
                return '--platform=native';
            }

            return `--platform=${platform}`;
        }

        return '--platform=native';
    }

    private getSuppressionParams() {
        let suppressions = this.settings['c-cpp-flylint'].cppcheck.suppressions;
        let params: string[] = [];

        if (suppressions) {
            _.each(suppressions, (element: string) => {
                params.push(`--suppress=${element}`);
            });
        }

        return params;
    }

    private getLanguageParam() {
        let language = this.language;
        let params: string[] = [];

        if (this.isValidLanguage(language)) {
            params.push(`--language=${language}`);
        }

        return params;
    }

    private getAddonParams() {
        let addons = this.settings['c-cpp-flylint'].cppcheck.addons;
        let params: string[] = [];

        if (addons) {
            _.each(addons, (element: string) => {
                params.push(`--addon=${element}`);
            });
        }

        return params;
    }
}
