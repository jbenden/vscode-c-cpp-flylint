// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT
//
// istanbul ignore file

import * as unixify from 'unixify';

export namespace RobustPromises {
    type thenableExecutor<T> = () => Thenable<T>;

    export async function retry<T>(retries: number, delay: number, timeout: number, executor: thenableExecutor<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const until = async () => {
                const failed = async () => {
                    // eslint-disable-next-line no-console
                    // console.log(`Try timed out. Retrying...`);
                    if (--retries > 0) {
                        setTimeout(until, delay);
                    } else {
                        reject();
                    }
                };

                let t = setTimeout(failed, timeout);
                try {
                    // eslint-disable-next-line no-console
                    // console.log(`Try attempts are at ${retries}.`);
                    const result = await executor();
                    clearTimeout(t);
                    // eslint-disable-next-line no-console
                    // console.log(`Try succeeded!`);
                    resolve(result);
                } catch (err) {
                    clearTimeout(t);
                    // eslint-disable-next-line no-console
                    console.log(`Try caught an error. ${err}\nRetrying...`);
                    if (--retries > 0) {
                        setTimeout(until, delay);
                    } else {
                        reject();
                    }
                }
            };
            setTimeout(until, delay); // primer
        });
    }
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

// Reference: https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats
export function path(path: string): string {
    let lc = path.slice(0, 1).toLowerCase();
    if (lc >= 'a' && lc <= 'z' && path.slice(1, 2) === ':') {
        if (path.slice(2, 3) === '\\' || path.slice(2, 3) === '/') {
            var segs = path.split(/[/\\]+/);
            if (segs[segs.length - 1] === '') {
                segs.pop();
            }
            return segs.join('/');
        } else {
            // Windows: Make a relative MSYS-compatible path
            path = path.slice(2);
        }
    } else if (path.slice(0, 2) === '\\\\') {
        // Windows: Ensure UNC paths keep initial slashes
        return '/' + unixify(path);
    }
    return unixify(path);
}
