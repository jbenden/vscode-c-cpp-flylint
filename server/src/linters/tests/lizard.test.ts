import { slow, suite, test, timeout } from '@testdeck/mocha';
import { expect } from 'chai';
import * as _ from 'lodash';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { Settings } from '../../settings';
import { Lizard } from '../lizard';
import { before, after, defaultConfig } from './test_helpers';

@suite(timeout(3000), slow(1000))
export class LizardTests {
    private config: Settings;
    private linter: Lizard;

    public static before() {
        before();
    }

    public static after() {
        after();
    }

    constructor() {
        this.config = _.cloneDeep(defaultConfig);
        this.linter = new Lizard(this.config, process.cwd());
    }

    @test('should find the Lizard executable linter')
    executableIsFound() {
        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.fulfilled;
    }

    @test('should not find a missing executable linter')
    executableIsNotFound() {
        this.linter['setExecutable']('nonexistent');

        var result = this.linter['maybeEnable']();
        return result.should.eventually.be.rejectedWith('', 'The executable was not found for Lizard, disabling linter');
    }

    @test('should handle parsing an invalid line')
    parsesUnknownLine() {
        let actual = this.linter['parseLine']('should not parse!')!;
        actual.should.have.property('parseError');
    }

    @test('should parse a multi-line message')
    parsesMultiLine() {
        let test = [
            '',
            'agast_score.cpp:96: warning: cv::agast_cornerScore<AgastFeatureDetector::OAST_9_16> has 2066 NLOC, 688 CCN, 9184 token, 3 PARAM, 2072 length',
            'agast_score.cpp:2171: warning: cv::agast_cornerScore<AgastFeatureDetector::AGAST_7_12d> has 1203 NLOC, 394 CCN, 5318 token, 3 PARAM, 1209 length',
            'agast_score.cpp:3383: warning: cv::agast_cornerScore<AgastFeatureDetector::AGAST_7_12s> has 5625 NLOC, 1868 CCN, 24480 token, 3 PARAM, 5631 length',
            'agast_score.cpp:9017: warning: cv::agast_cornerScore<AgastFeatureDetector::AGAST_5_8> has 353 NLOC, 112 CCN, 1608 token, 3 PARAM, 359 length'
        ];
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(4);

        let result = actual.pop()!;

        result.should.have.property('fileName', 'agast_score.cpp');
        result.should.have.property('line', 9016);
        result.should.have.property('column', 0);
        result.should.have.property('severity', DiagnosticSeverity.Warning);
        result.should.have.property('code', 'Cyclomatic complexity');
        expect(result['message']).to.match(/^cv::agast_cornerScore<AgastFeatureDetector/);
    }
}
