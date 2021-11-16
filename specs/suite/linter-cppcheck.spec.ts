import { cloneDeep } from 'lodash';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { CppCheck } from '../../server/src/linters/cppcheck';
import { Linter } from '../../server/src/linters/linter';
import { Settings } from '../../server/src/settings';
import { defaultConfig } from '../mock-config';
import { injectMockFileSystem } from '../mock-fs';

describe('CppCheck parser', () => {
    injectMockFileSystem();

    var config: Settings;
    var linter: Linter;

    beforeEach(() => {
        config = cloneDeep(defaultConfig);
        linter = new CppCheck(config, process.cwd());
    });

    test('should build a proper command-line for a C++ source file', () => {
        // this method call syntax permits protected/private method calling; due to JavaScript.
        const actual = linter['buildCommandLine']('main.cc', 'main.cc');
        expect(actual).toHaveLength(8);
    });

    test('should build a proper command-line for a C++ header file', () => {
        const actual = linter['buildCommandLine']('main.h', 'main.h');
        expect(actual).toHaveLength(8);
    });

    test('should handle parsing an invalid line', () => {
        const actual = linter['parseLine']('should not parse!')!;
        expect(actual).toHaveProperty('parseError');
    });

    test('should skip over excluded patterns', () => {
        const test = [
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
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(1);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 2836);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', 'unusedStructMember');
        expect(result['message']).toMatch(/^struct member \'Anonymous5::name_space\' is never used\./);
    });

    test('should correctly handle quoted lines', () => {
        const test = [
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
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(1);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 2836);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', 'unusedStructMember');
        expect(result['message']).toMatch(/^struct member \'Anonymous5::name_space\' is never used\./);
    });

    test('Should handle output from misra addon', () => {
        const test = [
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
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(4);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 1 - 1);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', 'misra-c2012-21.6');
        expect(result['message']).toBe('misra violation (use --rule-texts=<file> to get proper output)');

        result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 20 - 1);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', 'misra-c2012-18.8');
        expect(result['message']).toBe('misra violation (use --rule-texts=<file> to get proper output)');

        result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 11 - 1);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', 'misra-c2012-17.7');
        expect(result['message']).toBe('misra violation (use --rule-texts=<file> to get proper output)');

        result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 9 - 1);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', 'misra-c2012-10.4');
        expect(result['message']).toBe('misra violation (use --rule-texts=<file> to get proper output)');
    });

    test('Should find identical errors on different lines', () => {
        const test = [
            'Defines: CURRENT_DEVICE_VERSION=1;BIG_VERSION=1;LITTLE_VERSION=1;CURRENT_DEVICE_GROUP=1;CURRENT_DEVICE_SLEEP_TYPE=1;CURRENT_ABILITY_1BYTE=1;CURRENT_ABILITY_2BYTE=1;CURRENT_ABILITY_3BYTE=1;CURRENT_ABILITY_4BYTE=1;CLASS=1;CLASS_B=1;CLASS_C=1;IF_UD_RELAY=1;PRIu32="u";PRIx32="x";PRIX32="X";PRIXX32="X";NETSTACK_CONF_WITH_IPV6=1',
            'Includes: -I/Users/username/Documents/Unwired/contiki_ud_ng/ -I/Users/username/Documents/Unwired/contiki_ud_ng/lib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/dev/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/sys/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/net/ip/ -I/Users/username/Documents/Unwired/contiki_ud_ng/core/net/ipv6/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/asuno-light/ -I/Users/username/Documents/Unwired/contiki_ud_ng/unwired/smarthome/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/common/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/cc26xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/platform/unwired/udboards/cc13xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/dev/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/driverlib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/driverlib/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc13xxware/inc/ -I/Users/username/Documents/Unwired/contiki_ud_ng/cpu/cc26xx-cc13xx/lib/cc26xxware/inc/ -I/Users/username/Documents/Unwired/contiki_ud_ng/apps/serial-shell/ -I/Users/username/Documents/Unwired/contiki_ud_ng/apps/shell/ -I/usr/local/lib/gcc/arm-none-eabi/6.2.1/include/',
            'Platform:Native',
            `"Checking flist.c ..."`,
            `"flist.c  9  error zerodiv: Division by zero"`,
            `"flist.c  23  error zerodiv: Division by zero"`,
            `"flist.c  15  style misra-c2012-10.4: misra violation (use --rule-texts=<file> to get proper output)"`,
            `"flist.c  36  style misra-c2012-10.4: misra violation (use --rule-texts=<file> to get proper output)"`,
            `"    information missingIncludeSystem: Cppcheck cannot find all the include files (use --check-config for details)"`,
            `"    information missingInclude: Cppcheck cannot find all the include files (use --check-config for details)"`,
        ];
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(4);

        let result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 36 - 1);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', 'misra-c2012-10.4');
        expect(result['message']).toBe('misra violation (use --rule-texts=<file> to get proper output)');

        result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 15 - 1);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', 'misra-c2012-10.4');
        expect(result['message']).toBe('misra violation (use --rule-texts=<file> to get proper output)');

        result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 23 - 1);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Error);
        expect(result).toHaveProperty('code', 'zerodiv');
        expect(result['message']).toBe('Division by zero');

        result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'flist.c');
        expect(result).toHaveProperty('line', 9 - 1);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Error);
        expect(result).toHaveProperty('code', 'zerodiv');
        expect(result['message']).toBe('Division by zero');
    });

    test('should properly map missingOverride warnings', () => {
        const test = [
            `Checking example110.cpp ...`,
            `Checking example110.cpp: HAVE_CONFIG_H=1...`,
            `example110.cpp  6  style missingOverride: The function 'baz' overrides a function in a base class but is not marked with a 'override' specifier.`,
            `example110.cpp  2  style unusedFunction: The function 'baz' is never used.`,
        ];
        const actual = linter['parseLines'](test);

        expect(actual).toHaveLength(2);

        let result = actual.pop()!;
        result = actual.pop()!;

        expect(result).toHaveProperty('fileName', 'example110.cpp');
        expect(result).toHaveProperty('line', 5);
        expect(result).toHaveProperty('column', 0);
        expect(result).toHaveProperty('severity', DiagnosticSeverity.Information);
        expect(result).toHaveProperty('code', 'missingOverride');
        expect(result['message']).toMatch(/^The function \'baz\' overrides a function in a base class/);
    });
});
