import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { slow, suite, test, timeout } from 'mocha';
import * as mock from 'mock-fs';
import * as _ from "lodash";
import { Settings, IConfiguration, IConfigurations, propertiesPlatform } from '../../settings';
import { Clang } from '../clang';
import { getCppProperties } from '../../server';
import { before, after, isWindows, defaultConfig } from './test_helpers';
import * as chai from 'chai';

@suite(timeout(3000), slow(1000))
class CcppPropertiesTests {
    private config: Settings;
    private linter: Clang;

    @test("should find the fixture file")
    findsFixtureFile() {
        var propertiesData : IConfigurations = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../server/src/linters/tests/c_cpp_properties.json'), 'utf8'));

        const config = propertiesData.configurations.find(el => el.name == propertiesPlatform());

        chai.should().exist(config);
        config!.should.have.property('includePath');
    }

    @test("should handle globbed includePath")
    handleGlobbedIncludePath() {
        const filename = path.resolve(__dirname, '../../../../server/src/linters/tests/c_cpp_properties-glob.json');
        const config : Settings = getCppProperties(filename, _.cloneDeep(defaultConfig), __dirname);

        chai.should().exist(config);
        chai.expect(config!['c-cpp-flylint'].includePaths[0]).to.not.match(/\/\*\*/);
        chai.expect(config!['c-cpp-flylint'].includePaths).to.not.be.empty;
        chai.expect(config!['c-cpp-flylint'].includePaths).lengthOf.above(2);
        _.forEach(config!['c-cpp-flylint'].includePaths, (path) => {
            chai.expect(path).to.not.match(/\/\*\*/);
        });
    }
}
