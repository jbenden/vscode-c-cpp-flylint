import {
    createConnection,
    Diagnostic,
    DiagnosticSeverity,
    ErrorMessageTracker,
    IConnection,
    InitializeResult,
    IPCMessageReader,
    DidChangeConfigurationNotification,
    IPCMessageWriter,
    TextDocument,
    TextDocuments,
    TextDocumentChangeEvent,
} from 'vscode-languageserver';
import { ExecuteCommandParams, WorkspaceFolder } from 'vscode-languageserver-protocol/lib/protocol';
import { URI } from 'vscode-uri';
import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import * as _ from "lodash";
import * as glob from 'fast-glob';
import { Settings, IConfigurations, propertiesPlatform } from './settings';
import { Linter, Lint, toLint } from "./linters/linter";

import { Clang } from './linters/clang';
import { CppCheck } from './linters/cppcheck';
import { FlawFinder } from './linters/flawfinder';
import { Flexelint } from './linters/flexelint';
import { PclintPlus } from './linters/pclintplus';

const substituteVariables = require('var-expansion').substituteVariables; // no types available

// Create a connection for the server. The connection uses Node's IPC as a transport.
const connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager supports full document sync only.
const documents: TextDocuments = new TextDocuments();

// Does the LS client support the configuration abilities?
let hasConfigurationCapability = false;

let defaultSettings: Settings;
let globalSettings: Settings;

// A mapping between an opened document and its' workspace settings.
let documentSettings: Map<string, Thenable<Settings>> = new Map();

// A mapping between an opened document and its' configured analyzers.
let documentLinters: Map<string, Thenable<Linter[]>> = new Map();

// A mapping between an opened document and its' configured analyzers.
let documentVersions: Map<string, number> = new Map();

export type InternalDiagnostic = { severity: DiagnosticSeverity, line: number, column: number, message: string, code: undefined | number | string, source: string, parseError?: any, fileName: string };

// Clear the entire contents of TextDocument related caches.
function flushCache() {
    documentLinters.clear();
    documentSettings.clear();
    documentVersions.clear();
}

// After the server has started the client sends an initialize request.
connection.onInitialize((params): InitializeResult => {
    let capabilities = params.capabilities;

    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);

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

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(
            DidChangeConfigurationNotification.type,
            undefined
        );
    }
});

let didStart = false;

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        flushCache();
    } else {
        globalSettings = <Settings>(change.settings['c-cpp-flylint'] || defaultSettings);
    }

    // Revalidate all open text documents
    if (didStart) documents.all().forEach(_.bind(validateTextDocument, this, _, Lint.ON_SAVE, false));
});

connection.onNotification("onBuild", (params: any) => {
    console.log("Received a notification that a build has completed: " + _.toString(params));

    // Revalidate all open text documents
    if (didStart) documents.all().forEach(_.bind(validateTextDocument, this, _, Lint.ON_BUILD, false));
});

async function getWorkspaceRoot(resource: string): Promise<string> {
    const resourceUri: URI = URI.parse(resource);
    const resourceFsPath: string = resourceUri.fsPath;

    let folders: WorkspaceFolder[] | null = await connection.workspace.getWorkspaceFolders();
    let result: string = "";

    if (folders !== null) {
        // sort folders by length, decending.
        folders = folders.sort((a: WorkspaceFolder, b: WorkspaceFolder): number => {
            return a.uri == b.uri ? 0 : (a.uri.length <= b.uri.length ? 1 : -1);
        });

        // look for a matching workspace folder root.
        folders.forEach(f => {
            const folderUri: URI = URI.parse(f.uri);
            const folderFsPath: string = folderUri.fsPath;

            // does the resource path start with this folder path?
            if (path.normalize(resourceFsPath).startsWith(path.normalize(folderFsPath))) {
                // found the project root for this file.
                result = path.normalize(folderFsPath);
            }
        });
    } else {
        // No matching workspace folder, so return the folder the file lives in.
        result = path.dirname(path.normalize(resourceFsPath));
    }

    return result;
}

function getDocumentSettings(resource: string): Thenable<Settings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({ scopeUri: resource });
        documentSettings.set(resource, result);
    }
    return result;
}

