import { cloneDeep } from 'lodash';
import { basename } from 'path';
import { Clang } from '../../server/src/linters/clang';
import { CppCheck } from '../../server/src/linters/cppcheck';
import { FlawFinder } from '../../server/src/linters/flawfinder';
import { Flexelint } from '../../server/src/linters/flexelint';
import { Linter } from '../../server/src/linters/linter';
import { Lizard } from '../../server/src/linters/lizard';
import { PclintPlus } from '../../server/src/linters/pclintplus';
import { Settings } from '../../server/src/settings';
import { defaultConfig } from '../mock-config';
import { injectMockFileSystem } from '../mock-fs';

describe('Analyser executables', () => {
    injectMockFileSystem();

    var config: Settings;
    var linter: Linter;

    describe.each([
        {
            formal_name: 'Clang',
            binary_name: 'clang',
            claz: (c: Settings, p: string) => { return new Clang(c, p); }
        }, {
            formal_name: 'CppCheck',
            binary_name: 'cppcheck',
            claz: (c: Settings, p: string) => { return new CppCheck(c, p); }
        }, {
            formal_name: 'FlawFinder',
            binary_name: 'flawfinder',
            claz: (c: Settings, p: string) => { return new FlawFinder(c, p); }
        }, {
            formal_name: 'Flexelint',
            binary_name: 'flexelint',
            claz: (c: Settings, p: string) => { return new Flexelint(c, p); }
        }, {
            formal_name: 'Lizard',
            binary_name: 'lizard',
            claz: (c: Settings, p: string) => { return new Lizard(c, p); }
        }, {
            formal_name: 'PclintPlus',
            binary_name: 'pclp',
            claz: (c: Settings, p: string) => { return new PclintPlus(c, p); }
        }
    ])('.analyser($formal_name, $binary_name)', ({ formal_name, binary_name, claz }) => {

        beforeEach(() => {
            config = cloneDeep(defaultConfig);
            linter = claz(config, process.cwd());
        });

        test(`should find the actual ${formal_name} executable`, async () => {
            await linter['maybeEnable']();

            // access private member variable via JavaScript property access.
            const exe = basename(linter['executable']);

            expect(linter.isActive()).toBeTruthy();
            expect(exe).toBe(binary_name);
        });

        test(`should NOT find a missing ${formal_name} executable`, async () => {
            // GIVEN
            linter['setExecutable']('non-existent');

            // WHEN
            await linter['maybeEnable']()
                // THEN
                .then(() => {
                    fail(new Error('Should not have gotten a result value'));
                })
                .catch((e: Error) => {
                    expect(e.message).toEqual(`The executable was not found for ${formal_name}, disabling linter`);
                });
        });
    });
});
