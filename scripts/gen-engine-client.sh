#!/bin/sh
# Regenerate src/lib/server/engine.openapi.ts from the engine's /openapi.json.
# /openapi.json needs the bearer token, so fetch it with curl first (token via stdin header,
# never on the command line), then run openapi-typescript on the file.
# Reads ENGINE_URL / ENGINE_SERVICE_TOKEN from the environment, else from .env.
# Extra curl flags: CURL_OPTS="--doh-url https://1.1.1.1/dns-query" (stale DNS cache).
set -eu

if [ -z "${ENGINE_URL:-}" ] || [ -z "${ENGINE_SERVICE_TOKEN:-}" ]; then
	[ -f .env ] || { echo "ENGINE_URL / ENGINE_SERVICE_TOKEN not set and no .env" >&2; exit 1; }
	set -a
	. ./.env
	set +a
fi

out=src/lib/server/engine.openapi.ts
spec=$(mktemp "${TMPDIR:-/tmp}/engine-openapi.XXXXXX")
trap 'rm -f "$spec"' EXIT

# shellcheck disable=SC2086
printf 'Authorization: Bearer %s\n' "$ENGINE_SERVICE_TOKEN" |
	curl -fsS ${CURL_OPTS:-} -H @- -o "$spec" "${ENGINE_URL%/}/openapi.json"

# --default-non-nullable=false: request fields with defaults (top_k, rerank, answer) stay optional.
openapi-typescript "$spec" --default-non-nullable=false -o "$out"
prettier --write "$out" >/dev/null
