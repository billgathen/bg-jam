#!/usr/bin/env bash
# Runs the full test suite (backend + frontend) inside the running
# docker-compose containers. Run this after every code change.
set -e

echo "== Backend tests =="
docker compose exec -T backend pytest "$@"

echo
echo "== Frontend tests =="
docker compose exec -T frontend npx vitest run