async function reconfigureExtension(settings: Settings, workspaceRoot: string): Promise<Linter[]> {
    let currentSettings = getMergedSettings(settings, workspaceRoot);

    let linters: Linter[] = []  // clear array

    if (currentSettings['c-cpp-flylint'].clang.enable)
        linters.push(await (new Clang(currentSettings, workspaceRoot).initialize()) as Clang);
    if (currentSettings['c-cpp-flylint'].cppcheck.enable)
        linters.push(await (new CppCheck(currentSettings, workspaceRoot).initialize()) as CppCheck);
    if (currentSettings['c-cpp-flylint'].flexelint.enable)
        linters.push(await (new Flexelint(currentSettings, workspaceRoot).initialize()) as Flexelint);
    if (currentSettings['c-cpp-flylint'].pclintplus.enable)
        linters.push(await (new PclintPlus(currentSettings, workspaceRoot).initialize()) as PclintPlus);
    if (currentSettings['c-cpp-flylint'].flawfinder.enable)
        linters.push(await (new FlawFinder(currentSettings, workspaceRoot).initialize()) as FlawFinder);

    _.forEach(linters, (linter) => {
        if (linter.isActive() && !linter.isEnabled()) {
            connection.window.showWarningMessage(`Unable to activate ${linter.Name()} analyzer.`);
        }
    });

    return linters;
}

export function getCppProperties(cCppPropertiesPath: string, currentSettings: Settings, workspaceRoot: string) {
    try {
        if (fs.existsSync(cCppPropertiesPath)) {
            const cCppProperties: IConfigurations = JSON.parse(fs.readFileSync(cCppPropertiesPath, 'utf8'));
            const platformConfig = cCppProperties.configurations.find(el => el.name == propertiesPlatform());

            if (platformConfig !== undefined) {
                // Found a configuration set; populate the currentSettings
                if (currentSettings['c-cpp-flylint'].includePaths.length === 0) {
                    currentSettings['c-cpp-flylint'].includePaths = [];
                    process.env.workspaceRoot = workspaceRoot;
                    process.env.workspaceFolder = workspaceRoot;

                    _.forEach(platformConfig.includePath, (ipath: string) => {
                        try {
                            let { value } = substituteVariables(ipath, { env: process.env });
                            let globbed_path = glob.sync(value, { cwd: workspaceRoot, dot: true, onlyDirectories: true, unique: true, absolute: true });

                            if (currentSettings['c-cpp-flylint'].debug) {
                                console.log("Path: " + ipath + "  VALUE: " + value + "  Globbed is: " + globbed_path.toString());
                            }

                            _.each(globbed_path, (gpath: string) => {
                                var currentFilePath = path.resolve(gpath).replace(/\\/g, '/');

                                if (path.normalize(currentFilePath).startsWith(path.normalize(workspaceRoot!))) {
                                    var acceptFile: boolean = true;

                                    // see if we are to accept the diagnostics upon this file.
                                    _.each(currentSettings['c-cpp-flylint'].excludeFromWorkspacePaths, (excludedPath) => {
                                        var normalizedExcludedPath = path.normalize(excludedPath);

                                        if (!path.isAbsolute(normalizedExcludedPath)) {
                                            // prepend the workspace path and renormalize the path.
                                            normalizedExcludedPath = path.normalize(path.join(workspaceRoot!, normalizedExcludedPath));
                                        }

                                        // does the document match our excluded path?
                                        if (path.normalize(currentFilePath).startsWith(normalizedExcludedPath)) {
                                            // it did; so do not accept diagnostics from this file.
                                            acceptFile = false;
                                        }
                                    });

                                    if (acceptFile) {
                                        // Windows drive letter must be prefixed with a slash
                                        if (currentFilePath[0] !== '/') {
                                            currentFilePath = '/' + currentFilePath;
                                        }

                                        if (currentSettings['c-cpp-flylint'].debug) {
                                            console.log("Adding path: " + currentFilePath);
                                        }

                                        currentSettings['c-cpp-flylint'].includePaths =
                                            currentSettings['c-cpp-flylint'].includePaths.concat(currentFilePath);
                                    }
                                } else {
                                    // file is outside of workspace root, perhaps a system folder
                                    // Windows drive letter must be prefixed with a slash
                                    if (currentFilePath[0] !== '/') {
                                        currentFilePath = '/' + currentFilePath;
                                    }

                                    if (currentSettings['c-cpp-flylint'].debug) {
                                        console.log("Adding system path: " + currentFilePath);
                                    }

                                    currentSettings['c-cpp-flylint'].includePaths =
                                        currentSettings['c-cpp-flylint'].includePaths.concat(currentFilePath);
                                }
                            });
                        }
                        catch (err) {
                            console.log(err);
                        }
                    });
                }
                if (currentSettings['c-cpp-flylint'].defines.length === 0) {
                    currentSettings['c-cpp-flylint'].defines = platformConfig.defines;
                }
            }
        }
    }
    catch (err) {
        console.log("Could not find or parse the workspace c_cpp_properties.json file; continuing...");
    }

    return currentSettings;
}

