import * as path from "path";
import * as _ from "lodash";
import { Settings } from "../settings";
import { headerExts, Linter } from './linter';

export class PclintPlus extends Linter {
    constructor(settings: Settings, workspaceRoot: string) {
        super('PclintPlus', settings, workspaceRoot, true);
        this.cascadeCommonSettings('pclintplus');

        this.setExecutable(settings['c-cpp-flylint'].pclintplus.executable);
        this.setConfigFile(settings['c-cpp-flylint'].pclintplus.configFile);
        this.active = this.enabled = settings['c-cpp-flylint'].pclintplus.enable;
    }

    protected buildCommandLine(fileName: string, _tmpFileName: string): string[] {
        var args = [
            this.executable,
            this.configFile,
            "-v",                            // turn off verbosity
            "-b",                            // suppress banner output
            "-format=%f  %l %c  %t %n: %m",  // format of diagnostic
            "-h1",                           // height of diagnostics message
            "-width(0,0)",                   // width of a line, and continuation indent
            "-zero(400)",                    // exit zero if no warnings at level >= 400
        ]

        if (headerExts.indexOf(path.extname(fileName)) != -1) {
            var hArgs = this.settings['c-cpp-flylint'].pclintplus.headerArgs;

            if (typeof hArgs === 'string') {
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

    protected parseLine(line: string) {
        let regex = /^((.+?)\s\s([0-9]+)\s([0-9]+\s)?\s(info|warning|error|note|supplemental)\s([0-9]+):\s(.*)|(.+?):([0-9]+):([0-9]+:)?\s(info|warning|error|note|supplemental)\s([0-9]+):\s(.*))$/;
        let regexArray: RegExpExecArray | null;

        let excludeRegex = /^(\s.*|[^\s:]+|)$/;

        if (excludeRegex.exec(line) != null) {
            // skip this line
            return {};
        }

        if ((regexArray = regex.exec(line)) != null) {
            if (_.every([regexArray[2], regexArray[3], regexArray[4]], el => el !== undefined)) {
                return {
                    fileName: regexArray[2],
                    line: parseInt(regexArray[3]) - 1,
                    column: 0,
                    severity: this.getSeverityCode(regexArray[5]),
                    code: regexArray[6],
                    message: regexArray[7],
                    source: 'PclintPlus',
                };
            } else {
                return {
                    fileName: regexArray[8],
                    line: parseInt(regexArray[9]) - 1,
                    column: 0,
                    severity: this.getSeverityCode(regexArray[11]),
                    code: regexArray[12],
                    message: regexArray[13],
                    source: 'PclintPlus',
                };
            }
        } else {
            return { parseError: 'Line could not be parsed: ' + line };
        }
    }

    private getSeverityCode(severity: string): string {
        return this.settings['c-cpp-flylint'].pclintplus.severityLevels[severity];
    }
}
