import * as which from 'which';
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from 'child_process';
import * as _ from "lodash";
import { Settings } from "../settings";
import { isString } from 'util';
import { Linter } from './linter';

export class Clang extends Linter {
    constructor(settings: Settings, workspaceRoot: string) {
        super('Clang', settings, workspaceRoot, false);
        this.cascadeCommonSettings('clang');

        this.executable = settings['c-cpp-flylint'].clang.executable;
        this.configFile = settings['c-cpp-flylint'].clang.configFile;
        this.active = this.enabled = settings['c-cpp-flylint'].clang.enable;
    }

    protected buildCommandLine(fileName: string): string[] {
        let includePathParams = this.getIncludePathParams();
        let languageParam = this.getLanguageParam();
        let iquoteParams = []; // TODO: add this part for dynamic on-fly lints
        let pedanticParams = this.getPedanticParams();
        let msExtensions = this.settings['c-cpp-flylint'].clang.msExtensions ?
                                [ '-fms-extensions' ] : [];
        let noExceptions = this.settings['c-cpp-flylint'].clang.noExceptions ?
                                [ '-fno-exceptions' ] : [];
        let noRtti = this.settings['c-cpp-flylint'].clang.noRtti ?
                                [ '-fno-rtti' ] : [];
        let blocks = this.settings['c-cpp-flylint'].clang.blocks ?
                                [ '-fblocks' ] : [];
        let includeArgParams = this.expandedArgsFor(
            '-include',
            false,
            this.settings['c-cpp-flylint'].clang.includes,
            null);
        let warningsParams = this.expandedArgsFor(
            '-W',
            true,
            this.settings['c-cpp-flylint'].clang.warnings,
            null);
        let standardParams = this.expandedArgsFor(
            '--std=',
            true,
            this.standard,
            ['c11', 'c++11']);
        let standardLibParams = this.expandedArgsFor(
            '--stdlib=',
            true,
            this.settings['c-cpp-flylint'].clang.standardLibs,
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
            .concat(languageParam);

        args.push(fileName);

        return args;
    }

    protected parseLine(line: string) {
        let regex = /^(.+?):([0-9]+):([0-9]+):\s(fatal error|error|warning|note):\s(.*)$/;
        let regexArray: RegExpExecArray | null;

        let excludeRegex = /^(In file included from .*|)$/;

        if (excludeRegex.exec(line) != null) {
            // skip this line, so return that fact....
            return {};
        }

        if ((regexArray = regex.exec(line)) != null) {
            return {
                fileName: regexArray[1],
                line: parseInt(regexArray[2]) - 1,
                column: 0, // FIXME: protocol does not take start+end columns
                severity: this.getSeverityCode(regexArray[4]),
                code: 0,
                message: regexArray[5],
                source: 'Clang',
            };
        } else {
            throw Error('Line could not be parsed: ' + line);
        }
    }

    private getSeverityCode(severity: string): string {
        return this.settings['c-cpp-flylint'].clang.severityLevels[severity];
    }

    private getStandardParams() {
        let standard = this.standard;
        let params: string[] = [];

        if (standard) {
            _.each(standard, (element: string) => {
                params.push(`--std=${element}`);
            });
        }
        else {
            params.push('--std=c++11');
            params.push('--std=c11');
        }

        return params;
    }

    private getPedanticParams() {
        let params: string[] = [];

        if (this.settings['c-cpp-flylint'].clang.pedantic) {
            params.push(`-pedantic`);
        }

        if (this.settings['c-cpp-flylint'].clang.pedanticErrors) {
            params.push(`-pedantic-errors`);
        }

        return params;
    }

    private getLanguageParam() {
        let language = this.language;
        let params: string[] = [];

        if (this.isValidLanguage(language)) {
            params.push(`-x`);
            params.push(`${language}`);
        }

        return params;
    }
}
