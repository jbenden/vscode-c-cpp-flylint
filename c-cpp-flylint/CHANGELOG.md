# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

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
