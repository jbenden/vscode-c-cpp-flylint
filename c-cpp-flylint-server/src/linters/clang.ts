import * as which from 'which';
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from 'child_process';
import * as _ from "lodash";
import { Settings } from "../settings";
import { isString } from 'util';
import { Linter } from './linter';

export class Clang extends Linter {
    private fileName : String[];
    private lineNumber : Number[];
    private messages : String[];
    private actualFileName : String;
    private tmpFileName : String;

    constructor(settings: Settings, workspaceRoot: string) {
        super('Clang', settings, workspaceRoot, false);
        this.cascadeCommonSettings('clang');

        // reset; we used all values
        this.resetParser();

        this.executable = settings['c-cpp-flylint'].clang.executable;
        this.configFile = settings['c-cpp-flylint'].clang.configFile;
        this.active = this.enabled = settings['c-cpp-flylint'].clang.enable;
    }

    protected resetParser() {
        this.actualFileName = "";
        this.tmpFileName = "";
    }

    protected buildCommandLine(fileName: string, tmpFileName: string): string[] {
        let includePathParams = this.getIncludePathParams();
        let languageParam = this.getLanguageParam();
        let iquoteParams = this.expandedArgsFor(
            '-iquote',
            false,
            [path.dirname(fileName)].concat(this.includePaths),
            null
        )
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
            .concat(languageParam)
            .concat(this.settings['c-cpp-flylint'].clang.extraArgs || []);

        args.push(tmpFileName);

        this.actualFileName = fileName;
        this.tmpFileName = tmpFileName;

        return args;
    }

    protected parseLine(line: string) {
        let regex = /^(.+?):([0-9]+):([0-9]+):\s(fatal error|error|warning|note):\s(.*)$/;
        let regexArray: RegExpExecArray | null;

        let excludeRegex = /^$/;

        if (excludeRegex.exec(line) != null) {
            // skip this line, so return that fact....
            return {};
        }

        let inFileArray: RegExpExecArray | null;
        let inFileRegex = /^In file included from (.+?):([0-9]+):/;

        if ((inFileArray = inFileRegex.exec(line)) != null) {
            let result = {
                fileName: (inFileArray[1] == this.tmpFileName ? this.actualFileName : inFileArray[1]),
                line: parseInt(inFileArray[2]) - 1,
                column: 0,
                severity: 'Warning',
                code: 0,
                message: 'Issues in file included from here',
                source: 'Clang',
            };
            // return the resulting diagnostic
            return result;
        }

        if ((regexArray = regex.exec(line)) != null) {
            let result = {
                fileName: (regexArray[1] == this.tmpFileName ? this.actualFileName : regexArray[1]),
                line: parseInt(regexArray[2]) - 1,
                column: parseInt(regexArray[3]) - 1,
                severity: this.getSeverityCode(regexArray[4]),
                code: 0,
                message: regexArray[5],
                source: 'Clang',
            };
            // return the resulting diagnostic
            return result;
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
