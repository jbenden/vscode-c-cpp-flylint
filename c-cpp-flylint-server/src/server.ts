import {
    createConnection,
    Diagnostic,
    DiagnosticSeverity,
    ErrorMessageTracker,
    Files,
    IConnection,
    InitializeError,
    InitializeParams,
    InitializeResult,
    IPCMessageReader,
    IPCMessageWriter,
    ResponseError,
    TextDocument,
    TextDocuments,
} from 'vscode-languageserver';
import { ExecuteCommandParams } from 'vscode-languageserver/lib/protocol';
import Uri from 'vscode-uri';
import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import { Settings } from "./settings";
import { Linter } from "./linters/linter";
import { Flexelint } from './linters/flexelint';
import { CppCheck } from './linters/cppcheck';
import { Clang } from './linters/clang';

// Create a connection for the server. The connection uses Node's IPC as a transport.
const connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager supports full document sync only.
const documents: TextDocuments = new TextDocuments();

// Make the text document manager listen on the connection for open, change, and close text document events.
documents.listen(connection);

let settings: Settings;
let linters: Linter[] = [];

// After the server has started the client sends an initialize request.
// The server receives in the passed params the rootPath of the workspace plus the client capabilities.
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
    let workspaceUri = Uri.parse(params.rootUri!);

    if (workspaceUri.scheme !== 'file') {
        console.log('Workspace root URI is not of the file scheme.');
    } else {
        workspaceRoot = workspaceUri.fsPath;
    }

    let result: InitializeResult = {
        capabilities: {
            textDocumentSync: documents.syncKind,
            executeCommandProvider: {
                commands: [
                    "c-cpp-flylint.analyzeActiveDocument",
                    "c-cpp-flylint.analyzeWorkspace"
                ]
            }
        }
    };

    return result;
});

// The content of a text document has changed.
// This event is emitted when the text document is first opened or when its content has changed.
documents.onDidChangeContent((event) => {
    if (settings['c-cpp-flylint'].run === "onType") {
        validateTextDocument(event.document);
    }
});

documents.onDidSave((event) => {
    if (settings['c-cpp-flylint'].run === "onSave" || settings['c-cpp-flylint'].run === "onType") {
        validateTextDocument(event.document);
    }
});

documents.onDidOpen((event) => {
    validateTextDocument(event.document);
});

// A text document was closed. Clear the diagnostics.
documents.onDidClose((event) => {
    connection.sendDiagnostics({uri: event.document.uri, diagnostics: []});
});

function validateTextDocument(textDocument: TextDocument): void {
    const tracker: ErrorMessageTracker = new ErrorMessageTracker();
    const fileUri: Uri = Uri.parse(textDocument.uri);
    const filePath: string = fileUri.fsPath;

    if (workspaceRoot === undefined ||
        workspaceRoot === null ||
        filePath === undefined ||
        filePath === null)
    {
        // lint can only successfully happen in a workspace, not per-file basis

        console.log("Will not analyze a lone file; must open a folder workspace.");

        return;
    }

    if (fileUri.scheme !== 'file') {
        // lint can only lint files on disk.
        tracker.add(`c-cpp-flylint: A problem was encountered; the document is not locally present on disk.`);

        // Send any exceptions encountered during processing to VSCode.
        tracker.sendErrors(connection);

        return;
    }

    if (linters === undefined || linters === null) {
        // cannot perform lint without active configuration!
        tracker.add(`c-cpp-flylint: A problem was encountered; the global list of analyzers is null or undefined.`);

        // Send any exceptions encountered during processing to VSCode.
        tracker.sendErrors(connection);

        return;
    }

    const documentLines: string[] = textDocument.getText().replace(/\r/g, '').split('\n');

    const diagnostics: Diagnostic[] = [];

    const relativePath = path.relative(workspaceRoot, filePath);

    // deep-copy current items, so mid-stream configuration change doesn't spoil the party
    const lintersCopy : Linter[] = _.cloneDeep(linters);

    console.log('Performing lint scans...');

    lintersCopy.forEach(linter => {
        try {
            const result = linter.lint(filePath as string, workspaceRoot);

            for (const msg of result) {
                if (relativePath === msg['fileName'] || (path.isAbsolute(msg['fileName']) && filePath === msg['fileName'])) {
                    diagnostics.push(makeDiagnostic(documentLines, msg));
                }
            }
        } catch(e) {
            tracker.add(getErrorMessage(e, textDocument));
        }
    });

    console.log('Completed lint scans...');

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({uri: textDocument.uri, diagnostics});

    // Send any exceptions encountered during processing to VSCode.
    tracker.sendErrors(connection);
}

