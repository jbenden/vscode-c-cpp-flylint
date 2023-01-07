// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT

import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';
import * as cp from 'child_process';
import * as path from 'path';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../..');

        // The path to the extension test runner script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './index');

        const vscodeExecutablePath = await downloadAndUnzipVSCode('1.62.2');
        const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);

        // Install the C/C++ base tools
        cp.spawnSync(cliPath, ['--install-extension', 'ms-vscode.cpptools'], {
            encoding: 'utf-8',
            stdio: 'inherit'
        });

        process.chdir(extensionDevelopmentPath);

        var launchArgs: string[] = [
            '--disable-gpu',
            '--disable-updates',
            '--disable-keytar',
            '--disable-workspace-trust',
            '--logExtensionHostCommunication',
            '--sync=off',
            '--disable-user-env'
        ];

        // TODO(jbenden): `process.env.CODE_DEBUG` fails to work under Windows.
        if (process.env.CODE_DEBUG) {
            launchArgs = launchArgs.concat('--log=debug');
        } else if (process.env.CODE_VERBOSE) {
            launchArgs = launchArgs.concat('--verbose');
        }

        if (process.env.INSPECT_PORT) {
            launchArgs = launchArgs.concat(`--nolazy`, `--inspect='${process.env.INSPECT_PORT}'`);
        }

        // Run the extension test
        process.exit(await runTests({
            // Use the specified `code` executable
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs
        }));
    } catch (err) {
        /* eslint-disable no-console */
        console.error(err);
        /* eslint-disable no-console */
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
