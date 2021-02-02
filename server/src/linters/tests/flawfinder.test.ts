import { slow, suite, test, timeout } from '@testdeck/mocha';
import { expect } from 'chai';
import * as _ from 'lodash';
import { Settings } from '../../settings';
import { FlawFinder } from '../flawfinder';
import { before, after, defaultConfig } from './test_helpers';

@suite(timeout(3000), slow(1000))
export class FlawFinderTests {
    private config: Settings;
    private linter: FlawFinder;

    public static before() {
        before();
    }

    public static after() {
        after();
    }

    constructor() {
        this.config = _.cloneDeep(defaultConfig);
        this.linter = new FlawFinder(this.config, process.cwd());
    }

    @test('should find the FlawFinder executable linter')
    executableIsFound() {
        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.fulfilled;
    }

    @test('should not find a missing executable linter')
    executableIsNotFound() {
        this.linter['setExecutable']('nonexistent');

        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.rejectedWith('', 'The executable was not found for FlawFinder, disabling linter');
    }

    @test('should handle parsing an invalid line')
    parsesUnknownLine() {
        let actual = this.linter['parseLine']('should not parse!')!;
        actual.should.have.property('parseError');
    }

    @test('should skip over excluded patterns')
    skipsOverExcludedPatterns() {
        let test = [
            `Examining git/test/test.c`,
            ``,
            `git/test/test.c:7:5:  [4] (buffer) sprintf:Does not check for buffer overflows (CWE-120).  Use sprintf_s, snprintf, or vsnprintf.`
        ];
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(1);

        let result = actual.pop()!;

        result.should.have.property('fileName', 'git/test/test.c');
        result.should.have.property('line', 6);
        result.should.have.property('column', 4);
        result.should.have.property('severity', 'Warning');
        result.should.have.property('code', '(buffer) sprintf');
        expect(result['message']).to.match(/^Does not check for buffer overflows/);
    }
}
