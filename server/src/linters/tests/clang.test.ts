import * as assert from 'assert';
import { slow, suite, test, timeout } from 'mocha-typescript';
import { expect } from 'chai';
import * as mock from 'mock-fs';
import * as _ from "lodash";
import { Settings } from '../../settings';
import { Clang } from '../clang';
import { before, after, isWindows, defaultConfig } from './test_helpers';

@suite(timeout(3000), slow(1000))
class ClangTests {
    private config: Settings;
    private linter: Clang;

    public static before() {
        before();
    }

    public static after() {
        after();
    }

    constructor() {
        this.config = _.cloneDeep(defaultConfig);
        this.linter = new Clang(this.config, process.cwd());
    }

    @test("should find the Clang executable linter")
    executableIsFound() {
        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.fulfilled;
    }

    @test("should not find a missing executable linter")
    executableIsNotFound() {
        this.linter['setExecutable']('nonexistent');

        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.rejectedWith(false, 'The executable was not found for Clang, disabling linter');
    }

    @test("should build a proper command-line for a C++ source file")
    commandLine() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        var actual = this.linter['buildCommandLine']("main.cc", "main.cc");
        actual.should.have.length(17);
    }

    @test("should build a proper command-line for a C++ header file")
    commandLineWithHeaderFile() {
        var actual = this.linter['buildCommandLine']("main.h", "main.h");
        actual.should.have.length(17);
    }

    @test("should handle parsing an invalid line")
    parsesUnknownLine() {
        (() => this.linter['parseLine']('should not parse!')).should.throw(Error, 'could not be parsed');
    }

    @test("should handle parsing multiple lines of output")
    parsesMultipleLines() {
        let test = [
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
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(17);

        let result = actual.pop();

        result.should.have.property('fileName', 'rounding.c');
        result.should.have.property('line', 21);
        // result.should.have.property('column', 20);
        result.should.have.property('severity', 'Information');
        expect(result['message']).to.match(/^expanded from macro \'ARRAY_LEN\'/);
    }
}
