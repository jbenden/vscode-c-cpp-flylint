import { commands, env, ExtensionContext, window, workspace, tasks, TaskEndEvent, TaskGroup, Uri, WorkspaceConfiguration } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    SettingMonitor,
    TransportKind,
} from 'vscode-languageclient/node';
import * as path from 'path';
import { getFromWorkspaceState, resetWorkspaceState, setWorkspaceState, updateWorkspaceState } from './stateUtils';
import { isBoolean } from 'lodash';

const WORKSPACE_IS_TRUSTED_KEY = 'WORKSPACE_IS_TRUSTED_KEY';
const SECURITY_SENSITIVE_CONFIG: string[] = [
    'clang.executable',
    'cppcheck.executable',
    'flexelint.executable',
    'flawfinder.executable',
    'lizard.executable',
    'pclintplus.executable',
];
var IS_TRUSTED: boolean = false;

export async function maybeWorkspaceIsTrusted(ctx: ExtensionContext) {
    if (workspace.hasOwnProperty('isTrusted') && workspace.hasOwnProperty('isTrusted') !== null) {
        const workspaceIsTrusted = (workspace as any)['isTrusted'];
        console.log(`Workspace has property "isTrusted". It has the value of "${workspaceIsTrusted}".`);
        if (isBoolean(workspaceIsTrusted) && workspaceIsTrusted) {
            IS_TRUSTED = true;
            console.log(`Workspace was marked trusted, by user of VSCode.`);
        } else {
            IS_TRUSTED = false;
            console.log(`Workspace is not trusted!`);
        }
        return;
    }

    const isTrusted = getFromWorkspaceState(WORKSPACE_IS_TRUSTED_KEY, false);
    if (isTrusted !== IS_TRUSTED) {
        IS_TRUSTED = true;
    }

    ctx.subscriptions.push(commands.registerCommand('c-cpp-flylint.workspace.isTrusted.toggle', async () => {
        await toggleWorkspaceIsTrusted();
        commands.executeCommand('c-cpp-flylint.analyzeWorkspace');
    }));
    ctx.subscriptions.push(commands.registerCommand('c-cpp-flylint.workspace.resetState', resetWorkspaceState));

    if (isTrusted) {
        return;
    }

    const ignored = ignoredWorkspaceConfig(workspace.getConfiguration('c-cpp-flylint'), SECURITY_SENSITIVE_CONFIG);
    if (ignored.length === 0) {
        return;
    }
    const ignoredSettings = ignored.map((x) => `"c-cpp-flylint.${x}"`).join(',');
    const val = await window.showWarningMessage(
        `Some workspace/folder-level settings (${ignoredSettings}) from the untrusted workspace are disabled ` +
        'by default. If this workspace is trusted, explicitly enable the workspace/folder-level settings ' +
        'by running the "C/C++ Flylint: Toggle Workspace Trust Flag" command.',
        'OK',
        'Trust This Workspace',
        'More Info'
    );
    switch (val) {
        case 'Trust This Workspace':
            await toggleWorkspaceIsTrusted();
            break;
        case 'More Info':
            env.openExternal(Uri.parse('https://github.com/jbenden/vscode-c-cpp-flylint/blob/main/README.md#security'));
            break;
        default:
            break;
    }
}

function ignoredWorkspaceConfig(cfg: WorkspaceConfiguration, keys: string[]) {
    return keys.filter((key) => {
        const inspect = cfg.inspect(key);
        if (inspect === undefined) {
            return false;
        }
        return inspect.workspaceValue !== undefined || inspect.workspaceFolderValue !== undefined;
    });
}

async function toggleWorkspaceIsTrusted() {
    IS_TRUSTED = !IS_TRUSTED;
    await updateWorkspaceState(WORKSPACE_IS_TRUSTED_KEY, IS_TRUSTED);
}

export async function activate(context: ExtensionContext) {
    setWorkspaceState(context.workspaceState);

    await maybeWorkspaceIsTrusted(context);

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

            client.onRequest('isTrusted', () => {
                client.outputChannel.appendLine(`Incoming request for isTrusted property. Have ${IS_TRUSTED}.`);

                return IS_TRUSTED;
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
