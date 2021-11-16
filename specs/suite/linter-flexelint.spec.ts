import { cloneDeep } from 'lodash';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { Flexelint } from '../../server/src/linters/flexelint';
import { Linter } from '../../server/src/linters/linter';
import { Settings } from '../../server/src/settings';
import { defaultConfig } from '../mock-config';
import { injectMockFileSystem } from '../mock-fs';

describe('Flexelint parser', () => {
    injectMockFileSystem();

    var config: Settings;
    var linter: Linter;

    beforeEach(() => {
        config = cloneDeep(defaultConfig);
        linter = new Flexelint(config, process.cwd());
    });

    test('should build a proper command-line for a C++ source file', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['buildCommandLine']('main.cc', 'main.cc');
        expect(actual).toHaveLength(9);
    });

    test('should build a proper command-line for a C++ header file', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['buildCommandLine']('main.h', 'main.h');
        expect(actual).toHaveLength(16);
    });

    test('should handle parsing an invalid line', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['parseLine']('should not parse!')!;
        expect(actual).toHaveProperty('parseError');
    });

    test('should skip over excluded patterns', () => {
        const test = [
            `During Specific Walk:`,
            `  File flist.c line 2245: flist_new(0, !=0)`,
            `flist.c  2933 0  Warning 613: Possible use of null pointer 'flist' in left argument to operator '->' [Reference: file flist.c: line 2901]`,
            `flist.c  2901 0  Info 831: Reference cited in prior message`,
            ``,
            `During Specific Walk:`,
            `  File flist.c line 2245: flist_new(0, !=0)`,
            `flist.c  2933 0  Warning 613: Possible use of null pointer 'flist' in left argument to operator '->' [Reference: file flist.c: line 2901]`,
            `flist.c  2901 0  Info 831: Reference cited in prior message`
        ];
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(2);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 2932);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Warning);
        expect(result).toHaveProperty('code', '613');
        expect(result['message']).toMatch(/^Possible use of null pointer \'flist\'/);
    });

    test('should parse a line with a missing column number', () => {
        const test = 'include/omniplayer/app.h  36  Warning 1526: Member function \'tp::op::OPApp::OnCmdLineParsed(wxCmdLineParser &)\' (line 36, file include/omniplayer/app.h) not defined';
        const actual = linter['parseLine'](test)!;

        expect(actual).toHaveProperty('fileName', 'include/omniplayer/app.h');
        expect(actual).toHaveProperty('line', 35);
        expect(actual).toHaveProperty('column', 0);
        expect(actual).toHaveProperty('severity', DiagnosticSeverity.Warning);
        expect(actual).toHaveProperty('code', '1526');
        expect(actual['message']).toMatch(/^Member function/);
    });

    test('should parse a line with complete detail', () => {
        const test = 'include/omniplayer/app.h  48 0  Info 1714: Member function \'tp::op::OPApp::IsVerbose(void) const\' (line 48, file /home/jbenden/repo/git/omniplayer.git/include/omniplayer/app.h) not referenced';
        const actual = linter['parseLine'](test)!;

        expect(actual).toHaveProperty('fileName', 'include/omniplayer/app.h');
        expect(actual).toHaveProperty('line', 47);
        expect(actual).toHaveProperty('column', 0);
        expect(actual).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(actual).toHaveProperty('code', '1714');
        expect(actual['message']).toMatch(/^Member function/);
    });

    test('should parse a multi-line message', () => {
        const test = [`C:\\msys64\\usr\\lib\\gcc\\x86_64-pc-msys\\6.3.0\\include\\c++\\stdlib.h  60 14  Error 1087: Previous declaration of 'div(int, int)' (line 91, file C:\\msys64\\usr\\include\\stdlib.h) is incompatible with 'div(int, int)' (line 91, file C:\\msys64\\usr\\include\\stdlib.h) which was introduced by the current using-declaration`,
            `C:\\msys64\\usr\\include\\stdlib.h  91 0  Info 830: Location cited in prior message`,
            `C:\\msys64\\usr\\include\\stdlib.h  91 0  Info 830: Location cited in prior message`
        ];
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(1);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'C:\\msys64\\usr\\lib\\gcc\\x86_64-pc-msys\\6.3.0\\include\\c++\\stdlib.h');
        expect(result).toHaveProperty('line', 59);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Error);
        expect(result).toHaveProperty('code', '1087');
        expect(result['message']).toMatch(/^Previous declaration of \'div/);
    });

    test('should parse the MS-DOS formatted filenames', () => {
        const test = 'c:\\Source\\rsync2\\rsync.h  314 10  Warning 537: Repeated include file \'C:\\msys64\\usr\\lib\\gcc\\x86_64-pc-msys\\6.3.0\\include\\stdint.h\'';
        const actual = linter['parseLine'](test)!;

        expect(actual).toHaveProperty('fileName', 'c:\\Source\\rsync2\\rsync.h');
    });
});
