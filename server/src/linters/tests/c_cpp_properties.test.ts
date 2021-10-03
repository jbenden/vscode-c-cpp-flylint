import * as fs from 'fs';
import * as path from 'path';
import { slow, suite, test, timeout } from '@testdeck/mocha';
import * as _ from 'lodash';
import { Settings, IConfigurations, propertiesPlatform } from '../../settings';
import { getCppProperties } from '../../server';
import { defaultConfig } from './test_helpers';
import * as chai from 'chai';

@suite(timeout(3000), slow(1000))
export class CcppPropertiesTests {
    @test('should find the fixture file')
    findsFixtureFile() {
        var propertiesData : IConfigurations = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../server/src/linters/tests/c_cpp_properties.json'), 'utf8'));

        const config = propertiesData.configurations.find(el => el.name === propertiesPlatform());

        chai.should().exist(config);
        config!.should.have.property('includePath');
    }

    @test('should handle globbed includePath')
    async handleGlobbedIncludePath() {
        const filename = path.resolve(__dirname, '../../../../server/src/linters/tests/c_cpp_properties-glob.json');
        const config : Settings = await getCppProperties(filename, _.cloneDeep(defaultConfig), __dirname);

        chai.should().exist(config);
        chai.expect(config!['c-cpp-flylint'].includePaths[0]).to.not.match(/\/\*\*/);
        chai.expect(config!['c-cpp-flylint'].includePaths).to.not.be.empty;
        chai.expect(config!['c-cpp-flylint'].includePaths).lengthOf.above(2);
        _.forEach(config!['c-cpp-flylint'].includePaths, (path) => {
            chai.expect(path).to.not.match(/\/\*\*/);
        });
    }
}
