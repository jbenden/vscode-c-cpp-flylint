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
import { ExecuteCommandParams } from 'vscode-languageserver-protocol/lib/protocol';
import Uri from 'vscode-uri';
import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import * as _ from "lodash";
import { Settings, IConfiguration, IConfigurations, propertiesPlatform } from "./settings";
import { Linter, Lint } from "./linters/linter";
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
        validateTextDocument(event.document, Lint.ON_TYPE);
    }
});

documents.onDidSave((event) => {
    if (settings['c-cpp-flylint'].run === "onSave" || settings['c-cpp-flylint'].run === "onType") {
        validateTextDocument(event.document, Lint.ON_SAVE);
    }
});

documents.onDidOpen((event) => {
    validateTextDocument(event.document, Lint.ON_SAVE);
});

function validateTextDocument(textDocument: TextDocument, lintOn: Lint): void {
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
        console.log(`Skipping scan of non-local content at ${fileUri.toString()}`);

        return;
    }

    if (linters === undefined || linters === null) {
        // cannot perform lint without active configuration!
        tracker.add(`c-cpp-flylint: A problem was encountered; the global list of analyzers is null or undefined.`);

        // Send any exceptions encountered during processing to VSCode.
        tracker.sendErrors(connection);

        return;
    }

    var tmpDocument = tmp.fileSync();
    fs.writeSync(tmpDocument.fd, textDocument.getText());

    const documentLines: string[] = textDocument.getText().replace(/\r/g, '').split('\n');

    const allDiagnostics: Map<String, Diagnostic[]> = new Map<String, Diagnostic[]>();

    const relativePath = path.relative(workspaceRoot, filePath);

    // deep-copy current items, so mid-stream configuration change doesn't spoil the party
    const lintersCopy : Linter[] = _.cloneDeep(linters);

    console.log(`Performing lint scan of ${filePath}...`);

    lintersCopy.forEach(linter => {
        if ((linter.lintOn() & lintOn) != 0) {
            try {
                const result = linter.lint(filePath as string, workspaceRoot, tmpDocument.name);

                while (result.length > 0) {
                    let diagnostics: Diagnostic[] = [];
                    let currentFile: string = '';
                    let i = result.length;

                    while (i-- >= 0) {
                        var msg : {} = result[i];

                        if (msg === null || msg === undefined || !msg.hasOwnProperty('line')) {
                            result.splice(i, 1);
                            continue;
                        }

                        if (currentFile === '' && msg.hasOwnProperty('fileName')) {
                            currentFile = msg['fileName'];
                        }

                        if (!msg.hasOwnProperty('fileName') || currentFile !== msg['fileName']) {
                            continue;
                        }

                        if (relativePath === msg['fileName'] || (path.isAbsolute(msg['fileName']) && filePath === msg['fileName'])) {
                            diagnostics.push(makeDiagnostic(documentLines, msg));
                        } else {
                            diagnostics.push(makeDiagnostic(null, msg));
                        }

                        result.splice(i, 1);
                    }

                    diagnostics = _.uniqBy(diagnostics, function (e) { return e.line + ":::" + e.message; } );

                    if (allDiagnostics.hasOwnProperty(currentFile)) {
                        allDiagnostics[currentFile] = _.union(allDiagnostics[currentFile], diagnostics);
                    } else {
                        allDiagnostics[currentFile] = diagnostics;
                    }
                }
            } catch(e) {
                tracker.add(getErrorMessage(e, textDocument));
            }
        } else {
            console.log(`Skipping ${linter.Name()} linter because lintOn ${linter.lintOn()} is not in ${lintOn}.`);
        }
    });

    tmpDocument.removeCallback();

    _.each(allDiagnostics, (diagnostics, currentFile) => {
        connection.sendDiagnostics({uri: 'file://' + currentFile, diagnostics});
    });

    // Remove all previous problem reports, when no further exist
    if (!allDiagnostics.hasOwnProperty(relativePath) && !allDiagnostics.hasOwnProperty(filePath)) {
        connection.sendDiagnostics({uri: 'file://' + filePath, diagnostics: []});
    }

    console.log('Completed lint scans...');

    // Send any exceptions encountered during processing to VSCode.
    tracker.sendErrors(connection);
}

