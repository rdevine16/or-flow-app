#!/bin/bash
set -e
echo "Removing Sentry example pages..."
rm -rf app/sentry-example-page
rm -rf app/api/sentry-example-api
echo "Done. Commit with:"
echo "  git add -A && git commit -m 'chore: remove Sentry example pages'"
