// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT

import * as path from 'path';
import * as _ from 'lodash';
import { FlexelintSeverityMaps, Settings, VS_DiagnosticSeverity } from '../settings';
import { headerExts, Linter } from './linter';
import { InternalDiagnostic } from '../server';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

export class Flexelint extends Linter {
    constructor(settings: Settings, workspaceRoot: string) {
        super('Flexelint', settings, workspaceRoot, true);
        this.cascadeCommonSettings('flexelint');

        this.executable = settings.flexelint.executable;
        this.configFile = settings.flexelint.configFile;
        this.active = this.enabled = settings.flexelint.enable;
    }

    protected buildCommandLine(fileName: string, _tmpFileName: string): string[] {
        var args = [
            this.executable,
            '-v',
            '-b',
            '-format=%f  %l %c  %t %n: %m',
            this.configFile,
            '-hsFr_1',
            '-width(4096,0)',
            '-zero(400)',
        ];

        if (headerExts.indexOf(path.extname(fileName)) !== -1) {
            var hArgs = this.settings.flexelint.headerArgs;

            if (_.isString(hArgs)) {
                args.push(hArgs);
            } else {
                hArgs.forEach(element => {
                    args.push(element);
                });
            }
        }

        args.push(fileName);

        return args;
    }

    protected transformParse(currentParsed: InternalDiagnostic | null, parsed: InternalDiagnostic | null) {
        if (parsed) {
            if ((parsed['code'] === '830' && parsed['message'] !== 'Location cited in prior message') || (parsed['code'] === '831' && parsed['message'] !== 'Reference cited in prior message')) {
                currentParsed!['line'] = parsed['line'];
                currentParsed!['column'] = parsed['column'];
                parsed = null;
            } else if (parsed['code'] === '830' || parsed['code'] === '831') {
                parsed = null;
            }
        }

        return { currentParsed: currentParsed, parsed: parsed };
    }

    protected parseLine(line: string): InternalDiagnostic | null {
        let regex = /^(.+?)\s\s([0-9]+)\s([0-9]+\s)?\s(Info|Warning|Error|Note)\s([0-9]+):\s(.*)$/;
        let regexArray: RegExpExecArray | null;

        let excludeRegex = /^((During Specific Walk:|\s\sFile\s).*|)$/;

        if (excludeRegex.exec(line) !== null) {
            // skip this line
            return null;
        }

        if ((regexArray = regex.exec(line)) !== null) {
            return {
                fileName: regexArray[1],
                line: parseInt(regexArray[2]) - 1,
                column: 0,
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
        let output = this.settings.flexelint.severityLevels[severity as keyof FlexelintSeverityMaps];
        return VS_DiagnosticSeverity.from(output);
    }
}
