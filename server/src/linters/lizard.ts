import { Settings } from '../settings';
import { Linter } from './linter';
import { InternalDiagnostic } from '../server';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

export class Lizard extends Linter {
    constructor(settings: Settings, workspaceRoot: string) {
        super('Lizard', settings, workspaceRoot, false);
        this.cascadeCommonSettings('lizard');

        this.setExecutable(settings.lizard.executable);
        this.active = this.enabled = settings.lizard.enable;
    }

    protected buildCommandLine(fileName: string, _tmpFileName: string): string[] {
        let args = [this.executable]
            .concat(['--warnings_only'])
            .concat(this.settings.lizard.extraArgs || []);

        args.push(fileName);

        return args;
    }

    protected parseLine(line: string): InternalDiagnostic | null {
        let regex = /^([a-zA-Z]?:?[^:]+):(\d+)?:? warning: (.+)$/;
        let regexArray: RegExpExecArray | null;
        let excludeRegex = /^$/;

        if (excludeRegex.exec(line) !== null) {
            // skip this line
            return null;
        }

        if ((regexArray = regex.exec(line)) !== null) {
            return {
                fileName: regexArray[1],
                line: parseInt(regexArray[2]) - 1,
                column: 0,
                severity: DiagnosticSeverity.Warning,
                code: 'Cyclomatic complexity',
                message: regexArray[3],
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
}