function validateAllTextDocuments(textDocuments: TextDocument[]): void {
    const tracker = new ErrorMessageTracker();

    for (const document of textDocuments) {
        try {
            validateTextDocument(document, Lint.ON_SAVE);
        } catch (err) {
            tracker.add(getErrorMessage(err, document));
        }
    }

    tracker.sendErrors(connection);
}

function makeDiagnostic(documentLines: string[] | null, msg): Diagnostic {
    let severity = DiagnosticSeverity[msg.severity];

    let line;
    if (documentLines !== null) {
        line = _.chain(msg.line)
                .defaultTo(0)
                .clamp(0, documentLines.length - 1)
                .value();
    } else {
        line = msg.line;
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

    let startColumn = column;
    let endColumn = column + 1;

    if (documentLines !== null && column == 0 && documentLines.length > 0) {
        let l: string = _.nth(documentLines, line);

        // Find the line's starting column, sans-white-space
        let lineMatches = l.match(/\S/)
        if (lineMatches !== null) {
            startColumn = lineMatches.index;
        }

        // Set the line's ending column to the full length of line
        endColumn = l.length;
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

async function reconfigureExtension() {
    if (settings === null || settings === undefined) { return; }

    let currentSettings = _.cloneDeep(settings);
    try {
        // Process VS Code `c_cpp_properties.json` file
        const cCppPropertiesPath = path.join(workspaceRoot, '.vscode', 'c_cpp_properties.json');
        if (fs.existsSync(cCppPropertiesPath)) {
            const cCppProperties : IConfigurations = JSON.parse(fs.readFileSync(cCppPropertiesPath, 'utf8'));

            const platformConfig = cCppProperties.configurations.find(el => el.name == propertiesPlatform());
            if (platformConfig !== undefined) {
                // Found a configuration set; populate the currentSettings
                if (currentSettings['c-cpp-flylint'].includePaths.length === 0) {
                    currentSettings['c-cpp-flylint'].includePaths = platformConfig.includePath;
                }

                if (currentSettings['c-cpp-flylint'].defines.length === 0) {
                    currentSettings['c-cpp-flylint'].defines = platformConfig.defines;
                }
            }
        }
    } catch(err) {
        console.log("Could not find or parse the workspace c_cpp_properties.json file; continuing...");
    }

    linters = []  // clear array
    linters.push(await (new Clang(currentSettings, workspaceRoot).initialize()) as Clang);
    linters.push(await (new CppCheck(currentSettings, workspaceRoot).initialize()) as CppCheck);
    linters.push(await (new Flexelint(currentSettings, workspaceRoot).initialize()) as Flexelint);

    _.forEach(linters, (linter) => {
        if (linter.isActive() && !linter.isEnabled()) {
            connection.window.showWarningMessage(`Unable to activate ${linter.Name()} analyzer.`);
        }
    });
}

// The current settings have changed. Sent on server activation as well.
connection.onDidChangeConfiguration(async (params) => {
    settings = params.settings;

    console.log('Configuration changed. Re-configuring extension.');
    await reconfigureExtension();

    // Revalidate any open text documents.
    validateAllTextDocuments(documents.all());
});

connection.onDidChangeWatchedFiles((params) => {
    console.log('FS change notification occurred; re-linting all opened documents.')

    params.changes.forEach(async element => {
        let configFilePath = Uri.parse(element.uri);

        if (path.basename(configFilePath.fsPath) === 'c_cpp_properties.json') {
            await reconfigureExtension();

            validateAllTextDocuments(documents.all());
        }
    });
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
                                validateTextDocument(document, Lint.ON_SAVE);
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