function validateAllTextDocuments(textDocuments: TextDocument[]): void {
    const tracker = new ErrorMessageTracker();

    for (const document of textDocuments) {
        try {
            validateTextDocument(document);
        } catch (err) {
            tracker.add(getErrorMessage(err, document));
        }
    }

    tracker.sendErrors(connection);
}

function makeDiagnostic(documentLines: string[], msg): Diagnostic {
    let severity = DiagnosticSeverity[msg.severity];

    // 0 <= n
    let line;
    if (msg.line) {
        line = msg.line;
    } else {
        line = 0;
    }

    // 0 <= n
    let column;
    if (msg.column) {
        column = msg.column;
    } else {
        column = 0;
    }

    let message;
    if (msg.message) {
        message = msg.message;
    } else {
        message = "Unknown error";
    }

    let code;
    if (msg.code) {
        code = msg.code;
    } else {
        code = undefined;
    }

    let source;
    if (msg.source) {
        source = msg.source;
    } else {
        source = 'c-cpp-flylint';
    }

    let l: string = documentLines[line];
    let startColumn = column;
    let endColumn = column == 0 ? l.length : column + 1;

    if (column === 0) {
        let lineMatches = l.match(/\S/)
        if (lineMatches !== null) {
            startColumn = lineMatches.index;
        }
    }

    return {
        severity: severity,
        range: {
            start: {line: line, character: startColumn},
            end:   {line: line, character: endColumn}
        },
        message: message,
        code: code,
        source: source,
    };
}

function getErrorMessage(err, document: TextDocument): string {
    let errorMessage = "unknown error";

    if (typeof err.message === "string" || err.message instanceof String) {
        errorMessage = (err.message as string);
    }

    const fsPathUri = Uri.parse(document.uri);
    const message = `vscode-c-cpp-flylint: '${errorMessage}' while validating: ${fsPathUri.fsPath}. Please analyze the 'C/C++ FlyLint' Output console. Stacktrace: ${err.stack}`;

    return message;
}

// The settings have changed. Sent on server activation as well.
connection.onDidChangeConfiguration(async (params) => {
    settings = params.settings;

    console.log('Configuration changed. Re-configuring extension.');

    linters = []  // clear array
    linters.push(await (new Clang(settings, workspaceRoot).initialize()) as Clang);
    linters.push(await (new CppCheck(settings, workspaceRoot).initialize()) as CppCheck);
    linters.push(await (new Flexelint(settings, workspaceRoot).initialize()) as Flexelint);

    _.forEach(linters, (linter) => {
        if (linter.isActive() && !linter.isEnabled()) {
            connection.window.showWarningMessage(`Unable to activate ${linter.Name()} analyzer.`);
        }
    });

    // Revalidate any open text documents.
    validateAllTextDocuments(documents.all());
});

connection.onDidChangeWatchedFiles(() => {
    console.log('FS change notification occurred; re-linting all opened documents.')

    validateAllTextDocuments(documents.all());
});

connection.onExecuteCommand((params: ExecuteCommandParams) => {
    const tracker = new ErrorMessageTracker();

    if (params.command === 'c-cpp-flylint.analyzeActiveDocument') {
        (connection.sendRequest('activeTextDocument') as Thenable<TextDocument>)
            .then((activeDocument) => {
                if (activeDocument !== undefined && activeDocument !== null) {
                    let fileUri: Uri = <Uri>(<any>activeDocument.uri);

                    for (const document of documents.all()) {
                        try {
                            const documentUri = Uri.parse(document.uri);

                            if (fileUri.fsPath === documentUri.fsPath) {
                                validateTextDocument(document);
                            }
                        } catch (err) {
                            tracker.add(getErrorMessage(err, document));
                        }
                    }
                }
            });
    } else if (params.command === 'c-cpp-flylint.analyzeWorkspace') {
        validateAllTextDocuments(documents.all());
    }

    tracker.sendErrors(connection);
})

// Listen on the connection.
connection.listen();
