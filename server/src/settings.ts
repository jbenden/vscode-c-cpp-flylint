// Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
//
// SPDX-License-Identifier: MIT

import * as _ from 'lodash';
import * as os from 'os';
import { DiagnosticSeverity } from 'vscode-languageserver/node';

export interface IConfiguration {
    name: string;
    includePath: string[];
    defines: string[];
}

export interface IConfigurations {
    configurations: IConfiguration[];
}

/* istanbul ignore next */
export function propertiesPlatform() {
    switch (os.platform()) {
        case 'darwin': return 'Mac';
        case 'linux': return 'Linux';
        case 'win32': return 'Win32';
        default:
            throw RangeError(`Unsupported operating system; no entry for ${os.platform()}`);
    }
}

export type SeverityLevel = DiagnosticSeverity | string;

export namespace VS_DiagnosticSeverity {
    /* istanbul ignore next */
    export function from(value: SeverityLevel): DiagnosticSeverity {
        if (_.isNumber(value)) {
            return value as DiagnosticSeverity;
        }

        if (!_.isString(value)) {
            throw TypeError(`The diagnostic code ${value} was neither a number nor string!`);
        }

        switch (value) {
            case 'Error': return DiagnosticSeverity.Error;
            case 'Warning': return DiagnosticSeverity.Warning;
            case 'Information': return DiagnosticSeverity.Information;
            case 'Hint': return DiagnosticSeverity.Hint;
            default:
                throw RangeError(`The diagnostic code ${value} has no mapping to DiagnosticSeverty.`);
        }
    }
}

export interface CppCheckSeverityMaps {
    error: SeverityLevel;
    warning: SeverityLevel;
    style: SeverityLevel;
    performance: SeverityLevel;
    portability: SeverityLevel;
    information: SeverityLevel;
}

export interface FlexelintSeverityMaps {
    Error: SeverityLevel;
    Warning: SeverityLevel;
    Info: SeverityLevel;
    Note: SeverityLevel;
}

export interface ClangSeverityMaps {
    fatal: SeverityLevel;
    error: SeverityLevel;
    warning: SeverityLevel;
    note: SeverityLevel;
}

export interface PclintPlusSeverityMaps {
    error: SeverityLevel;
    warning: SeverityLevel;
    info: SeverityLevel;
    note: SeverityLevel;
    supplemental: SeverityLevel;
}

export interface FlawFinderSeverityMaps {
    '0': SeverityLevel;
    '1': SeverityLevel;
    '2': SeverityLevel;
    '3': SeverityLevel;
    '4': SeverityLevel;
    '5': SeverityLevel;
}

export interface Settings {
    enable: boolean;
    debug: boolean;
    run: 'onSave' | 'onType' | 'onBuild';
    ignoreParseErrors: boolean;

    excludeFromWorkspacePaths: string[];

    // common options, which may be overridden per syntax analyzer
    standard: string[];
    includePaths: string[];
    defines: string[];
    undefines: string[];
    language: 'c' | 'c++';

    flexelint: {
        enable: boolean;
        executable: string;
        configFile: string;
        headerArgs: string | string[];
        severityLevels: FlexelintSeverityMaps;
    }
    pclintplus: {
        enable: boolean;
        executable: string;
        configFile: string;
        headerArgs: string | string[];
        severityLevels: PclintPlusSeverityMaps;
    }
    cppcheck: {
        enable: boolean;
        executable: string;
        configFile: string;
        unusedFunctions: boolean;
        verbose: boolean;
        force: boolean;
        inconclusive: boolean;
        platform: 'avr8' | 'unix32' | 'unix64' | 'win32A' | 'win32W' | 'win64' | 'native';
        standard: string[] | null;
        includePaths: string[] | null;
        defines: string[] | null;
        undefines: string[] | null;
        suppressions: string[];
        addons: string[];
        language: 'c' | 'c++' | null;
        severityLevels: CppCheckSeverityMaps;
        extraArgs: string[] | null;
    }
    clang: {
        enable: boolean;
        executable: string;
        configFile: string;
        severityLevels: ClangSeverityMaps;

        // common options, which may be overridden per syntax analyzer
        standard: string[];
        includePaths: string[];
        defines: string[];
        undefines: string[];
        language: 'c' | 'c++';

        // special options
        extraArgs: string[] | null;
        warnings: string[] | null;
        pedantic: boolean;
        pedanticErrors: boolean;
        msExtensions: boolean;
        noExceptions: boolean;
        noRtti: boolean;
        blocks: boolean;
        includes: string[] | null;
        standardLibs: string[] | null;
    }
    flawfinder: {
        enable: boolean;
        executable: string;
        severityLevels: FlawFinderSeverityMaps;
    }
    lizard: {
        enable: boolean;
        executable: string;
        extraArgs: string[] | null;
    }
}

// Settings as defined in VS Code.
export interface GlobalSettings {
    'c-cpp-flylint': Settings;
}
