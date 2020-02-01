import * as assert from 'assert';
import { slow, suite, test, timeout } from 'mocha-typescript';
import { expect } from 'chai';
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
        return result.should.eventually.be.rejectedWith('', 'The executable was not found for CppCheck, disabling linter');
    }

    @test("should build a proper command-line for a C++ source file")
    commandLine() {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        var actual = this.linter['buildCommandLine']("main.cc", "main.cc");
        actual.should.have.length(8);
    }

    @test("should build a proper command-line for a C++ header file")
    commandLineWithHeaderFile() {
        var actual = this.linter['buildCommandLine']("main.h", "main.h");
        actual.should.have.length(8);
    }

    @test("should handle parsing an invalid line")
    parsesUnknownLine() {
        let actual = this.linter['parseLine']('should not parse!');
        actual.should.have.property('parseError');
    }

    @test("should skip over excluded patterns")
    skipsOverExcludedPatterns() {
        let test = [
            'Defines: CURRENT_DEVICE_VERSION=1;BIG_VERSION=1;LITTLE_VERSION=1;CURRENT_DEVICE_GROUP=1;CURRENT_DEVICE_SLEEP_TYPE=1;CURRENT_ABILITY_1BYTE=1;CURRENT_ABILITY_2BYTE=1;CURRENT_ABILITY_3BYTE=1;CURRENT_ABILITY_4BYTE=1;CLASS=1;CLASS_B=1;CLASS_C=1;IF_UD_RELAY=1;PRIu32="u";PRIx32="x";PRIX32="X";PRIXX32="X";NETSTACK_CONF_WITH_IPV6=1',
            'Includes: -I/Users/username/Documents/Unwired/contiki_ud_ng/ -I/Users/username/Documents/Unwired/contiki_ud_ng/lib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/dev/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/sys/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/net/ip/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/net/ipv6/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/asuno-light/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/smarthome/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/common/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/cc26xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/cc13xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/dev/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/driverlib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/driverlib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/inc/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/inc/ -I/Users/username/Documents/Unwired/contiki_ud_ng/apps/serial-shell/ -I/Users/username/Documents/Unwired/contiki_ud_ng/apps/shell/ -I/usr/local/lib/gcc/arm-none-eabi/6.2.1/include/',
            'Platform:Native',
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
            `    information missingInclude: Cppcheck cannot find all the include files (use --check-config for details)`,
        ];
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(1);

        let result = actual.pop();

        result.should.have.property('fileName', 'flist.c');
        result.should.have.property('line', 2836);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Information');
        result.should.have.property('code', "unusedStructMember");
        expect(result['message']).to.match(/^struct member \'Anonymous5::name_space\' is never used\./);
    }

    @test("should correctly handle quoted lines")
    handleQuotedLines() {
        let test = [
            '"Defines: CURRENT_DEVICE_VERSION=1;BIG_VERSION=1;LITTLE_VERSION=1;CURRENT_DEVICE_GROUP=1;CURRENT_DEVICE_SLEEP_TYPE=1;CURRENT_ABILITY_1BYTE=1;CURRENT_ABILITY_2BYTE=1;CURRENT_ABILITY_3BYTE=1;CURRENT_ABILITY_4BYTE=1;CLASS=1;CLASS_B=1;CLASS_C=1;IF_UD_RELAY=1;PRIu32="u";PRIx32="x";PRIX32="X";PRIXX32="X";NETSTACK_CONF_WITH_IPV6=1"',
            '"Includes: -I/Users/username/Documents/Unwired/contiki_ud_ng/ -I/Users/username/Documents/Unwired/contiki_ud_ng/lib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/dev/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/sys/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/net/ip/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/net/ipv6/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/asuno-light/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/smarthome/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/common/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/cc26xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/cc13xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/dev/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/driverlib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/driverlib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/inc/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/inc/ -I/Users/username/Documents/Unwired/contiki_ud_ng/apps/serial-shell/ -I/Users/username/Documents/Unwired/contiki_ud_ng/apps/shell/ -I/usr/local/lib/gcc/arm-none-eabi/6.2.1/include/"',
            '"Platform:Native"',
            `"Checking flist.c: _WIN32..."`,
            `"Checking flist.c: _WIN32;__CYGWIN__..."`,
            `"Checking flist.c: __GNUC__..."`,
            `"Checking flist.c: __i386__;__i486__;__i586__;__i686__..."`,
            `"flist.c  2837  style unusedStructMember: struct member 'Anonymous5::name_space' is never used."`,
            `"Checking flist.c: freeaddrinfo..."`,
            `"Checking flist.c: gai_strerror..."`,
            `"Checking flist.c: getaddrinfo..."`,
            `"Checking flist.c: getnameinfo..."`,
            `"Checking flist.c: iconv_t..."`,
            `"    information missingIncludeSystem: Cppcheck cannot find all the include files (use --check-config for details)"`,
            `"    information missingInclude: Cppcheck cannot find all the include files (use --check-config for details)"`,
        ];
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(1);

        let result = actual.pop();

        result.should.have.property('fileName', 'flist.c');
        result.should.have.property('line', 2836);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Information');
        result.should.have.property('code', "unusedStructMember");
        expect(result['message']).to.match(/^struct member \'Anonymous5::name_space\' is never used\./);
    }

    @test("Should handle output from misra addon")
    handleMisra() {
        let test = [
            'Defines: CURRENT_DEVICE_VERSION=1;BIG_VERSION=1;LITTLE_VERSION=1;CURRENT_DEVICE_GROUP=1;CURRENT_DEVICE_SLEEP_TYPE=1;CURRENT_ABILITY_1BYTE=1;CURRENT_ABILITY_2BYTE=1;CURRENT_ABILITY_3BYTE=1;CURRENT_ABILITY_4BYTE=1;CLASS=1;CLASS_B=1;CLASS_C=1;IF_UD_RELAY=1;PRIu32="u";PRIx32="x";PRIX32="X";PRIXX32="X";NETSTACK_CONF_WITH_IPV6=1',
            'Includes: -I/Users/username/Documents/Unwired/contiki_ud_ng/ -I/Users/username/Documents/Unwired/contiki_ud_ng/lib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/dev/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/sys/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/net/ip/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/net/ipv6/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/asuno-light/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/smarthome/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/common/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/cc26xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/cc13xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/dev/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/driverlib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/driverlib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/inc/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/inc/ -I/Users/username/Documents/Unwired/contiki_ud_ng/apps/serial-shell/ -I/Users/username/Documents/Unwired/contiki_ud_ng/apps/shell/ -I/usr/local/lib/gcc/arm-none-eabi/6.2.1/include/',
            'Platform:Native',
            `"Checking flist.c ..."`,
            `"flist.c  9  style misra-c2012-10.4: misra violation (use --rule-texts=<file> to get proper output)"`,
            `"flist.c  11  style misra-c2012-17.7: misra violation (use --rule-texts=<file> to get proper output)"`,
            `"flist.c  20  style misra-c2012-18.8: misra violation (use --rule-texts=<file> to get proper output)"`,
            `"flist.c  1  style misra-c2012-21.6: misra violation (use --rule-texts=<file> to get proper output)"`,    
            `"    information missingIncludeSystem: Cppcheck cannot find all the include files (use --check-config for details)"`,
            `"    information missingInclude: Cppcheck cannot find all the include files (use --check-config for details)"`,
        ];
        let actual = this.linter['parseLines'](test);

        actual.should.have.length(4);

        let result = actual.pop();

        result.should.have.property('fileName', 'flist.c');
        result.should.have.property('line', 1 - 1);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Information');
        result.should.have.property('code', "misra-c2012-21.6");
        expect(result['message']).to.equal('misra violation (use --rule-texts=<file> to get proper output)');

        result = actual.pop();

        result.should.have.property('fileName', 'flist.c');
        result.should.have.property('line', 20 - 1);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Information');
        result.should.have.property('code', "misra-c2012-18.8");
        expect(result['message']).to.equal('misra violation (use --rule-texts=<file> to get proper output)');

        result = actual.pop();

        result.should.have.property('fileName', 'flist.c');
        result.should.have.property('line', 11 - 1);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Information');
        result.should.have.property('code', "misra-c2012-17.7");
        expect(result['message']).to.equal('misra violation (use --rule-texts=<file> to get proper output)');

        result = actual.pop();

        result.should.have.property('fileName', 'flist.c');
        result.should.have.property('line', 9 - 1);
        result.should.have.property('column', 0);
        result.should.have.property('severity', 'Information');
        result.should.have.property('code', "misra-c2012-10.4");
        expect(result['message']).to.equal('misra violation (use --rule-texts=<file> to get proper output)');
    }
}
