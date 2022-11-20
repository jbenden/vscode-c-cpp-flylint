// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT

import { URI } from 'vscode-uri';
import { path } from '../../server/src/utils';

describe('path', () => {
    describe('POSIX-based directory paths', () => {
        test('it should pass-through POSIX path', () => {
            expect(path('a/b')).toBe('a/b');
        });

        test('it should pass-through POSIX absolute path', () => {
            expect(path('/a/b')).toBe('/a/b');
        });

        test('it should handle POSIX absolute paths', () => {
            let uri = URI.file('/a/b/ab.c');
            expect(uri.scheme).toBe('file');
            expect(uri.path).toBe('/a/b/ab.c');

            let uri2 = URI.file(path('/a/b/ab.c'));
            expect(uri2).toStrictEqual(uri);
        });

        test('it should handle POSIX relative paths', () => {
            let uri = URI.file('a/b/ab.c');
            expect(uri.scheme).toBe('file');
            expect(uri.path).toBe('/a/b/ab.c');

            let uri2 = URI.file(path('a/b/ab.c'));
            expect(uri2).toStrictEqual(uri);
        });
    });

    describe('DOS-based directory paths', () => {
        test('it should convert DOS path', () => {
            expect(path('\\a\\b.txt')).toBe('/a/b.txt');
        });

        test('it should convert DOS absolute path', () => {
            expect(path('c:\\a\\b.txt')).toBe('c:/a/b.txt');
        });

        test('it should convert DOS relative with drive letter path', () => {
            expect(path('C:a\\b.txt')).toBe('a/b.txt');
        });

        test('it should convert DOS absolute path with POSIX separators', () => {
            expect(path('C:/a/b.txt')).toBe('C:/a/b.txt');
        });

        test('it should convert DOS relative with drive letter path and POSIX separators', () => {
            expect(path('C:a/b.txt')).toBe('a/b.txt');
        });

        test('it should handle DOS absolute paths', () => {
            let uri = URI.file('C:\\a\\b\\ab.c');
            expect(uri.scheme).toBe('file');
            expect(uri.path).toBe('/C:\\a\\b\\ab.c');

            let uri2 = URI.file(path('C:\\a\\b\\ab.c'));
            expect(uri2.scheme).toBe('file');
            expect(uri2.path).toBe('/C:/a/b/ab.c');
            expect(uri2.toString()).toBe('file:///c%3A/a/b/ab.c');
        });

        test('it should handle DOS relative paths', () => {
            let uri = URI.file('a\\b\\ab.c');
            expect(uri.scheme).toBe('file');
            expect(uri.path).toBe('/a\\b\\ab.c');

            let uri2 = URI.file(path('a\\b\\ab.c'));
            expect(uri2.scheme).toBe('file');
            expect(uri2.path).toBe('/a/b/ab.c');
        });

        test('it should handle DOS relative path with drive letter', () => {
            let uri = URI.file('C:a\\b\\ab.c');
            expect(uri.scheme).toBe('file');
            expect(uri.path).toBe('/C:a\\b\\ab.c');
            expect(uri.toString()).toBe('file:///c%3Aa%5Cb%5Cab.c');

            let uri2 = URI.file(path('C:a\\b\\ab.c'));
            expect(uri2.scheme).toBe('file');
            expect(uri2.path).toBe('/a/b/ab.c');
            expect(uri2.toString()).toBe('file:///a/b/ab.c');
        });
    });

    describe('Windows UNC paths', () => {
        test('it should pass-through with converted directory separators', () => {
            // UNC DOS-style device paths
            expect(path('\\\\.\\a.txt')).toBe('//./a.txt');
            expect(path('\\\\?\\a.txt')).toBe('//?/a.txt');

            // UNC paths
            expect(path('\\\\127.0.0.1\\c$\\a.txt')).toBe('//127.0.0.1/c$/a.txt');
            expect(path('\\\\.\\UNC\\LOCALHOST\\c$\\a.txt')).toBe('//./UNC/LOCALHOST/c$/a.txt');
        });
    });
});
