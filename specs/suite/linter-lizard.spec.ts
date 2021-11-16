import { cloneDeep } from 'lodash';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { Linter } from '../../server/src/linters/linter';
import { Lizard } from '../../server/src/linters/lizard';
import { Settings } from '../../server/src/settings';
import { defaultConfig } from '../mock-config';
import { injectMockFileSystem } from '../mock-fs';

describe('Lizard parser', () => {
    injectMockFileSystem();

    var config: Settings;
    var linter: Linter;

    beforeEach(() => {
        config = cloneDeep(defaultConfig);
        linter = new Lizard(config, process.cwd());
    });

    test('should build a proper command-line for a C++ source file', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['buildCommandLine']('main.cc', 'main.cc');
        expect(actual).toHaveLength(3);
    });

    test('should build a proper command-line for a C++ header file', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['buildCommandLine']('main.h', 'main.h');
        expect(actual).toHaveLength(3);
    });

    test('should handle parsing an invalid line', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['parseLine']('should not parse!')!;
        expect(actual).toHaveProperty('parseError');
    });

    test('should parse a multi-line message', () => {
        const test = [
            '',
            'agast_score.cpp:96: warning: cv::agast_cornerScore<AgastFeatureDetector::OAST_9_16> has 2066 NLOC, 688 CCN, 9184 token, 3 PARAM, 2072 length',
            'agast_score.cpp:2171: warning: cv::agast_cornerScore<AgastFeatureDetector::AGAST_7_12d> has 1203 NLOC, 394 CCN, 5318 token, 3 PARAM, 1209 length',
            'agast_score.cpp:3383: warning: cv::agast_cornerScore<AgastFeatureDetector::AGAST_7_12s> has 5625 NLOC, 1868 CCN, 24480 token, 3 PARAM, 5631 length',
            'agast_score.cpp:9017: warning: cv::agast_cornerScore<AgastFeatureDetector::AGAST_5_8> has 353 NLOC, 112 CCN, 1608 token, 3 PARAM, 359 length'
        ];
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(4);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'agast_score.cpp');
        expect(result).toHaveProperty('line', 9016);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Warning);
        expect(result).toHaveProperty('code', 'Cyclomatic complexity');
        expect(result['message']).toMatch(/^cv::agast_cornerScore<AgastFeatureDetector/);
    });
});
