// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT

import * as path from 'path';
import { ClangSeverityMaps, Settings, VS_DiagnosticSeverity } from '../settings';
import { Linter, Lint } from './linter';
import { InternalDiagnostic } from '../server';
import { path as sysPath } from '../utils';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

export class Clang extends Linter {
    private actualFileName: string = '';
    private tmpFileName: string = '';

    constructor(settings: Settings, workspaceRoot: string) {
        super('Clang', settings, workspaceRoot, false);
        this.cascadeCommonSettings('clang');

        this.executable = settings.clang.executable;
        this.configFile = settings.clang.configFile;
        this.active = this.enabled = settings.clang.enable;
    }

    /* istanbul ignore next */
    public lintOn(): Lint[] {
        return [Lint.ON_SAVE, Lint.ON_TYPE, Lint.ON_BUILD];
    }

    protected buildCommandLine(fileName: string, tmpFileName: string): string[] {
        let includePathParams = this.getIncludePathParams();
        let languageParam = this.getLanguageParam();
        let iquoteParams: string[];

        if (this.settings.run === 'onType') {
            iquoteParams = this.expandedArgsFor(
                '-iquote',
                false,
                [path.dirname(fileName)].concat(this.includePaths),
                null
            );
        } else {
            iquoteParams = [];
        }

        let pedanticParams = this.getPedanticParams();
        let msExtensions = this.settings.clang.msExtensions ?
            ['-fms-extensions'] : [];
        let noExceptions = this.settings.clang.noExceptions ?
            ['-fno-exceptions'] : [];
        let noRtti = this.settings.clang.noRtti ?
            ['-fno-rtti'] : [];
        let blocks = this.settings.clang.blocks ?
            ['-fblocks'] : [];
        let includeArgParams = this.expandedArgsFor(
            '-include',
            false,
            this.settings.clang.includes,
            null);
        let warningsParams = this.expandedArgsFor(
            '-W',
            true,
            this.settings.clang.warnings,
            null);
        let standardParams = this.expandedArgsFor(
            '--std=',
            true,
            this.standard,
            ['c11', 'c++11']);
        let standardLibParams = this.expandedArgsFor(
            '--stdlib=',
            true,
            this.settings.clang.standardLibs,
            null);
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

        let args = [
            this.executable,
            '-fsyntax-only',
            '-fno-color-diagnostics',
            '-fno-caret-diagnostics',
            '-fno-diagnostics-show-option',
            '-fdiagnostics-show-category=name',
            '-ferror-limit=200'
        ]
            .concat(iquoteParams)
            .concat(standardParams)
            .concat(pedanticParams)
            .concat(standardLibParams)
            .concat(msExtensions)
            .concat(noExceptions)
            .concat(noRtti)
            .concat(blocks)
            .concat(includeArgParams)
            .concat(warningsParams)
            .concat(defineParams)
            .concat(undefineParams)
            .concat(includePathParams)
            .concat(languageParam)
            .concat(this.settings.clang.extraArgs || []);

        if (this.settings.run === 'onType') {
            args.push(sysPath(tmpFileName));
        } else {
            args.push(sysPath(fileName));
        }

        this.actualFileName = fileName;
        this.tmpFileName = tmpFileName;

        return args;
    }

    protected parseLine(line: string): InternalDiagnostic | null {
        let regex = /^(.+?):([0-9]+):([0-9]+):\s(fatal|error|warning|note)(?: error)?:\s(.*)$/;
        let regexArray: RegExpExecArray | null;

        if (line === '') {
            // skip this line
            return null;
        }

        let excludeRegex = /^(WX.*|_WX.*|__WX.*|Q_.*|warning: .* incompatible with .*|warning: .* input unused|warning: include location .* is unsafe for cross-compilation.*)$/;
        if (excludeRegex.exec(line) !== null) {
            // skip this line
            return null;
        }

        let inFileArray: RegExpExecArray | null;
        let inFileRegex = /^In file included from (.+?):([0-9]+):$/;

        if ((inFileArray = inFileRegex.exec(line)) !== null) {
            return {
                fileName: (inFileArray[1] === this.tmpFileName ? this.actualFileName : inFileArray[1]),
                line: parseInt(inFileArray[2]) - 1,
                column: 0,
                severity: DiagnosticSeverity.Warning,
                code: 0,
                message: 'Issues in file included from here',
                source: this.name
            };
        }

        if ((regexArray = regex.exec(line)) !== null) {
            return {
                fileName: (regexArray[1] === this.tmpFileName ? this.actualFileName : regexArray[1]),
                line: parseInt(regexArray[2]) - 1,
                column: parseInt(regexArray[3]) - 1,
                severity: this.getSeverityCode(regexArray[4]),
                code: 0,
                message: regexArray[5],
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
        let output = this.settings.clang.severityLevels[severity as keyof ClangSeverityMaps];
        return VS_DiagnosticSeverity.from(output);
    }

    private getPedanticParams(): string[] {
        let params: string[] = [];

        if (this.settings.clang.pedantic) {
            params.push(`-pedantic`);
        }

        if (this.settings.clang.pedanticErrors) {
            params.push(`-pedantic-errors`);
        }

        return params;
    }

    private getLanguageParam(): string[] {
        let language = this.language;
        let params: string[] = [];

        if (this.isValidLanguage(language)) {
            params.push(`-x`);
            params.push(`${language}`);
        }

        return params;
    }
}
