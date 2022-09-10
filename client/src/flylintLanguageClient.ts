import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import * as ls from 'vscode-languageserver';
import * as code from 'vscode';

export class FlylintLanguageClient extends LanguageClient {
    constructor(
        id: string,
        name: string,
        serverOptions: ServerOptions,
        clientOptions: LanguageClientOptions,
        queryUrlStr: string,
        matchSet: string[],
        forceDebug?: boolean
    ) {
        super(id, name, serverOptions, clientOptions, forceDebug);
        let originalAsDiagnostic = this.protocol2CodeConverter.asDiagnostic;
        this.protocol2CodeConverter.asDiagnostic = ((diagnostic: ls.Diagnostic): code.Diagnostic => {
            let result = originalAsDiagnostic(diagnostic);
            if ((result.code !== undefined) && (typeof result.code === 'string') && (queryUrlStr.length > 0)) {
                let codeStr = String(result.code);
                if (matchSet.some(v => codeStr.includes(v))) {
                    result.code = {
                        value: result.code,
                        target: this.protocol2CodeConverter.asUri(`${queryUrlStr}${result.source}%20${result.code}`)
                    };
                }
            }
            return result;
        });
        this.protocol2CodeConverter.asDiagnostics = ((diagnostics: ls.Diagnostic[]): code.Diagnostic[] => {
            return diagnostics.map(this.protocol2CodeConverter.asDiagnostic);
        });
    }
}
