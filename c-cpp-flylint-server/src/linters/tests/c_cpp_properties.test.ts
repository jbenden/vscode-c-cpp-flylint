import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { slow, suite, test, timeout } from 'mocha-typescript';
import * as mock from 'mock-fs';
import * as _ from "lodash";
import { Settings, IConfiguration, IConfigurations, propertiesPlatform } from '../../settings';
import { Clang } from '../clang';
import { before, after, isWindows, defaultConfig } from './test_helpers';
import * as chai from 'chai';

@suite(timeout(3000), slow(1000))
class CcppPropertiesTests {
    private config: Settings;
    private linter: Clang;

    @test("should find the fixture file")
    findsFixtureFile() {
        var propertiesData : IConfigurations = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../c-cpp-flylint-server/src/linters/tests/c_cpp_properties.json'), 'utf8'));

        const config = propertiesData.configurations.find(el => el.name == propertiesPlatform());

        chai.should().exist(config);
        config!.should.have.property('includePath');
    }
}
