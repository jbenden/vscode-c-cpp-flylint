# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

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
