import { slow, suite, test, timeout } from '@testdeck/mocha';
import { expect } from 'chai';
import * as _ from 'lodash';
import { Flexelint } from '../flexelint';
import { Settings } from '../../settings';
import { before, after, defaultConfig } from './test_helpers';

@suite(timeout(3000), slow(1000))
export class FlexelintTests {
    private config: Settings;
    private linter: Flexelint;

    public static before() {
        before();
    }

    public static after() {
        after();
    }

    constructor() {
        this.config = _.cloneDeep(defaultConfig);
        this.linter = new Flexelint(this.config, process.cwd());
    }

    @test('should find the Flexelint executable linter')
    executableIsFound() {
        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.fulfilled;
    }

    @test('should not find a missing executable linter')
    executableIsNotFound() {
        this.linter['setExecutable']('nonexistent');

        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.rejectedWith('', 'The executable was not found for Flexelint, disabling linter');
    }

    @test('should disable itself when no configuration file is found')
    configMissing() {
        this.linter['setConfigFile']('nonexistent');

        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.rejectedWith('', 'could not locate configuration file for Flexelint, disabling linter');
    }

    @test('should build a proper command-line for a C++ source file')
    commandLine() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        var actual = this.linter['buildCommandLine']('main.cc', 'main.cc');
        actual.should.have.length(9);
    }

    @test('should build a proper command-line for a C++ header file')
    commandLineWithHeaderFile() {
        var actual = this.linter['buildCommandLine']('main.h', 'main.h');
        actual.should.have.length(16);
    }

    @test('should handle parsing an invalid line')
    parsesUnknownLine() {
        let actual = this.linter['parseLine']('should not parse!')!;
        actual.should.have.property('parseError');
    }

    @test('should skip over excluded patterns')
    skipsOverExcludedPatterns() {
        let test = [
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
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(2);

        let result = actual.pop()!;

        result.should.have.property('fileName', 'flist.c');
        result.should.have.property('line', 2932);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Warning');
        result.should.have.property('code', '613');
        expect(result['message']).to.match(/^Possible use of null pointer \'flist\'/);
    }

    @test('should parse a line with a missing column number')
    parsesLineWithMissingColumnNumber() {
        let test = 'include/omniplayer/app.h  36  Warning 1526: Member function \'tp::op::OPApp::OnCmdLineParsed(wxCmdLineParser &)\' (line 36, file include/omniplayer/app.h) not defined';
        let actual = this.linter['parseLine'](test)!;

        actual.should.have.property('fileName', 'include/omniplayer/app.h');
        actual.should.have.property('line', 35);
        actual.should.have.property('column', 0);
        actual.should.have.property('severity', 'Warning');
        actual.should.have.property('code', '1526');
        expect(actual['message']).to.match(/^Member function/);
    }

    @test('should parse a line with complete detail')
    parsesFullLine() {
        let test = 'include/omniplayer/app.h  48 0  Info 1714: Member function \'tp::op::OPApp::IsVerbose(void) const\' (line 48, file /home/jbenden/repo/git/omniplayer.git/include/omniplayer/app.h) not referenced';
        let actual = this.linter['parseLine'](test)!;

        actual.should.have.property('fileName', 'include/omniplayer/app.h');
        actual.should.have.property('line', 47);
        actual.should.have.property('column', 0);
        actual.should.have.property('severity', 'Information');
        actual.should.have.property('code', '1714');
        expect(actual['message']).to.match(/^Member function/);
    }

    @test('should parse a multi-line message')
    parsesMultiLine() {
        let test = [`C:\\msys64\\usr\\lib\\gcc\\x86_64-pc-msys\\6.3.0\\include\\c++\\stdlib.h  60 14  Error 1087: Previous declaration of 'div(int, int)' (line 91, file C:\\msys64\\usr\\include\\stdlib.h) is incompatible with 'div(int, int)' (line 91, file C:\\msys64\\usr\\include\\stdlib.h) which was introduced by the current using-declaration`,
            `C:\\msys64\\usr\\include\\stdlib.h  91 0  Info 830: Location cited in prior message`,
            `C:\\msys64\\usr\\include\\stdlib.h  91 0  Info 830: Location cited in prior message`
        ];
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(1);

        let result = actual.pop()!;

        result.should.have.property('fileName', 'C:\\msys64\\usr\\lib\\gcc\\x86_64-pc-msys\\6.3.0\\include\\c++\\stdlib.h');
        result.should.have.property('line', 59);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Error');
        result.should.have.property('code', '1087');
        expect(result['message']).to.match(/^Previous declaration of \'div/);
    }

    @test('should parse the line')
    shouldParse0001() {
        let test = 'c:\\Source\\rsync2\\rsync.h  314 10  Warning 537: Repeated include file \'C:\\msys64\\usr\\lib\\gcc\\x86_64-pc-msys\\6.3.0\\include\\stdint.h\'';
        let actual = this.linter['parseLine'](test)!;

        actual.should.have.property('fileName', 'c:\\Source\\rsync2\\rsync.h');
    }
}
