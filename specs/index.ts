/*
 * SPDX-FileCopyrightText: The Microsoft Corporation
 *
 * SPDX-License-Identifier: MIT
 */

import * as path from 'path';
import { run as runJest } from 'jest-cli';
import { didFailure, logger } from './debug-console/logger';

const rootDir = path.resolve(process.cwd(), '.');

export async function run(): Promise<void> {
    //process.stdout.write = (text: string) => !!logger(text);
    process.stderr.write = (text: string) => !!logger(text);

    let args: string[] = [];
    if (process.env.JEST_ARGS) {
        args = JSON.parse(process.env.JEST_ARGS);
    }

    args.push(
        '--runInBand',
        '--useStderr',
        '--env=vscode',
        '--colors',
        '--watchman=false',
        `--roots=${rootDir}`,
        `--setupFilesAfterEnv=${path.resolve(__dirname, './setup.js')}`,
    );

    try {
        await runJest(args, rootDir);
    } catch (e) {
        /* eslint-disable no-console */
        console.error(e);
        process.exit(1);
    }

    if (didFailure) { process.exit(1); }
}