function getMergedSettings(settings: Settings, workspaceRoot: string) {
    let currentSettings = _.cloneDeep(settings);
    const cCppPropertiesPath = path.join(workspaceRoot, '.vscode', 'c_cpp_properties.json');

    return getCppProperties(cCppPropertiesPath, currentSettings, workspaceRoot);
}

async function getDocumentLinters(resource: string): Promise<Linter[]> {
    const settings: Settings = await getDocumentSettings(resource);

    let result = documentLinters.get(resource);
    if (!result) {
        const workspaceRoot: string = await getWorkspaceRoot(resource);

        result = Promise.resolve(await reconfigureExtension(settings, workspaceRoot));
        documentLinters.set(resource, result);
    }

    return result!;
}

// Only keep analyzers and settings for opened documents.
documents.onDidClose(e => {
    documentLinters.delete(e.document.uri);
    documentSettings.delete(e.document.uri);
    documentVersions.delete(e.document.uri);
})

function onChangedContent(event: TextDocumentChangeEvent): any {
    if (didStart) {
        validateTextDocument(event.document, Lint.ON_TYPE, false);
    }
}

documents.onDidChangeContent(_.debounce(onChangedContent, 250));

documents.onDidSave(async (event: TextDocumentChangeEvent) => {
    validateTextDocument(event.document, Lint.ON_SAVE, false);
});

documents.onDidOpen(async (event: TextDocumentChangeEvent) => {
    validateTextDocument(event.document, Lint.ON_SAVE, false);

    didStart = true;
});

