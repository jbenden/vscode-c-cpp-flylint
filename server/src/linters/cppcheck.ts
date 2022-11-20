// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT

import * as _ from 'lodash';
import { CppCheckSeverityMaps, Settings, VS_DiagnosticSeverity } from '../settings';
import { Linter } from './linter';
import { InternalDiagnostic } from '../server';
import { path as sysPath } from '../utils';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

export class CppCheck extends Linter {
    constructor(settings: Settings, workspaceRoot: string) {
        super('CppCheck', settings, workspaceRoot, false);
        this.cascadeCommonSettings('cppcheck');

        this.executable = settings.cppcheck.executable;
        this.configFile = settings.cppcheck.configFile;
        this.active = this.enabled = settings.cppcheck.enable;
    }

    protected buildCommandLine(fileName: string, _tmpFileName: string): string[] {
        let enableParams = this.settings.cppcheck.unusedFunctions
            ? ['--enable=warning,style,performance,portability,information,unusedFunction']
            : ['--enable=warning,style,performance,portability,information'];
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

        let args = [this.executable]
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
            .concat([`--template="{file}  {line}  {severity} {id}: {message}"`])
            .concat(this.settings.cppcheck.extraArgs || []);

        if (this.settings.cppcheck.verbose) {
            args.push('--verbose');
        }

        if (this.settings.cppcheck.force) {
            args.push('--force');
        }

        if (this.settings.cppcheck.inconclusive) {
            args.push('--inconclusive');
        }

        args.push(sysPath(fileName));

        return args;
    }

    protected parseLine(line: string): InternalDiagnostic | null {
        let regex = /^(.+?)\s\s([0-9]+)\s([0-9]+\s)?\s(style|information|portability|performance|warning|error)\s(.+?):\s(.*)$/;
        let regexArray: RegExpExecArray | null;

        let excludeRegex = /^((Checking |Defines:|Undefines:|Includes:|Platform:|.*information missingInclude.*).*|cppcheck: .*. Disabling .* check.|)$/;

        if (excludeRegex.exec(line) !== null) {
            // skip this line
            return null;
        }

        if ((regexArray = regex.exec(line)) !== null) {
            return {
                fileName: regexArray[1],
                line: parseInt(regexArray[2]) - 1,
                column: parseInt(regexArray[3]) || 0,
                severity: this.getSeverityCode(regexArray[4]),
                code: regexArray[5],
                message: regexArray[6],
                source: this.name,
            };
        } else {
            return {
                parseError: 'Line could not be parsed: ' + line,
                fileName: '',
                line: 0,
                column: 0,
                severity: DiagnosticSeverity.Error,
                code: 0,
                message: '',
                source: this.name
            };
        }
    }

    private getSeverityCode(severity: string): DiagnosticSeverity {
        let output = this.settings.cppcheck.severityLevels[severity as keyof CppCheckSeverityMaps];
        return VS_DiagnosticSeverity.from(output);
    }

    private isValidPlatform(platform: string): boolean {
        const allowedPlatforms = ['avr8', 'unix32', 'unix64', 'win32A', 'win32W', 'win64', 'native'];
        return _.includes(allowedPlatforms, platform);
    }

    private getPlatformParams(): string {
        let platform = this.settings.cppcheck.platform;

        if (platform) {
            if (!this.isValidPlatform(platform)) {
                return '--platform=native';
            }

            return `--platform=${platform}`;
        }

        return '--platform=native';
    }

    private getSuppressionParams(): string[] {
        let suppressions = this.settings.cppcheck.suppressions;
        let params: string[] = [];

        if (suppressions) {
            _.each(suppressions, (element: string) => {
                params.push(`--suppress=${element}`);
            });
        }

        return params;
    }

    private getLanguageParam(): string[] {
        let language = this.language;
        let params: string[] = [];

        if (this.isValidLanguage(language)) {
            params.push(`--language=${language}`);
        }

        return params;
    }

    private getAddonParams(): string[] {
        let addons = this.settings.cppcheck.addons;
        let params: string[] = [];

        if (addons) {
            _.each(addons, (element: string) => {
                params.push(`--addon=${element}`);
            });
        }

        return params;
    }
}
