// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT

import {
    Connection,
    createConnection,
    Diagnostic,
    DiagnosticSeverity,
    ErrorMessageTracker,
    InitializeResult,
    IPCMessageReader,
    DidChangeConfigurationNotification,
    IPCMessageWriter,
    TextDocuments,
    TextDocumentChangeEvent,
    TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';
import { ExecuteCommandParams, WorkspaceFolder } from 'vscode-languageclient/node';
import { URI } from 'vscode-uri';
import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';
import * as _ from 'lodash';
import * as glob from 'fast-glob';
import { EntryItem } from 'fast-glob/out/types';
import { GlobalSettings, Settings, IConfigurations, propertiesPlatform } from './settings';
import { Linter, Lint, fromLint, toLint } from './linters/linter';
import { RobustPromises, path as sysPath } from './utils';

import { Clang } from './linters/clang';
import { CppCheck } from './linters/cppcheck';
import { FlawFinder } from './linters/flawfinder';
import { Flexelint } from './linters/flexelint';
import { PclintPlus } from './linters/pclintplus';
import { Lizard } from './linters/lizard';

const JSON5Module = require('json5');
const JSON5 = JSON5Module.default || JSON5Module;

/** Identifier that is used to associate diagnostic entries with code actions. */
export const FLYLINT_ID = 'c-cpp-flylint';

/** Code that is used to associate diagnostic entries with code actions. */
export const FLYLINT_MATCH = /c-cpp-flylint/;

const substituteVariables = require('var-expansion').substituteVariables; // no types available

// Create a connection for the server. The connection uses Node's IPC as a transport.
const connection: Connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Create a simple text document manager. The text document manager supports full document sync only.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Does the LS client support the configuration abilities?
let hasConfigurationCapability = false;

// Does the LS client use the Microsoft C/C++ extension?
let hasMsCppTools = true;

let defaultSettings: Settings;
let globalSettings: Settings;

// A mapping between an opened document and its' workspace settings.
let documentSettings: Map<string, Thenable<Settings>> = new Map();

// A mapping between an opened document and its' configured analyzers.
let documentLinters: Map<string, Thenable<Linter[]>> = new Map();

// A mapping between an opened document and its' configured analyzers.
let documentVersions: Map<string, number> = new Map();

export type InternalDiagnostic = { severity: DiagnosticSeverity, line: number, column: number, message: string, code: undefined | number | string, source: string, parseError?: any, fileName: string };

namespace CommandIds {
    export const analyzeActiveDocument: string = 'c-cpp-flylint.analyzeActiveDocument';
    export const analyzeWorkspace: string = 'c-cpp-flylint.analyzeWorkspace';
}

// Clear the entire contents of TextDocument related caches.
/* istanbul ignore next */
function flushCache() {
    documentLinters.clear();
    documentSettings.clear();
    documentVersions.clear();
}

// After the server has started the client sends an initialize request.
/* istanbul ignore next */
connection.onInitialize((params): InitializeResult => {
    let capabilities = params.capabilities;

    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);

    return {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: TextDocumentSyncKind.Full,
                willSaveWaitUntil: false,
                save: {
                    includeText: false
                }
            },
            workspace: {
                workspaceFolders: {
                    supported: true
                }
            },
            executeCommandProvider: {
                commands: [
                    CommandIds.analyzeActiveDocument,
                    CommandIds.analyzeWorkspace,
                ]
            }
        }
    };
});

/* istanbul ignore next */
connection.onInitialized(async () => {
    if (hasConfigurationCapability) {
        await connection.client.register(
            DidChangeConfigurationNotification.type,
            undefined
        );
    }
});

let didStart = false;

/* istanbul ignore next */
connection.onDidChangeConfiguration(async change => {
    if (hasConfigurationCapability) {
        flushCache();
    } else {
        globalSettings = <Settings>(change.settings[FLYLINT_ID] || defaultSettings);
    }

    await validateAllDocuments({ force: false });
});

/* istanbul ignore next */
connection.onNotification('begin', async (_params: any) => {
    didStart = true;

    // validateTextDocument(params.document ?? null, false);
    await validateAllDocuments({ force: false });
});

