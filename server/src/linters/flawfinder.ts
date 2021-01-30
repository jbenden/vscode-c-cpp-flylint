import * as _ from "lodash";
import { Settings } from "../settings";
import { Linter } from './linter';
import { InternalDiagnostic } from "../server";
import { DiagnosticSeverity } from "vscode-languageserver-protocol";

export class FlawFinder extends Linter {
    constructor(settings: Settings, workspaceRoot: string) {
        super('FlawFinder', settings, workspaceRoot, false);
        this.cascadeCommonSettings('flawfinder');

        this.setExecutable(settings['c-cpp-flylint'].flawfinder.executable);
        this.active = this.enabled = settings['c-cpp-flylint'].flawfinder.enable;
    }

    protected buildCommandLine(fileName: string, _tmpFileName: string): string[] {
        let args = [ this.executable ]
            .concat(['--columns'])
            .concat(['--dataonly'])
            .concat(['--singleline'])
            .concat([]);

        args.push(fileName);

        return args;
    }

    protected parseLine(line: string): InternalDiagnostic | null {
        let regex = /^([a-zA-Z]?:?[^:]+):(\d+):(\d+)?:?  \[([0-5])\] ([^:]+):(.+)$/;
        let regexArray: RegExpExecArray | null;

        let excludeRegex = /^((Examining ).*|)$/;

        if (excludeRegex.exec(line) != null) {
            // skip this line
            return null;
        }

        if ((regexArray = regex.exec(line)) != null) {
            return {
                fileName: regexArray[1],
                line: parseInt(regexArray[2]) - 1,
                column: parseInt(regexArray[3]) - 1 || 0,
                severity: this.getSeverityCode(regexArray[4]),
                code: regexArray[5],
                message: regexArray[6],
                source: 'FlawFinder',
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
                source: 'FlawFinder'
            };
        }
    }

    private getSeverityCode(severity: string): DiagnosticSeverity {
        return this.settings['c-cpp-flylint'].flawfinder.severityLevels[severity];
    }
}
