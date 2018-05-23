import * as mock from 'mock-fs';

export const isWindows = process.platform === 'win32' ||
    process.env.OSTYPE === 'cygwin' ||
    process.env.OSTYPE === 'msys'

export const defaultConfig = {
    'c-cpp-flylint': {
        enable: true,
        debug: false,
        run: "onSave",

        // common options, which may be overridden per syntax analyzer
        standard: ["c99"],
        includePaths: [],
        defines: [],
        undefines: [],
        language: "c",

        flexelint: {
            enable: true,
            // executable: "C:\\Source\\flexelint\\src\\flexelint.exe",
            executable: (isWindows ? "flexelint.exe" : "flexelint"),
            configFile: "tsconfig.json",
            headerArgs: [
                "-e750",
                "-e751",
                "-e752",
                "-e753",
                "-e754",
                "-e1526",
                "-e1714"
            ],
            severityLevels: {
                Error: 'Error',
                Warning: 'Warning',
                Info: 'Information',
                Note: 'Hint'
            }
        },
        cppcheck: {
            enable: true,
            executable: (isWindows ? "cppcheck.exe" : "cppcheck"),
            configFile: ".clang_complete",
            unusedFunctions: false,
            verbose: false,
            force: false,
            inconclusive: false,
            platform: "native",
            standard: null,
            includePaths: null,
            defines: null,
            undefines: null,
            suppressions: [],
            language: null,
            severityLevels: {
                "error": "Error",
                "warning": "Warning",
                "style": "Information",
                "performance": "Warning",
                "portability": "Warning",
                "information": "Information"
            }
        },
        clang: {
            enable: true,
            executable: (isWindows ? "clang.exe" : "clang"),
            configFile: ".clang_complete",
            severityLevels: {
                "error": "Error",
                "fatal": "Error",
                "warning": "Warning",
                "note": "Information"
            },

            // common options, which may be overridden per syntax analyzer
            standard: null,
            includePaths: null,
            defines: null,
            undefines: null,
            language: null,

            // special options
            extraArgs: null,
            warnings: ['all', 'extra', 'everything'],
            pedantic: false,
            pedanticErrors: false,
            msExtensions: false,
            noExceptions: true,
            noRtti: true,
            blocks: true,
            includes: null,
            standardLibs: null
        }
    }
};

export function before() {
    let chai = require("chai");
    let chaiAsPromised = require("chai-as-promised");

    chai.use(chaiAsPromised);
    chai.should();

    let ourDir = process.cwd();

    mock({
        ".clang_complete": 'text content',

        "tsconfig.json": 'text content',

        // fake EXE for Windows users
        'flexelint.exe': mock.file({
            content: 'I MISS DOS...',
            mode: 0o755
        }),

        // fake binary for non-Windows users
        'flexelint': mock.file({
            content: '#!/usr/bin/env bash\n\nexit 0\n',
            mode: 0o755
        }),

        // fake EXE for Windows users
        'cppcheck.exe': mock.file({
            content: 'I MISS DOS...',
            mode: 0o755
        }),

        // fake binary for non-Windows users
        'cppcheck': mock.file({
            content: '#!/usr/bin/env bash\n\nexit 0\n',
            mode: 0o755
        }),

        // fake EXE for Windows users
        'clang.exe': mock.file({
            content: 'I MISS DOS...',
            mode: 0o755
        }),

        // fake binary for non-Windows users
        'clang': mock.file({
            content: '#!/usr/bin/env bash\n\nexit 0\n',
            mode: 0o755
        })
    })
}

export function after() {
    mock.restore();
}
