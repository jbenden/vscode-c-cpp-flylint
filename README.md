<div>
<img src="C-Cpp-FlyLint_icon.png" style="display: inline;" align="right" width="128" height="128" />
<h1>C/C++ Advanced Lint for VS Code</h1>

<div>

[![Version](https://vsmarketplacebadge.apphb.com/version-short/jbenden.c-cpp-flylint.svg)](https://marketplace.visualstudio.com/items?itemName=jbenden.c-cpp-flylint)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/jbenden.c-cpp-flylint.svg)](https://marketplace.visualstudio.com/items?itemName=jbenden.c-cpp-flylint)
[![Rating](https://vsmarketplacebadge.apphb.com/rating-short/jbenden.c-cpp-flylint.svg)](https://marketplace.visualstudio.com/items?itemName=jbenden.c-cpp-flylint)
[![Build Status](https://github.com/jbenden/vscode-c-cpp-flylint/workflows/CI/badge.svg?branch=main)](https://github.com/jbenden/vscode-c-cpp-flylint/actions)
[![Code Climate](https://codeclimate.com/github/jbenden/vscode-c-cpp-flylint/badges/gpa.svg)](https://codeclimate.com/github/jbenden/vscode-c-cpp-flylint)

</div>

A [Visual Studio Code](https://code.visualstudio.com/) extension
supporting a number of static code analyzers for C and C++ code.

</div>

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
* [lizard](https://github.com/terryyin/lizard)

## Requirements

At least one of the above static code analyzers must be installed
on your machine(s).

The extension should support any versions of the listed static code
analyzers; and will attempt to locate them within your `PATH`
environment variable.

If a tool is not automatically found, the appropriate
`c-cpp-flylint.*.executable` configuration must be specified manually.

<details>
<summary>Debian & Ubuntu</summary>
<br>

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

lizard is available via `pip`:

    # sudo pip install lizard

</details>

<details>
<summary>macOS</summary>
<br>

For macOS users, Clang is already included when Xcode and its' CLI
tools are installed.

For macOS users, CppCheck can most easily be installed through
[Homebrew](https://brew.sh/).

    # brew install cppcheck

Flexelint is commercial software; however, it may be obtained from
the URL mentioned elsewhere in this documentation.

PC-lint and PC-lint Plus are commercial software; however, they may
be obtained from the URL mentioned elsewhere in this documentation.

</details>

<details>
<summary>Windows</summary>
<br>

Windows users may download and install the static code analyzers
from the listed URLs mentioned elsewhere in this documentation.

If PC-lint has been installed, be certain to use the `Flexelint`
configuration sections, specifying the full path and filename
of PC-lint as the `c-cpp-flylint.flexelint.executable`
configuration option.

</details>

## Usage

Once all requirements are met, the extension may be installed through
one of the available marketplaces:

* [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jbenden.c-cpp-flylint)
* [Open-VSX](https://open-vsx.org/extension/jbenden/c-cpp-flylint)

After the extension is installed, one must then decide on how to best
implement the necessary configuration changes to best meet their project
and/or environment needs. For instance, would `cppcheck` best be
configured globally, for all projects; or configured for a whole workspace;
or configured for a specific project.

Once an above choice is made, open the appropriate configuration
window. See VSCode documentation for help on accessing user,
workspace, and project configuration windows.

It is then recommended to narrow in to the extension's configuration;
to view, and decide upon each and every setting. Start with enabling
the linters desired and disabling those not, along with mapping any
necessary build/compiler flags, as needed by most of the linters.

> It is a huge help if the linters being configured are in working
> order on the command-line, prior to an attempt at configuring
> the extension within VSCode.

### Security

This extension runs a few third-party command-line tools found from the
locations determined by the `PATH` or `Path` environment variable, and
the settings such as `"c-cpp-flylint.clang.executable"` or
`"c-cpp-flylint.cppcheck.executable"`. Configuring them in workspace
settings allows users to conveniently select a different set of tools
based on project's need, but also allows attackers to run arbitrary
binaries on your machine if they successfully convince you to open a
random repository. In order to reduce the security risk, this extension
reads the settings from user settings, by default. If the repository can
be trusted and workspace settings must be used, you can mark the
workspace as a trusted workspace using the
`"C/C++ Flylint: Toggle Workspace Trust Flag"` command.

### Configuration Settings

Due to the large quantity of configuration options -- in tandem with the
ever growing number of supported static code analyzers -- all
configuration options are not documented here.

However, every configuration option is well documented within
**File** -> **Preferences** -> **Settings** [alternatively, one of the
keybindings: <kbd>Command+,</kbd> or <kbd>Ctrl+,</kbd>].

## Development Setup

* run `npm install` inside the project root

### Developing the Server

* open VS Code rooted inside the project root.
* run `cd server && npm run test && cd ..` to execute the unit-tests for all linters.
* run `npm run compile` or `npm run watch` to build the server
  and it will compile it into the `client/out` folder.
* to debug press <kbd>F5</kbd> which attaches a debugger to the server.

### Developing the Extension/Client

* open VS Code rooted inside the project root.
* run <kbd>F5</kbd> to build and debug the whole (client with the
  server) extension.

## Project details

Both the source code and issue tracker are hosted at
[GitHub](https://github.com/jbenden/vscode-c-cpp-flylint/).

For support purposes, please visit the above URL and select
from the Issue and/or Pull Request areas.

## License

Copyright (C) 2017-2022 The VSCode C/C++ Flylint Authors.

Licensed under the [MIT License](https://opensource.org/licenses/MIT). We check
with support for the [REUSE](https://reuse.software/spec/) specification!
