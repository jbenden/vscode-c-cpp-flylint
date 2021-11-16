import { cloneDeep } from 'lodash';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { FlawFinder } from '../../server/src/linters/flawfinder';
import { Linter } from '../../server/src/linters/linter';
import { Settings } from '../../server/src/settings';
import { defaultConfig } from '../mock-config';
import { injectMockFileSystem } from '../mock-fs';

describe('FlawFinder parser', () => {
    injectMockFileSystem();

    var config: Settings;
    var linter: Linter;

    beforeEach(() => {
        config = cloneDeep(defaultConfig);
        linter = new FlawFinder(config, process.cwd());
    });

    test('should build a proper command-line for a C++ source file', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['buildCommandLine']('main.cc', 'main.cc');
        expect(actual).toHaveLength(5);
    });

    test('should build a proper command-line for a C++ header file', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['buildCommandLine']('main.h', 'main.h');
        expect(actual).toHaveLength(5);
    });

    test('should handle parsing an invalid line', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['parseLine']('should not parse!')!;
        expect(actual).toHaveProperty('parseError');
    });

    test('should skip over excluded patterns', () => {
        const test = [
            `Examining git/test/test.c`,
            ``,
            `git/test/test.c:7:5:  [4] (buffer) sprintf:Does not check for buffer overflows (CWE-120).  Use sprintf_s, snprintf, or vsnprintf.`
        ];
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(1);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'git/test/test.c');
        expect(result).toHaveProperty('line', 6);
        expect(result).toHaveProperty('column', 4);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Warning);
        expect(result).toHaveProperty('code', '(buffer) sprintf');
        expect(result['message']).toMatch(/^Does not check for buffer overflows/);
    });
});