/* istanbul ignore next */
connection.onNotification('end', () => {
    didStart = false;
});

/* istanbul ignore next */
connection.onNotification('onBuild', async (params: any) => {
    // eslint-disable-next-line no-console
    console.log('Received a notification that a build has completed: ' + _.toString(params));

    let settings = await getDocumentSettings(params.document ?? null);

    const userLintOn: Lint = toLint(settings.run);
    if (userLintOn !== Lint.ON_BUILD) {
        // eslint-disable-next-line no-console
        console.log(`Skipping analysis because ${fromLint(userLintOn)} !== ON_BUILD.`);
        return;
    }

    await validateAllDocuments({ force: false });
});

/* istanbul ignore next */
async function getWorkspaceRoot(resource: string): Promise<string> {
    const resourceUri: URI = URI.parse(resource);
    const resourceFsPath: string = resourceUri.fsPath;

    let folders: WorkspaceFolder[] | null = await connection.workspace.getWorkspaceFolders();
    let result: string = '';

    if (folders !== null) {
        // sort folders by length, decending.
        folders = folders.sort((a: WorkspaceFolder, b: WorkspaceFolder): number => {
            return a.uri === b.uri ? 0 : (a.uri.length <= b.uri.length ? 1 : -1);
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

/* istanbul ignore next */
async function getDocumentSettings(resource: string): Promise<Settings> {
    /* istanbul ignore next */
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }

    let result: Thenable<Settings> | undefined = documentSettings.get(resource);
    if (!result) {
        let workspaceRoot: string = await getWorkspaceRoot(resource);
        let globalSettings: Thenable<GlobalSettings> = connection.workspace.getConfiguration({ scopeUri: resource }).then(s => getMergedSettings(s, workspaceRoot));
        result = globalSettings.then(v => v[FLYLINT_ID]);
        documentSettings.set(resource, result);
    }

    return result!;
}

/* istanbul ignore next */
async function reconfigureExtension(currentSettings: Settings, workspaceRoot: string): Promise<Linter[]> {
    let linters: Linter[] = [];  // clear array

    if (currentSettings.clang.enable) { linters.push(await (new Clang(currentSettings, workspaceRoot).initialize()) as Clang); }
    if (currentSettings.cppcheck.enable) { linters.push(await (new CppCheck(currentSettings, workspaceRoot).initialize()) as CppCheck); }
    if (currentSettings.flexelint.enable) { linters.push(await (new Flexelint(currentSettings, workspaceRoot).initialize()) as Flexelint); }
    if (currentSettings.pclintplus.enable) { linters.push(await (new PclintPlus(currentSettings, workspaceRoot).initialize()) as PclintPlus); }
    if (currentSettings.flawfinder.enable) { linters.push(await (new FlawFinder(currentSettings, workspaceRoot).initialize()) as FlawFinder); }
    if (currentSettings.lizard.enable) { linters.push(await (new Lizard(currentSettings, workspaceRoot).initialize()) as Lizard); }

    _.forEach(linters, (linter) => {
        if (linter.isActive() && !linter.isEnabled()) {
            connection.window.showWarningMessage(`Unable to activate ${linter.Name()} analyzer.`);
        }
    });

    return linters;
}

/* istanbul ignore next */
export async function getCppProperties(cCppPropertiesPath: string, currentSettings: GlobalSettings, workspaceRoot: string) {
    try {
        if (fs.existsSync(cCppPropertiesPath)) {
            const matchOn: string = await getActiveConfigurationName(currentSettings[FLYLINT_ID]);
            const cCppProperties: IConfigurations = JSON5.parse(fs.readFileSync(cCppPropertiesPath, 'utf8'));
            const platformConfig = cCppProperties.configurations.find(el => el.name === matchOn);

            if (platformConfig !== undefined) {
                // Found a configuration set; populate the currentSettings
                if (platformConfig.includePath.length > 0) {
                    process.env.workspaceRoot = workspaceRoot;
                    process.env.workspaceFolder = workspaceRoot;

                    _.forEach(platformConfig.includePath, (ipath: string) => {
                        //skip empty paths
                        if (ipath === '') {
                            return;
                        }
                        try {
                            let { value } = substituteVariables(ipath, { env: process.env });
                            let globbed_path = glob.sync(value, { cwd: workspaceRoot, dot: false, onlyDirectories: true, unique: true, absolute: true });

                            if (currentSettings[FLYLINT_ID].debug) {
                                // eslint-disable-next-line no-console
                                console.log('Path: ' + ipath + '  VALUE: ' + value + '  Globbed is: ' + globbed_path.toString());
                            }

                            _.each(globbed_path, (gpath: string | EntryItem) => {
                                let currentFilePath = sysPath(path.resolve(gpath as string));

                                if (path.normalize(currentFilePath).startsWith(path.normalize(workspaceRoot!))) {
                                    let acceptFile: boolean = true;

                                    // see if we are to accept the diagnostics upon this file.
                                    _.each(currentSettings[FLYLINT_ID].excludeFromWorkspacePaths, (excludedPath: string) => {
                                        let substExcludedPath = substituteVariables(excludedPath, { env: process.env, ignoreErrors: true });
                                        let normalizedExcludedPath = path.normalize(substExcludedPath.value || '');

                                        if (currentSettings[FLYLINT_ID].debug) {
                                            // eslint-disable-next-line no-console
                                            console.log('Exclude Path: ' + excludedPath + '  VALUE: ' + substExcludedPath.value + '  Normalized: ' + normalizedExcludedPath);
                                        }

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
                                        if (currentSettings[FLYLINT_ID].debug) {
                                            // eslint-disable-next-line no-console
                                            console.log('Adding path: ' + currentFilePath);
                                        }

                                        currentSettings[FLYLINT_ID].includePaths =
                                            _.uniq(currentSettings[FLYLINT_ID].includePaths.concat(currentFilePath));
                                    }
                                } else {
                                    // file is outside of workspace root, perhaps a system folder
                                    if (currentSettings[FLYLINT_ID].debug) {
                                        // eslint-disable-next-line no-console
                                        console.log('Adding system path: ' + currentFilePath);
                                    }

                                    currentSettings[FLYLINT_ID].includePaths =
                                        _.uniq(currentSettings[FLYLINT_ID].includePaths.concat(currentFilePath));
                                }
                            });
                        }
                        catch (err) {
                            // eslint-disable-next-line no-console
                            console.error(err);
                        }
                    });
                }

                if (platformConfig.defines.length > 0) {
                    currentSettings[FLYLINT_ID].defines =
                        _.uniq(currentSettings[FLYLINT_ID].defines.concat(platformConfig.defines));
                }
            }
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.log('Could not find or parse the workspace c_cpp_properties.json file; continuing...');
        // eslint-disable-next-line no-console
        console.error(err);
    }

    return currentSettings;
}

/* istanbul ignore next */
async function getActiveConfigurationName(_currentSettings: Settings): Promise<string> {
    if (!hasMsCppTools) return Promise.resolve(propertiesPlatform());

    return RobustPromises.retry(40, 250, 1000, () => connection.sendRequest<string>('c-cpp-flylint.cpptools.activeConfigName')).then(r => {
        if (!_.isArrayLike(r) || r.length === 0) { return propertiesPlatform(); } else { return r; }
    }).catch(_e => {
        hasMsCppTools = false;
        return propertiesPlatform();
    });
}

/* istanbul ignore next */
function getMergedSettings(settings: GlobalSettings, workspaceRoot: string): Promise<GlobalSettings> {
    let currentSettings = _.cloneDeep(settings);
    const cCppPropertiesPath = path.join(workspaceRoot, '.vscode', 'c_cpp_properties.json');

    return getCppProperties(cCppPropertiesPath, currentSettings, workspaceRoot);
}

/* istanbul ignore next */
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
/* istanbul ignore next */
documents.onDidClose(e => {
    documentLinters.delete(e.document.uri);
    documentSettings.delete(e.document.uri);
    documentVersions.delete(e.document.uri);
    connection.sendDiagnostics({uri: e.document.uri, diagnostics: []});
});

/* istanbul ignore next */
async function onChangedContent(event: TextDocumentChangeEvent<TextDocument>): Promise<any> {
    if (didStart) {
        // get the settings for the current file.
        let settings = await getDocumentSettings(event.document.uri);

        const userLintOn: Lint = toLint(settings.run);
        if (userLintOn !== Lint.ON_TYPE) {
            // eslint-disable-next-line no-console
            console.log(`Skipping analysis because ${fromLint(userLintOn)} !== ON_TYPE.`);
            return;
        }

        await validateTextDocument(event.document, false);
    }
}

// FIXME: 1500 should be a configurable property!
documents.onDidChangeContent(_.debounce(onChangedContent, 1500));

/* istanbul ignore next */
documents.onDidSave(async (event: TextDocumentChangeEvent<TextDocument>) => {
    // get the settings for the current file.
    let settings = await getDocumentSettings(event.document.uri);

    const userLintOn: Lint = toLint(settings.run);
    if (userLintOn !== Lint.ON_SAVE && userLintOn !== Lint.ON_TYPE) {
        // eslint-disable-next-line no-console
        console.log(`Skipping analysis because ${fromLint(userLintOn)} !== ON_SAVE|ON_TYPE.`);
        return;
    }

    await validateTextDocument(event.document, false);
});

/* istanbul ignore next */
documents.onDidOpen(async (event: TextDocumentChangeEvent<TextDocument>) => {
    if (didStart) {
        await validateTextDocument(event.document, false);
    }
});

/* istanbul ignore next */
async function validateAllDocuments(options: { force: boolean }) {
    const { force } = options || {};

    if (didStart) {
        documents.all().forEach(_.bind(validateTextDocument, _, _, force));
    }
}

/* istanbul ignore next */
async function validateTextDocument(textDocument: TextDocument, force: boolean) {
    const tracker: ErrorMessageTracker = new ErrorMessageTracker();
    const fileUri: URI = URI.parse(textDocument.uri);
    const filePath: string = fileUri.fsPath;
    const normalizedFilePath = sysPath(path.normalize(filePath as string));
    const workspaceRoot: string = await getWorkspaceRoot(textDocument.uri);

    const isTrusted: boolean = await connection.sendRequest('isTrusted');
    if (!isTrusted) {
        // eslint-disable-next-line no-console
        console.log('Will not analyze an untrusted workspace.');
        return;
    }

    if (workspaceRoot === undefined ||
        workspaceRoot === null ||
        filePath === undefined ||
        filePath === null) {
        // lint can only successfully happen in a workspace, not per-file basis
        // eslint-disable-next-line no-console
        console.log('Will not analyze a lone file; must open a folder workspace.');
        return;
    }

    if (fileUri.scheme !== 'file') {
        // lint can only lint files on disk.
        // eslint-disable-next-line no-console
        console.log(`Skipping scan of non-local content at ${fileUri.toString()}`);
        return;
    }

    // get the settings for the current file.
    let settings = await getDocumentSettings(textDocument.uri);

    // get the linters for the current file.
    let linters = await getDocumentLinters(textDocument.uri);
    if (linters === undefined || linters === null) {
        // cannot perform lint without active configuration!
        tracker.add(`A problem was encountered; the global list of analyzers is null or undefined.`);

        // Send any exceptions encountered during processing to VSCode.
        tracker.sendErrors(connection);

        return;
    }

    // check document version number
    let documentVersion = textDocument.version;
    let lastVersion = documentVersions.get(textDocument.uri);
    if (lastVersion) {
        if (settings.debug) {
            // eslint-disable-next-line no-console
            console.log(`${filePath} is currently version number ${documentVersion} and ${lastVersion} was already been scanned.`);
        }

        if (documentVersion <= lastVersion && !force) {
            if (settings.debug) {
                // eslint-disable-next-line no-console
                console.log(`Skipping scan of ${filePath} because this file version number ${documentVersion} has already been scanned.`);
            }

            return;
        }
    }

    if (settings.debug) {
        // eslint-disable-next-line no-console
        console.log(`${filePath} force = ${force}.`);
        // eslint-disable-next-line no-console
        console.log(`${filePath} is now at version number ${documentVersion}.`);
    }

    let tmpDocument = tmp.fileSync();
    fs.writeSync(tmpDocument.fd, textDocument.getText(), 0, 'utf8');

    const documentLines: string[] = textDocument.getText().replace(/\r/g, '').split('\n');

    const allDiagnostics: Map<String, Diagnostic[]> = new Map<String, Diagnostic[]>();

    const relativePath = path.relative(workspaceRoot, filePath);
    const normalizedRelativePath = sysPath(path.normalize(relativePath));

    // deep-copy current items, so mid-stream configuration change doesn't spoil the party
    const lintersCopy: Linter[] = _.cloneDeep(linters);

    // eslint-disable-next-line no-console
    console.log(`Performing lint scan of ${filePath}...`);

    let hasSkipLinter = false;

    lintersCopy.forEach(linter => {
        try {
            let result = linter.lint(normalizedFilePath, workspaceRoot, tmpDocument.name);

            while (result.length > 0) {
                let diagnostics: Diagnostic[] = [];
                let currentFile: string = '';
                let i = result.length;

                while (i-- >= 0) {
                    let msg: InternalDiagnostic = result[i];

                    if (msg === null || msg === undefined || msg.parseError || !msg.hasOwnProperty('line') || msg.source === '') {
                        result.splice(i, 1);
                        continue;
                    }

                    let normalizedFileName = sysPath(path.normalize(path.resolve(msg.fileName)));

                    if (currentFile === '') {
                        currentFile = normalizedFileName;
                    }

                    if (currentFile !== normalizedFileName) {
                        continue;
                    }

                    if (normalizedRelativePath === normalizedFileName || (path.isAbsolute(normalizedFileName) && normalizedFilePath === normalizedFileName)) {
                        diagnostics.push(makeDiagnostic(documentLines, msg));
                    } else {
                        diagnostics.push(makeDiagnostic(null, msg));
                    }

                    result.splice(i, 1);
                }

                let currentFileUri = URI.file(currentFile).toString();
                diagnostics = _.uniqBy(diagnostics, function(e) { return e.range.start.line + ':::' + e.code + ':::' + e.message; });

                if (allDiagnostics.has(currentFileUri)) {
                    allDiagnostics.set(currentFileUri, _.union(allDiagnostics.get(currentFileUri), diagnostics));
                } else {
                    allDiagnostics.set(currentFileUri, diagnostics);
                }
            }
        } catch (e: any) {
            tracker.add(getErrorMessage(e, textDocument));
        }
    });

    tmpDocument.removeCallback();

    let sendDiagnosticsToEditor = (diagnostics: Diagnostic[], currentFile: string) => {
        let currentFilePath = sysPath(URI.parse(currentFile).fsPath);
        let normalizedCurrentFilePath = currentFilePath;
        let normalizedWorkspaceRoot = sysPath(path.normalize(workspaceRoot!));

        if (normalizedCurrentFilePath.startsWith(normalizedWorkspaceRoot)) {
            let acceptFile: boolean = true;

            // see if we are to accept the diagnostics upon this file.
            _.each(settings.excludeFromWorkspacePaths, (excludedPath) => {
                let normalizedExcludedPath = path.normalize(excludedPath);

                if (!path.isAbsolute(normalizedExcludedPath)) {
                    // prepend the workspace path and renormalize the path.
                    normalizedExcludedPath = path.normalize(path.join(workspaceRoot!, normalizedExcludedPath));
                }

                // does the document match our excluded path?
                if (normalizedCurrentFilePath.startsWith(sysPath(normalizedExcludedPath))) {
                    // it did; so do not accept diagnostics from this file.
                    acceptFile = false;
                }
            });

            if (acceptFile) {
                let uri = URI.file(currentFilePath);

                connection.sendDiagnostics({ uri: uri.toString(), diagnostics: [] });
                connection.sendDiagnostics({ uri: uri.toString(), diagnostics });
            }
        }
    };

    // Send diagnostics to VSCode
    for (let diagnosticEntry of allDiagnostics) {
        sendDiagnosticsToEditor(diagnosticEntry[1], diagnosticEntry[0].toString());
    }

    // Remove all previous problem reports, when no further exist
    let filePathUri = URI.file(filePath).toString();
    if (!allDiagnostics.has(filePathUri)) {
        connection.sendDiagnostics({ uri: filePathUri, diagnostics: [] });
    }

    // eslint-disable-next-line no-console
    console.log('Completed lint scans...');

    if (!hasSkipLinter) {
        documentVersions.set(textDocument.uri, textDocument.version);
    }
    // Send any exceptions encountered during processing to VSCode.
    tracker.sendErrors(connection);
}

/* istanbul ignore next */
function makeDiagnostic(documentLines: string[] | null, msg: InternalDiagnostic): Diagnostic {
    let line: number;
    /* istanbul ignore next */
    if (documentLines !== null) {
        line = _.chain(msg.line)
            .defaultTo(0)
            .clamp(0, documentLines.length - 1)
            .value();
    } else {
        line = msg.line;
    }

    // 0 <= n
    const column: number = msg.column ?? 0;
    const message: string = msg.message ?? 'Unknown error';
    const code: undefined | number | string = msg.code ?? undefined;
    const source: string = msg.source ? `${msg.source} (${FLYLINT_ID})` : FLYLINT_ID;
    let startColumn: number = column;
    let endColumn: number = column + 1;

    if (documentLines !== null && column === 0 && documentLines.length > 0) {
        let l: string = _.nth(documentLines, line) as string;

        // Find the line's starting column, sans-white-space
        let lineMatches = l.match(/\S/);
        if (!_.isNull(lineMatches) && _.isNumber(lineMatches.index)) {
            startColumn = lineMatches.index;
        }

        // Set the line's ending column to the full length of line
        endColumn = l.length;
    }

    return {
        severity: msg.severity,
        range: {
            start: { line: line, character: startColumn },
            end: { line: line, character: endColumn }
        },
        message: message,
        code: code,
        source: source,
    };
}

/* istanbul ignore next */
function getErrorMessage(err: Error, document: TextDocument): string {
    let errorMessage = 'unknown error';
    if (_.isString(err.message)) {
        errorMessage = (err.message as string);
    }

    const fsPathUri = URI.parse(document.uri);
    return `'${errorMessage}' while validating: ${fsPathUri.fsPath}. Please analyze the 'C/C++ FlyLint' Output console. Stacktrace: ${err.stack}`;
}

/* istanbul ignore next */
connection.onDidChangeWatchedFiles((params) => {
    params.changes.forEach(async element => {
        let configFilePath = URI.parse(element.uri);

        if (path.basename(configFilePath.fsPath) === 'c_cpp_properties.json') {
            flushCache();

            await validateAllDocuments({ force: true });
        }
    });
});

/* istanbul ignore next */
connection.onRequest('getLocalConfig', async (activeDocument: TextDocument) => {
    const tracker = new ErrorMessageTracker();

    if (activeDocument !== undefined && activeDocument !== null) {
        let fileUri: URI = <URI>(<any>activeDocument.uri);

        for (const document of documents.all()) {
            try {
                const documentUri = URI.parse(document.uri);

                if (fileUri.fsPath === documentUri.fsPath) {
                    return Promise.resolve(await getDocumentSettings(document.uri));
                }
            } catch (err: any) {
                tracker.add(getErrorMessage(err, document));
            }
        }
    }

    tracker.sendErrors(connection);

    return Promise.reject();
});

/* istanbul ignore next */
connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
    const tracker = new ErrorMessageTracker();

    if (params.command === CommandIds.analyzeActiveDocument) {
        (connection.sendRequest('activeTextDocument') as Thenable<TextDocument>)
            .then(async (activeDocument) => {
                if (activeDocument !== undefined && activeDocument !== null) {
                    let fileUri: URI = <URI>(<any>activeDocument.uri);

                    for (const document of documents.all()) {
                        try {
                            const documentUri = URI.parse(document.uri);

                            if (fileUri.fsPath === documentUri.fsPath) {
                                await validateTextDocument(document, true);
                            }
                        } catch (err: any) {
                            tracker.add(getErrorMessage(err, document));
                        }
                    }
                }
            });
    } else if (params.command === CommandIds.analyzeWorkspace) {
        await validateAllDocuments({ force: true });
    }

    tracker.sendErrors(connection);
});

// Make the text document manager listen on the connection for open, change, and close text document events.
documents.listen(connection);

// Listen on the connection.
connection.listen();
