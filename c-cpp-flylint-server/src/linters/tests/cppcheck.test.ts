import * as assert from 'assert';
import { slow, suite, test, timeout } from 'mocha-typescript';
import * as mock from 'mock-fs';
import * as _ from "lodash";
import { Settings } from '../../settings';
import { CppCheck } from '../cppcheck';
import { before, after, isWindows, defaultConfig } from './test_helpers';

@suite(timeout(3000), slow(1000))
class CppCheckTests {
    private config: Settings;
    private linter: CppCheck;

    public static before() {
        before();
    }

    public static after() {
        after();
    }

    constructor() {
        this.config = _.cloneDeep(defaultConfig);
        this.linter = new CppCheck(this.config, process.cwd());
    }

    @test("should find the CppCheck executable linter")
    executableIsFound() {
        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.fulfilled;
    }

    @test("should not find a missing executable linter")
    executableIsNotFound() {
        this.linter['setExecutable']('nonexistent');

        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.rejectedWith(false, 'The executable was not found for CppCheck, disabling linter');
    }

    @test("should build a proper command-line for a C++ source file")
    commandLine() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        var actual = this.linter['buildCommandLine']("main.cc", "main.cc");
        actual.should.have.length(7);
    }

    @test("should build a proper command-line for a C++ header file")
    commandLineWithHeaderFile() {
        var actual = this.linter['buildCommandLine']("main.h", "main.h");
        actual.should.have.length(7);
    }

    @test("should handle parsing an invalid line")
    parsesUnknownLine() {
        (() => this.linter['parseLine']('should not parse!')).should.throw(Error, 'could not be parsed');
    }

    @test("should skip over excluded patterns")
    skipsOverExcludedPatterns() {
        let test = [
            `Checking flist.c: _WIN32...`,
            `Checking flist.c: _WIN32;__CYGWIN__...`,
            `Checking flist.c: __GNUC__...`,
            `Checking flist.c: __i386__;__i486__;__i586__;__i686__...`,
            `flist.c  2837  style unusedStructMember: struct member 'Anonymous5::name_space' is never used.`,
            `Checking flist.c: freeaddrinfo...`,
            `Checking flist.c: gai_strerror...`,
            `Checking flist.c: getaddrinfo...`,
            `Checking flist.c: getnameinfo...`,
            `Checking flist.c: iconv_t...`,
            `    information missingIncludeSystem: Cppcheck cannot find all the include files (use --check-config for details)`,
        ];
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(1);

        let result = actual.pop();

        result.should.have.property('fileName', 'flist.c');
        result.should.have.property('line', 2836);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Information');
        result.should.have.property('code', "unusedStructMember");
        result['message'].should.match(/^struct member \'Anonymous5::name_space\' is never used\./);
    }
}
