import { ExtensionContext, window, workspace, tasks, TaskEndEvent, TaskGroup } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    SettingMonitor,
    TransportKind
} from 'vscode-languageclient/node';
import * as path from 'path';

export function activate(context: ExtensionContext) {
    // The server is implemented in Node.
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

    // The debug options for the server.
    const debugOptions = {
        execArgv: ['--nolazy', '--inspect=6011']
    };

    // If the extension is launched in debug mode the debug server options are used, otherwise the run options are used.
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    // Create the language client and start it.
    startLSClient(serverOptions, context);
}

function startLSClient(serverOptions: ServerOptions, context: ExtensionContext) {
    // Options to control the language client.
    const clientOptions: LanguageClientOptions = {
        // Register the server for C/C++ documents.
        documentSelector: [{ scheme: 'file', language: 'c' }, { scheme: 'file', language: 'cpp' }],
        synchronize: {
            // Synchronize the setting section "c-cpp-flylint" to the server.
            configurationSection: 'c-cpp-flylint',
            fileEvents: workspace.createFileSystemWatcher('**/{c_cpp_properties.json,.clang_complete,.flexelint.lnt}')
        }
    };

    const client = new LanguageClient('c-cpp-flylint', 'C/C++ Flylint', serverOptions, clientOptions);

    client.onReady()
        .then(() => {
            client.onRequest('activeTextDocument', () => {
                return window.activeTextEditor!.document;
            });

            tasks.onDidEndTask((e: TaskEndEvent) => {
                if (e.execution.task.group && e.execution.task.group === TaskGroup.Build) {
                    // send a build notification event
                    let params = {
                        taskName: e.execution.task.name,
                        taskSource: e.execution.task.source,
                        isBackground: e.execution.task.isBackground,
                    };
                    client.sendNotification('onBuild', params);
                }
            });
        });

    context.subscriptions.push(new SettingMonitor(client, 'c-cpp-flylint.enable').start());
}