async function validateTextDocument(textDocument: TextDocument, lintOn: Lint, force: boolean) {
    const tracker: ErrorMessageTracker = new ErrorMessageTracker();
    const fileUri: URI = URI.parse(textDocument.uri);
    const filePath: string = fileUri.fsPath;
    const workspaceRoot: string = await getWorkspaceRoot(textDocument.uri);

    if (workspaceRoot === undefined ||
        workspaceRoot === null ||
        filePath === undefined ||
        filePath === null) {
        // lint can only successfully happen in a workspace, not per-file basis
        console.log("Will not analyze a lone file; must open a folder workspace.");
        return;
    }

    if (fileUri.scheme !== 'file') {
        // lint can only lint files on disk.
        console.log(`Skipping scan of non-local content at ${fileUri.toString()}`);
        return;
    }

    // get the settings for the current file.
    let settings = await getDocumentSettings(textDocument.uri);

    // get the linters for the current file.
    let linters = await getDocumentLinters(textDocument.uri);

    if (linters === undefined || linters === null) {
        // cannot perform lint without active configuration!
        tracker.add(`c-cpp-flylint: A problem was encountered; the global list of analyzers is null or undefined.`);

        // Send any exceptions encountered during processing to VSCode.
        tracker.sendErrors(connection);

        return;
    }

    // check document version number
    let documentVersion = textDocument.version;
    let lastVersion = documentVersions.get(textDocument.uri);
    if (lastVersion) {
        if (settings['c-cpp-flylint'].debug) {
            console.log(`${filePath} is currently version number ${documentVersion} and ${lastVersion} was already been scanned.`);
        }

        if (documentVersion <= lastVersion && !force) {
            if (settings['c-cpp-flylint'].debug) {
                console.log(`Skipping scan of ${filePath} because this file version number ${documentVersion} has already been scanned.`);
            }

            return;
        }
    }

    if (settings['c-cpp-flylint'].debug) {
        console.log(`${filePath} force = ${force}.`);
        console.log(`${filePath} is now at version number ${documentVersion}.`);
    }

    var tmpDocument = tmp.fileSync();
    fs.writeSync(tmpDocument.fd, textDocument.getText());

    const documentLines: string[] = textDocument.getText().replace(/\r/g, '').split('\n');

    const allDiagnostics: Map<String, Diagnostic[]> = new Map<String, Diagnostic[]>();

    const relativePath = path.relative(workspaceRoot, filePath);

    // deep-copy current items, so mid-stream configuration change doesn't spoil the party
    const lintersCopy: Linter[] = _.cloneDeep(linters);

    console.log(`Performing lint scan of ${filePath}...`);

    const userLintOn: Lint = toLint(settings['c-cpp-flylint'].run);

    var hasSkipLinter = false;

    lintersCopy.forEach(linter => {
        if (userLintOn === lintOn && userLintOn in linter.lintOn()) {
            try {
                let result = linter.lint(filePath as string, workspaceRoot, tmpDocument.name);

                while (result.length > 0) {
                    let diagnostics: Diagnostic[] = [];
                    let currentFile: string = '';
                    let i = result.length;

                    while (i-- >= 0) {
                        var msg: InternalDiagnostic = result[i];

                        if (msg === null || msg === undefined || msg.parseError || !msg.hasOwnProperty('line') || msg.source === '') {
                            result.splice(i, 1);
                            continue;
                        }

                        if (currentFile === '') {
                            currentFile = msg.fileName;
                        }

                        if (currentFile !== msg.fileName) {
                            continue;
                        }

                        if (relativePath === msg.fileName || (path.isAbsolute(msg.fileName) && filePath === msg.fileName)) {
                            diagnostics.push(makeDiagnostic(documentLines, msg));
                        } else {
                            diagnostics.push(makeDiagnostic(null, msg));
                        }

                        result.splice(i, 1);
                    }

                    diagnostics = _.uniqBy(diagnostics, function(e) { return e.range.start.line + ":::" + e.code + ":::" + e.message; });

                    if (allDiagnostics.has(currentFile)) {
                        allDiagnostics.set(currentFile, _.union(allDiagnostics.get(currentFile), diagnostics));
                    } else {
                        allDiagnostics.set(currentFile, diagnostics);
                    }
                }
            } catch (e) {
                tracker.add(getErrorMessage(e, textDocument));
            }
        } else {
            hasSkipLinter = true;
            console.log(`Skipping ${linter.Name()} linter because lintOn ${lintOn.toString()} is not in ${linter.lintOn().toString()}.`);
        }
    });

    tmpDocument.removeCallback();

    let sendDiagnosticsToEditor = (diagnostics: Diagnostic[], currentFile: string) => {
        var currentFilePath = path.resolve(currentFile).replace(/\\/g, '/');

        if (path.normalize(currentFilePath).startsWith(path.normalize(workspaceRoot!))) {
            var acceptFile: boolean = true;

            // see if we are to accept the diagnostics upon this file.
            _.each(settings['c-cpp-flylint'].excludeFromWorkspacePaths, (excludedPath) => {
                var normalizedExcludedPath = path.normalize(excludedPath);

                if (!path.isAbsolute(normalizedExcludedPath)) {
                    // prepend the workspace path and renormalize the path.
                    normalizedExcludedPath = path.normalize(path.join(workspaceRoot!, normalizedExcludedPath));
                }

                // does the document match our excluded path?
                if (path.normalize(currentFilePath).startsWith(normalizedExcludedPath)) {
                    // it did; so do not accept diagnostics from this file.
                    acceptFile = false;
                }
            });

            if (acceptFile) {
                // Windows drive letter must be prefixed with a slash
                if (currentFilePath[0] !== '/') {
                    currentFilePath = '/' + currentFilePath;
                }

                connection.sendDiagnostics({ uri: 'file://' + currentFilePath, diagnostics: [] });
                connection.sendDiagnostics({ uri: 'file://' + currentFilePath, diagnostics });
            }
        }
    };

    // Send diagnostics to VSCode
    for (let diagnosticEntry of allDiagnostics) {
        let [fileName, fileDiagnostics] = diagnosticEntry;

        sendDiagnosticsToEditor(fileDiagnostics, fileName.toString());
    }

    // Remove all previous problem reports, when no further exist
    if (!allDiagnostics.has(relativePath) && !allDiagnostics.has(filePath)) {
        let currentFilePath = path.resolve(filePath).replace(/\\/g, '/');
        // Windows drive letter must be prefixed with a slash
        if (currentFilePath[0] !== '/') {
            currentFilePath = '/' + currentFilePath;
        }

        connection.sendDiagnostics({ uri: 'file://' + currentFilePath, diagnostics: [] });
    }

    console.log('Completed lint scans...');

    if (!hasSkipLinter) {
        documentVersions.set(textDocument.uri, textDocument.version);
    }
    // Send any exceptions encountered during processing to VSCode.
    tracker.sendErrors(connection);
}

