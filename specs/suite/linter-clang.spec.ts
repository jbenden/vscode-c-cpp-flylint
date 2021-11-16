import { cloneDeep } from 'lodash';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { Clang } from '../../server/src/linters/clang';
import { Linter } from '../../server/src/linters/linter';
import { Settings } from '../../server/src/settings';
import { defaultConfig } from '../mock-config';
import { injectMockFileSystem } from '../mock-fs';

describe('Clang parser', () => {
    injectMockFileSystem();

    var config: Settings;
    var linter: Linter;

    beforeEach(() => {
        config = cloneDeep(defaultConfig);
        linter = new Clang(config, process.cwd());
    });

    test('should build a proper command-line for a C++ source file', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['buildCommandLine']('main.cc', 'main.cc');
        expect(actual).toHaveLength(17);
    });

    test('should build a proper command-line for a C++ header file', () => {
        const actual = linter['buildCommandLine']('main.h', 'main.h');
        expect(actual).toHaveLength(17);
    });

    test('should handle parsing an invalid line', () => {
        const actual = linter['parseLine']('should not parse!')!;
        expect(actual).toHaveProperty('parseError');
    });

    test('should correctly parse multiple lines', () => {
        const test = [
            `rounding.c:35:51: error: use of undeclared identifier 'EXTRA_ROUNDING'`,
            `rounding.c:26:30: error: use of undeclared identifier 'EXTRA_ROUNDING'`,
            `rounding.c:31:52: note: expanded from macro 'EXPECTED_SIZE'`,
            `rounding.c:22:20: note: expanded from macro 'ARRAY_LEN'`,
            `rounding.c:22:20: note: expanded from macro 'ARRAY_LEN'`,
            `./rsync.h:673:42: warning: 'HAVE_HPUX_ACLS' is not defined, evaluates to 0`,
            `In file included from rounding.c:20:`,
            `In file included from ./rsync.h:977:`,
            `./byteorder.h:91:23: warning: cast from 'const char *' to 'unsigned char * drops const qualifier`,
            `In file included from rounding.c:20:`,
            `./rsync.h:1159:9: warning: macro name is a reserved identifier`,
            `./rsync.h:1163:9: warning: macro name is a reserved identifier`,
            `rounding.c:26:30: error: use of undeclared identifier 'EXTRA_ROUNDING'`,
            `rounding.c:22:20: note: expanded from macro 'ARRAY_LEN'`,
            `rounding.c:35:51: error: use of undeclared identifier 'EXTRA_ROUNDING'`,
            `rounding.c:31:52: note: expanded from macro 'EXPECTED_SIZE'`,
            `rounding.c:22:20: note: expanded from macro 'ARRAY_LEN'`,
        ];
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(17);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'rounding.c');
        expect(result).toHaveProperty('line', 21);
        expect(result).toHaveProperty('column', 19);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result['message']).toMatch(/^expanded from macro \'ARRAY_LEN\'/);
    });

    test('should handle excluded lines during parse', () => {
        const test = [
            `warning: include location '/usr/local/include' is unsafe for cross-compilation [-Wpoison-system-directories]`,
            `/Users/user/cpp-test/main.cpp:8:2: warning: C++98 requires newline at end of file [Lexical or Preprocessor Issue]`
        ];
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(1);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', '/Users/user/cpp-test/main.cpp');
        expect(result).toHaveProperty('line', 7);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Warning);
        expect(result['message']).toMatch(/^C\+\+98 requires newline at end of file/);
    });
});
