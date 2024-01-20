// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT

import * as path from 'path';
import * as _ from 'lodash';
import { PclintPlusSeverityMaps, Settings, VS_DiagnosticSeverity } from '../settings';
import { headerExts, Linter } from './linter';
import { InternalDiagnostic } from '../server';
import { path as sysPath } from '../utils';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

type ParseData = {
    fileName: string,
    line: string,
    column: string,
};

export class PclintPlus extends Linter {
    private lastParse: ParseData = <ParseData>{};

    constructor(settings: Settings, workspaceRoot: string) {
        super('PclintPlus', settings, workspaceRoot, true);
        this.cascadeCommonSettings('pclintplus');

        this.setExecutable(settings.pclintplus.executable);
        this.setConfigFile(settings.pclintplus.configFile);
        this.active = this.enabled = settings.pclintplus.enable;
    }

    protected buildCommandLine(fileName: string, _tmpFileName: string): string[] {
        let args = [
            this.executable,
            this.configFile,
            '-v',                            // turn off verbosity
            '-b',                            // suppress banner output
            '-format=%f  %l %c  %t %n: %m',  // format of diagnostic
            '-h1',                           // height of diagnostics message
            '-width(0,0)',                   // width of a line, and continuation indent
            '-zero(400)',                    // exit zero if no warnings at level >= 400
        ];

        if (headerExts.indexOf(path.extname(fileName)) !== -1) {
            let hArgs = this.settings.pclintplus.headerArgs;

            if (typeof hArgs === 'string') {
                args.push(hArgs);
            } else {
                hArgs.forEach(element => {
                    args.push(element);
                });
            }
        }

        args.push(sysPath(fileName));

        return args;
    }

    protected parseLine(line: string): InternalDiagnostic | null {
        let regex = /^(([^ ]+)?\s\s([0-9]+)\s([0-9]+\s)?\s([iI]nfo|[wW]arning|[eE]rror|[nN]ote|[sS]upplemental)\s([0-9]+):\s(.*)|(.+?):([0-9]+):([0-9]+:)?\s([iI]nfo|[wW]arning|[eE]rror|[nN]ote|[sS]upplemental)\s([0-9]+):\s(.*))$/;
        let regexArray: RegExpExecArray | null;

        let excludeRegex = /^(\s+file '.*'|PC-lint.*|licensed.*|LICENSED.*|.*evaluation license.*|[^ \t]+|)$/;
        if (excludeRegex.exec(line) !== null) {
            // skip this line
            return null;
        }

        if ((regexArray = regex.exec(line)) !== null) {
            if (_.every([regexArray[3], regexArray[4], regexArray[5]], el => el !== undefined)) {
                if (_.isUndefined(regexArray[2])) {
                    regexArray[2] = this.lastParse.fileName;
                    regexArray[3] = this.lastParse.line;
                    regexArray[4] = this.lastParse.column;
                } else {
                    this.lastParse.fileName = regexArray[2];
                    this.lastParse.line = regexArray[3];
                    this.lastParse.column = regexArray[4];
                }
                return {
                    fileName: regexArray[2],
                    line: parseInt(regexArray[3]) - 1,
                    column: 0,
                    severity: this.getSeverityCode(regexArray[5].toLowerCase()),
                    code: regexArray[6],
                    message: regexArray[7],
                    source: this.name,
                };
            } else {
                if (_.isUndefined(regexArray[8])) {
                    regexArray[8] = this.lastParse.fileName;
                    regexArray[9] = this.lastParse.line;
                    regexArray[10] = this.lastParse.column;
                } else {
                    this.lastParse.fileName = regexArray[8];
                    this.lastParse.line = regexArray[9];
                    this.lastParse.column = regexArray[10];
                }
                return {
                    fileName: regexArray[8],
                    line: parseInt(regexArray[9]) - 1,
                    column: 0,
                    severity: this.getSeverityCode(regexArray[11].toLowerCase()),
                    code: regexArray[12],
                    message: regexArray[13],
                    source: this.name,
                };
            }
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

    protected transformParse(currentParsed: InternalDiagnostic | null, parsed: InternalDiagnostic | null) {
        if (parsed) {
            // Skip over successful completion messages...
            if (parsed['code'] === '900') {
                parsed = null;
            }
        }

        return { currentParsed: currentParsed, parsed: parsed };
    }

    private getSeverityCode(severity: string): DiagnosticSeverity {
        let output = this.settings.pclintplus.severityLevels[severity as keyof PclintPlusSeverityMaps];
        return VS_DiagnosticSeverity.from(output);
    }
}
