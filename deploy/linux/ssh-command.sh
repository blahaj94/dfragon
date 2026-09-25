#!/bin/sh
set -eu
exec /usr/bin/sudo -n /usr/local/sbin/dfragon-deploy "${SSH_ORIGINAL_COMMAND:-}"
