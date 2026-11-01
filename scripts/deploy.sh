#!/usr/bin/env bash
# Compat: redirige al script de actualización en VPS.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-update.sh" "$@"
