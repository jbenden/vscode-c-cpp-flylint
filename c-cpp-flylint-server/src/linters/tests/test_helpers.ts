import * as mock from 'mock-fs';

export const isWindows = process.platform === 'win32' ||
    process.env.OSTYPE === 'cygwin' ||
    process.env.OSTYPE === 'msys'

export const defaultConfig = {
    'c-cpp-flylint': {
        enable: true,
        run: "onSave",
        flexelint: {
            enable: false,
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
            enable: false,
            executable: (isWindows ? "cppcheck.exe" : "cppcheck"),
            configFile: ".clang_complete",
            unusedFunctions: false,
            verbose: false,
            force: false,
            inconclusive: false,
            platform: "native",
            standard: ["c99"],
            includePaths: [],
            defines: [],
            undefines: [],
            suppressions: [],
            language: "c",
            severityLevels: {
                "error": "Error",
                "warning": "Warning",
                "style": "Information",
                "performance": "Warning",
                "portability": "Warning",
                "information": "Information"
            }
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
        })
    })
}

export function after() {
    mock.restore();
}
