# C/C++ Advanced Lint for VS Code

[![Version](https://vsmarketplacebadge.apphb.com/version-short/jbenden.c-cpp-flylint.svg)](https://marketplace.visualstudio.com/items?itemName=jbenden.c-cpp-flylint)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/jbenden.c-cpp-flylint.svg)](https://marketplace.visualstudio.com/items?itemName=jbenden.c-cpp-flylint)
[![Rating](https://vsmarketplacebadge.apphb.com/rating-short/jbenden.c-cpp-flylint.svg)](https://marketplace.visualstudio.com/items?itemName=jbenden.c-cpp-flylint)
[![Build Status](https://github.com/jbenden/vscode-c-cpp-flylint/workflows/CI/badge.svg?branch=master)](https://github.com/jbenden/vscode-c-cpp-flylint/actions)
[![Code Climate](https://codeclimate.com/github/jbenden/vscode-c-cpp-flylint/badges/gpa.svg)](https://codeclimate.com/github/jbenden/vscode-c-cpp-flylint)

A [Visual Studio Code](https://code.visualstudio.com/) extension
supporting a number of static code analyzers for C and C++ code.

## Features

* On-the-fly linting within the code editor, upon file save or after
  file edits.
* Automatically finds available static analysis tools.
* Easily supports additional static analyzers with minimum
  development effort.

## Supported Static Analyzers

* [Clang](https://clang.llvm.org/)
* [CppCheck](http://cppcheck.sourceforge.net/)
* [FlawFinder](https://dwheeler.com/flawfinder/)
* [PC-lint Plus](https://gimpel.com/)
* [Flexelint](http://www.gimpel.com/html/flex.htm) or
  [PC-lint](http://www.gimpel.com/html/pcl.htm)

## Requirements

At least one of the above static code analyzers must be installed
on your machine(s).

The extension should support any versions of the listed static code
analyzers; and will attempt to locate them within your `PATH`
environment variable.

If a tool is not automatically found, the appropriate
`c-cpp-flylint.*.executable` configuration must be specified manually.

### Windows

Windows users may download and install the static code analyzers
from the listed URLs mentioned elsewhere in this documentation.

If PC-lint has been installed, be certain to use the `Flexelint`
configuration sections, specifying the full path and filename
of PC-lint as the `c-cpp-flylint.flexelint.executable`
configuration option.

### Debian & Ubuntu

Clang is available via `apt-get`:

    # sudo apt-get install clang

CppCheck is available via `apt-get`:

    # sudo apt-get install cppcheck

Flexelint is commercial software; however, it may be obtained from
the URL mentioned elsewhere in this documentation.

PC-lint and PC-lint Plus are commercial software; however, they may
be obtained from the URL mentioned elsewhere in this documentation.

FlawFinder is available via `pip`:

    # sudo pip install flawfinder

### macOS

For macOS users, Clang is already included when Xcode and its' CLI
tools are installed.

For macOS users, CppCheck can most easily be installed through
[Homebrew](https://brew.sh/).

    # brew install cppcheck

Flexelint is commercial software; however, it may be obtained from
the URL mentioned elsewhere in this documentation.

PC-lint and PC-lint Plus are commercial software; however, they may
be obtained from the URL mentioned elsewhere in this documentation.

## Configuration Settings

Due to the large quantity of configuration options -- in tandem with the
ever growing number of supported static code analyzers -- all
configuration options are not documented here.

However, every configuration option is well documented within
**File** -> **Preferences** -> **Settings** [alternatively, one of the
keybindings: `Command+,` or `Ctrl+,`].

## Development Setup

* run `npm install` inside the project root

### Developing the Server

* open VS Code rooted inside the project root.
* run `cd server && npm run test && cd ..` to execute the unit-tests for all linters.
* run `npm run compile` or `npm run watch` to build the server
  and it will compile it into the `client/out` folder.
* to debug press F5 which attaches a debugger to the server.

### Developing the Extension/Client

* open VS Code rooted inside the project root.
* run F5 to build and debug the whole (client with the
  server) extension.

## Project details

Both the source code and issue tracker are hosted at
[GitHub](https://github.com/jbenden/vscode-c-cpp-flylint/).

For support purposes, please visit the above URL and select
from the Issue and/or Pull Request areas.

## License

Copyright (C) 2017-2021 [Joseph Benden](mailto:joe@benden.us).

Licensed under the [MIT License](https://opensource.org/licenses/MIT).