function makeDiagnostic(documentLines: string[] | null, msg: InternalDiagnostic): Diagnostic {
    let severity = DiagnosticSeverity[msg.severity];

    let line: number;
    if (documentLines !== null) {
        line = _.chain(msg.line)
            .defaultTo(0)
            .clamp(0, documentLines.length - 1)
            .value();
    } else {
        line = msg.line;
    }

    // 0 <= n
    let column: number;
    if (msg.column) {
        column = msg.column;
    } else {
        column = 0;
    }

    let message: string;
    if (msg.message) {
        message = msg.message;
    } else {
        message = "Unknown error";
    }

    let code: undefined | number | string;
    if (msg.code) {
        code = msg.code;
    } else {
        code = undefined;
    }

    let source: string;
    if (msg.source) {
        source = msg.source;
    } else {
        source = 'c-cpp-flylint';
    }

    let startColumn: number = column;
    let endColumn: number = column + 1;

    if (documentLines !== null && column == 0 && documentLines.length > 0) {
        let l: string = _.nth(documentLines, line) as string;

        // Find the line's starting column, sans-white-space
        let lineMatches = l.match(/\S/)
        if (!_.isNull(lineMatches) && _.isNumber(lineMatches.index)) {
            startColumn = lineMatches.index;
        }

        // Set the line's ending column to the full length of line
        endColumn = l.length;
    }

    return {
        severity: severity,
        range: {
            start: { line: line, character: startColumn },
            end: { line: line, character: endColumn }
        },
        message: message,
        code: code,
        source: source,
    };
}

function getErrorMessage(err: Error, document: TextDocument): string {
    let errorMessage = "unknown error";

    if (_.isString(err.message)) {
        errorMessage = (err.message as string);
    }

    const fsPathUri = URI.parse(document.uri);
    const message = `vscode-c-cpp-flylint: '${errorMessage}' while validating: ${fsPathUri.fsPath}. Please analyze the 'C/C++ FlyLint' Output console. Stacktrace: ${err.stack}`;

    return message;
}

connection.onDidChangeWatchedFiles((params) => {
    console.log('FS change notification occurred; re-linting all opened documents.')

    params.changes.forEach(async element => {
        let configFilePath = URI.parse(element.uri);

        if (path.basename(configFilePath.fsPath) === 'c_cpp_properties.json') {
            flushCache();

            if (didStart) documents.all().forEach(_.bind(validateTextDocument, this, _, Lint.ON_SAVE, true));
        }
    });
});

connection.onExecuteCommand((params: ExecuteCommandParams) => {
    const tracker = new ErrorMessageTracker();

    if (params.command === 'c-cpp-flylint.analyzeActiveDocument') {
        (connection.sendRequest('activeTextDocument') as Thenable<TextDocument>)
            .then((activeDocument) => {
                if (activeDocument !== undefined && activeDocument !== null) {
                    let fileUri: URI = <URI>(<any>activeDocument.uri);

                    for (const document of documents.all()) {
                        try {
                            const documentUri = URI.parse(document.uri);

                            if (fileUri.fsPath === documentUri.fsPath) {
                                validateTextDocument(document, Lint.ON_SAVE, true);
                            }
                        } catch (err) {
                            tracker.add(getErrorMessage(err, document));
                        }
                    }
                }
            });
    } else if (params.command === 'c-cpp-flylint.analyzeWorkspace') {
        documents.all().forEach(_.bind(validateTextDocument, this, _, Lint.ON_SAVE, true));
    }

    tracker.sendErrors(connection);
})

// Make the text document manager listen on the connection for open, change, and close text document events.
documents.listen(connection);

// Listen on the connection.
connection.listen();
