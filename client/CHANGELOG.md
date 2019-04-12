# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.2.4] - 2019-04-12

### Changed

- Separate the LSP Client's display name from the one internally
  used. Fixes #55.

## [1.2.3] - 2019-04-05

### Changed

- Ignore `input unused` from Clang. Fixes #54.
- Add glob support for `c_cpp_properties.json`, when processing the
  include paths. Fixes #53.

## [1.2.2] - 2019-03-11

### Changed

- Removed whitespace around regexp to fix verbose mode. Fixes #48.

## [1.2.1] - 2019-03-09

### Changed

- Removed whitespace around regexp to fix verbose mode. Fixes #48.

## [1.2.0] - 2018-08-10

### Changed

- Updated project to Node version 8.
- Clang: Ignore line containing "incompatible with". Fixes #46.

## [1.1.1] - 2018-05-28

### Added

- Added option to ignore parse errors. PR #42 and
  fixes #41.

### Changed

- CppCheck: Fixed parse error thrown for missing includes.
  Fixes #44.
- Fixed bug related to analyzer output being wrapped
  in quotes. Fixes #43.

## [1.1.0] - 2018-05-25

### Added

- Multiple folder workspaces, are now supported.

### Changed

- Added debounce delay for incoming document changes to trigger
  a reanalysis, when "onType" setting is configured. Fixes #39.
- Fixed incorrect logic in determining when to run an analysis.
- Fixed issues relating to live configuration changes not
  instantly being reflected in analysis.
- Added "workspaceFolder" variable substitution. Fixes #38.
- Show notification when a parser is unable to parse an analyzer's
  tooling output.

### Miscellaneous

- Publish VSIX files to project GitHub Releases page, during
  successful CI runs.
- Fixed development workflow.
- Fixed documentation.

## [1.0.1] - 2018-05-23

### Changed

- Fixed project icon location.

## [1.0.0] - 2018-05-23

### Changed

- Upgraded all NPM module dependencies.
- Fixed developer workflow.
- Fixed README.md to reflect the new development workflow.
- Minor fixes.

## [0.6.1] - 2018-05-23

### Changed

- Upgraded the dependency `cross-spawn` to better support shell
  escapes on Windows.

## [0.6.0] - 2018-03-30

### Added

- Added the ability to exclude certain paths within your workspace
  from any analysis diagnostics. Fixes #33

## [0.5.7] - 2018-03-29

### Changed

- CppCheck: Add `avr8` platform support.

## [0.5.6] - 2018-03-08

### Changed

- CppCheck will now honor any inline suppressions within the user's
  source code.
- Only report diagnostics on files belonging to the workspace root.
- Added GitHub issues URL to README file.

## [0.5.5] - 2018-02-28

### Changed

- Remove all diagnostics before resending them from the server-side
  to VS Code.
- Fix TypeScript 2.7 "possibly undefined" build error. GH #29.
- Fix cppcheck "missingInclude" error. GH #29.
- Fix Windows diagnostics file URI generation. GH #29.
- Updated Node module project dependencies.

## [0.5.4] - 2017-11-11

### Changed

- Fixes broken 0.5.3 release. Oops!

## [0.5.3] - 2017-11-11

### Changed

- Clang: skip over all Qt macros which are prefixed with `Q_`.
  Fixes #22.

## [0.5.1] - 2017-10-20

### Changed

- CppCheck: skip over known verbose outputs. Fixes #19.

## [0.5.0] - 2017-10-17

### Changed

- Minor change to the way command executions are shown, to enable easier
  copy and paste to a terminal for debugging analyses.

### Added

- Now supports reading include paths and defines from a workspace
  `c_cpp_properties.json` file. These settings cascade to all analyzers,
  and are only set when no manual configuration of these two settings
  have taken place.

## [0.4.3] - 2017-10-16

### Changed

- All of the linters will now perform an analysis according to their
  supported capabilities and the current `c-cpp-flylint.run` setting.
  This change reduces the total number of linter executions, when the
  setting is `onType` and multiple analyzers are enabled; as only
  Clang supports `onType` currently.

## [0.4.2] - 2017-10-16

### Changed

- Clear previous errors when no further exist. Fixes #17

## [0.4.1] - 2017-10-15

### Changed

- Fixes cleared diagnostics upon file close. For more information on
  this fix, see bug report #16.

## [0.4.0] - 2017-10-15

### Changed

- Reworked all analyzers to report problems potentially spanning multiple
  source code files.
- Ensure all analyzer reports are merged and sent to the editor, to keep
  VS Code from dropping an analyzer's analysis.
- Clang: use actual source code file, when "onSave".
- Updated all NPM dependencies to their latest versions.

### Added

## [0.3.1] - 2017-10-14

### Changed

- Fix mangled naming shown with Clang diagnostics. Fixes #13.

### Added

## [0.3.0] - 2017-10-14

### Changed

- Fixed nested Clang analyzer diagnostics.

### Added

- Fixed onType Clang analyzer mode.

## [0.2.7] - 2017-09-04

### Changed

- Fixed possible array out-of-bounds.

### Added

## [0.2.6] - 2017-09-04

### Changed

- Ensure document line access is within range and safely recalculate the
  start and end columns. Fixes #10.
- Flexelint now returns the 0th column, for consistency with the other
  analyzers visual display within open documents.

### Added

## [0.2.5] - 2017-08-23

### Changed

- Handle Clang's `extraArgs` parameter. Fixes #7.

### Added

## [0.2.4] - 2017-08-23

### Changed

- Do not throw error messages with non-local files. Fixes #5.
- Switch to cross-spawn NPM module to work-around numerous issues
  with Node.js's child_process.spawn functions on Windows.
  Fixes #9.

## [0.2.3] - 2017-07-05

### Added

### Changed

- Fixed crash when opening a single file not under an opened
  workspace or when no file URI to a disk-based file exists.
  Fixes #3

## [0.2.2] - 2017-07-04

### Added

### Changed

- Always analyze file upon save. Fixes #2

## [0.2.1] - 2017-06-29

### Added

- Added flag for determining if analyzers were originally enabled.

### Changed

- Resolve disabled analyzers reporting errors at start-up. Resolves #1

## [0.2.0] - 2017-06-24

### Added

- Clang static code analyzer has been added.

### Changed

- Display an informational message when a given analyzer is unable to
  activate due to missing binary or configuration file.
- Fixed a bug where the cascade of settings did not function as expected.
- Improve generic error message: added a note to check the console
  output.
- Erroneously misunderstood how the `which` NPM module functioned. Non-
  Windows users may have experienced a bug in the analyzer executable
  detection logic. This has been resolved.
- Ensures newly opened C/C++ source code files are scanned.
- Corrects an off-by-one error with the parsing of analyzer output.

## [0.1.0] - 2017-06-19

### Added

- Added a command to force the analysis of the current document.
- Added a command to force the analysis of all opened documents within the
  workspace.
- A change log to quickly view an overview of the changes made to each version
  of the extension.
- Added flag to enable verbose debug logging. This was previously the default
  mode of operation.
- Refactored the most typical options, common between analyzers, to a common
  base configuration set. The base configuration set will cascade to all
  analyzers, by default.

### Changed

- Fixed duplicate analyzers being ran after configuration change.
- Redefined how the `c-cpp-flylint.run` configuration option functions.
- Always ensure a starting column is selected, even if RegExp fails.

## [0.0.1] - 2017-06-18

- Initial release.
