import { cloneDeep } from 'lodash';
import { basename } from 'path';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { Linter } from '../../server/src/linters/linter';
import { PclintPlus } from '../../server/src/linters/pclintplus';
import { Settings } from '../../server/src/settings';
import { defaultConfig } from '../mock-config';
import { injectMockFileSystem } from '../mock-fs';

describe("PCLint Plus parser", () => {
    injectMockFileSystem();

    var config: Settings;
    var linter: Linter;

    beforeEach(() => {
        config = cloneDeep(defaultConfig);
        linter = new PclintPlus(config, process.cwd());
    });

    test("should find the actual PCLint Plus executable", async () => {
        // FIXME: Apparently the result recv'd here doesn't mean much. Knowing the exec found is private information in the class. Might be incorrect, as it seems we need to know stuff works... Having additional questions API could work, eg: foundExe() and foundConfig() or haveExe, testExe, ...
        // NOTE: Could also refactor the complex part out into other place, allowing testing; but the method in Linter could remain private and not tested.
        await linter['maybeEnable']();

        // access private member variable via JavaScript property access.
        const exe = basename(linter['executable']);

        expect(linter.isActive()).toBeTruthy();
        expect(exe).toBe('pclp');
    });

    test("should NOT find a missing PCLint Plus executable", async () => {
        // GIVEN
        linter['setExecutable']('non-existent');

        // WHEN
        await linter['maybeEnable']()
            // THEN
            .then(() => {
                fail(new Error('Should not have gotten a result value'));
            })
            .catch((e: Error) => {
                expect(e.message).toEqual('The executable was not found for PclintPlus, disabling linter');
            });
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

    test('should parse using first exclude pattern', () => {
        const test = [
            'C:\\pclp-1.3.5\\windows\\config\\co-xc16.lnt  164 0  error 307: cannot open indirect ',
            '    file \'me-project.lnt\'',
            'me-project.lnt',
            '^',
            ''
        ];
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(1);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'C:\\pclp-1.3.5\\windows\\config\\co-xc16.lnt');
        expect(result).toHaveProperty('line', 163);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Error);
        expect(result).toHaveProperty('code', '307');
        expect(result['message']).toMatch(/^cannot open indirect/);
    });

    test('should parse using second exclude pattern', () => {
        const test = [
            'C:\\pclp-1.3.5\\windows\\config\\co-xc16.lnt:164:0: error 307: cannot open indirect ',
            '    file \'me-project.lnt\'',
            'me-project.lnt',
            '^',
            ''
        ];
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(1);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'C:\\pclp-1.3.5\\windows\\config\\co-xc16.lnt');
        expect(result).toHaveProperty('line', 163);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Error);
        expect(result).toHaveProperty('code', '307');
        expect(result['message']).toMatch(/^cannot open indirect/);
    });

    test('should parse multiple lines of output', () => {
        const test = [
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:78:4: warning 534: ignoring return value of function \'printf\'',
            'c:\\program files (x86)\\microchip\\xc16\\v1.41\\bin\\bin\\../..\\include\\lega-c\\stdio.h:102:4: supplemental 891: declared here',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:79:4: warning 534: ignoring return value of function \'printf\'',
            'c:\\program files (x86)\\microchip\\xc16\\v1.41\\bin\\bin\\../..\\include\\lega-c\\stdio.h:102:4: supplemental 891: declared here',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:81:4: warning 534: ignoring return value of function \'memset\'',
            'c:\\program files (x86)\\microchip\\xc16\\v1.41\\bin\\bin\\../..\\include\\lega-c\\string.h:29:7: supplemental 891: declared here',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:82:4: warning 534: ignoring return value of function \'memset\'',
            'c:\\program files (x86)\\microchip\\xc16\\v1.41\\bin\\bin\\../..\\include\\lega-c\\string.h:29:7: supplemental 891: declared here',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:71:8: warning 530: \'i\' is likely uninitialized',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:56:8: supplemental 891: allocated here',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:76:6: info 838: previous value assigned to \'i\' not used',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:73:10: supplemental 891: previous assignment is here',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:89:4: warning 438: last value assigned to \'i\' not used',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:76:6: supplemental 891: previous assignment is here',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:60:29: warning 641: implicit conversion of enum \'mainXC16_enum\' to integral type \'int\'',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:68:25: info 713: implicit conversion (assignment) from \'unsigned int\' to \'int\'',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:69:26: info 713: implicit conversion (assignment) from \'unsigned int\' to \'int\'',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:81:21: info 732: loss of sign (call) (\'int\' to \'size_t\' (aka \'unsigned int\'))',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:82:21: info 732: loss of sign (call) (\'int\' to \'size_t\' (aka \'unsigned int\'))',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:84:11: info 716: infinite loop via while',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:44:1: info 751: local typedef \'mainXC16_enum_t\' not referenced',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:30:5: info 714: external symbol \'init_uart\' was defined but not referenced',
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:30:5: info 765: external symbol \'init_uart\' could be made static',
            ''
        ];
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(23);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c');
        expect(result).toHaveProperty('line', 29);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', '765');
        expect(result['message']).toMatch(/^external symbol \'init_uart\' could be made static/);
    });
});
