export type SeverityLevel = 'Error' | 'Warning' | 'Information' | 'Hint' | 'None';

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

// Settings as defined in VS Code.
export interface Settings {
    'c-cpp-flylint': {
        enable: boolean;
        debug: boolean;
        run: "onSave" | "onType";

        // common options, which may be overridden per syntax analyzer
        standard: string[];
        includePaths: string[];
        defines: string[];
        undefines: string[];
        language: "c" | "c++";

        flexelint: {
            enable: boolean;
            executable: string;
            configFile: string;
            headerArgs: string | string[];
            severityLevels: FlexelintSeverityMaps;
        }
        cppcheck: {
            enable: boolean;
            executable: string;
            configFile: string;
            unusedFunctions: boolean;
            verbose: boolean;
            force: boolean;
            inconclusive: boolean;
            platform: "unix32" | "unix64" | "win32A" | "win32W" | "win64" | "native";
            standard: string[] | null;
            includePaths: string[] | null;
            defines: string[] | null;
            undefines: string[] | null;
            suppressions: string[];
            language: "c" | "c++" | null;
            severityLevels: CppCheckSeverityMaps;
        }
    };
}
