import { slow, suite, test, timeout } from '@testdeck/mocha';
import { expect } from 'chai';
import * as _ from "lodash";
import { PclintPlus } from '../pclintplus';
import { Settings } from '../../settings';
import { before, after, defaultConfig } from './test_helpers';

@suite(timeout(3000), slow(1000))
class PclintPlusTests {
    private config: Settings;
    private linter: PclintPlus;

    public static before() {
        before();
    }

    public static after() {
        after();
    }

    constructor() {
        this.config = _.cloneDeep(defaultConfig);
        this.linter = new PclintPlus(this.config, process.cwd());
    }

    @test("should find the PC-lint Plus executable linter")
    executableIsFound() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.fulfilled;
    }

    @test("should not find a missing executable linter")
    executableIsNotFound() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        this.linter['setExecutable']('nonexistent');

        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.rejectedWith('', 'The executable was not found for PclintPlus, disabling linter');
    }

    @test("should disable itself when no configuration file is found")
    configMissing() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        this.linter['setConfigFile']('nonexistent');

        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.rejectedWith('', 'could not locate configuration file for PclintPlus, disabling linter');
    }

    @test("should build a proper command-line for a C++ source file")
    commandLine() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        var actual = this.linter['buildCommandLine']("main.cc", "main.cc");
        actual.should.have.length(9);
    }

    @test("should build a proper command-line for a C++ header file")
    commandLineWithHeaderFile() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        var actual = this.linter['buildCommandLine']("main.h", "main.h");
        actual.should.have.length(16);
    }

    @test("should handle parsing an invalid line")
    parsesUnknownLine() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        let actual = this.linter['parseLine']('should not parse!');
        actual.should.have.property('parseError');
    }

    @test("should skip over first excluded patterns")
    skipsOverFirstExcludedPatterns() {
        let test = [
            'C:\\pclp-1.3.5\\windows\\config\\co-xc16.lnt  164 0  error 307: cannot open indirect ',
            "    file 'me-project.lnt'",
            'me-project.lnt',
            '^',
            ''
          ];
        // this method call syntax permits protected/private method calling; due to JavaScript.
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(1);

        let result = actual.pop();

        result.should.have.property('fileName', 'C:\\pclp-1.3.5\\windows\\config\\co-xc16.lnt');
        result.should.have.property('line', 163);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Error');
        result.should.have.property('code', "307");
        expect(result['message']).to.match(/^cannot open indirect/);
    }

    @test("should skip over second excluded patterns")
    skipsOverSecondExcludedPatterns() {
        let test = [
            'C:\\pclp-1.3.5\\windows\\config\\co-xc16.lnt:164:0: error 307: cannot open indirect ',
            "    file 'me-project.lnt'",
            'me-project.lnt',
            '^',
            ''
          ];
        // this method call syntax permits protected/private method calling; due to JavaScript.
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(1);

        let result = actual.pop();

        result.should.have.property('fileName', 'C:\\pclp-1.3.5\\windows\\config\\co-xc16.lnt');
        result.should.have.property('line', 163);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Error');
        result.should.have.property('code', "307");
        expect(result['message']).to.match(/^cannot open indirect/);
    }

    @test("should parse output")
    parsesOutput() {
        let test = [
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:78:4: warning 534: ignoring return value of function 'printf'",
            'c:\\program files (x86)\\microchip\\xc16\\v1.41\\bin\\bin\\../..\\include\\lega-c\\stdio.h:102:4: supplemental 891: declared here',
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:79:4: warning 534: ignoring return value of function 'printf'",
            'c:\\program files (x86)\\microchip\\xc16\\v1.41\\bin\\bin\\../..\\include\\lega-c\\stdio.h:102:4: supplemental 891: declared here',
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:81:4: warning 534: ignoring return value of function 'memset'",
            'c:\\program files (x86)\\microchip\\xc16\\v1.41\\bin\\bin\\../..\\include\\lega-c\\string.h:29:7: supplemental 891: declared here',
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:82:4: warning 534: ignoring return value of function 'memset'",
            'c:\\program files (x86)\\microchip\\xc16\\v1.41\\bin\\bin\\../..\\include\\lega-c\\string.h:29:7: supplemental 891: declared here',
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:71:8: warning 530: 'i' is likely uninitialized",
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:56:8: supplemental 891: allocated here',
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:76:6: info 838: previous value assigned to 'i' not used",
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:73:10: supplemental 891: previous assignment is here',
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:89:4: warning 438: last value assigned to 'i' not used",
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:76:6: supplemental 891: previous assignment is here',
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:60:29: warning 641: implicit conversion of enum 'mainXC16_enum' to integral type 'int'",
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:68:25: info 713: implicit conversion (assignment) from 'unsigned int' to 'int'",
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:69:26: info 713: implicit conversion (assignment) from 'unsigned int' to 'int'",
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:81:21: info 732: loss of sign (call) ('int' to 'size_t' (aka 'unsigned int'))",
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:82:21: info 732: loss of sign (call) ('int' to 'size_t' (aka 'unsigned int'))",
            'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:84:11: info 716: infinite loop via while',
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:44:1: info 751: local typedef 'mainXC16_enum_t' not referenced",
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:30:5: info 714: external symbol 'init_uart' was defined but not referenced",
            "c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c:30:5: info 765: external symbol 'init_uart' could be made static",
            ''
          ];
        // this method call syntax permits protected/private method calling; due to JavaScript.
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(23);

        let result = actual.pop();

        result.should.have.property('fileName', 'c:\\Users\\Username\\source\\repos\\Array\\mainXC16.c');
        result.should.have.property('line', 29);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Information');
        result.should.have.property('code', "765");
        expect(result['message']).to.match(/^external symbol \'init_uart\' could be made static/);
    }
}
