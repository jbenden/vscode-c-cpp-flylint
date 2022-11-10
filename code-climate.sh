#!/bin/sh
# Copyright (c) 2017-2022 The VSCode C/C++ Flylint Authors
#
# SPDX-License-Identifier: MIT

env CONTAINER_TIMEOUT_SECONDS=1800 docker run \
  --interactive --tty --rm \
  --env CODECLIMATE_CODE="$PWD" \
  --volume "$PWD":/code \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --volume /tmp/cc:/tmp/cc \
  codeclimate/codeclimate "$@"
