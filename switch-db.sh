#!/bin/bash
# Switch between production and branch Supabase databases
# Usage: ./switch-db.sh branch    → use branch DB
#        ./switch-db.sh production → use production DB
#        ./switch-db.sh            → show which DB is active

ENV_FILE=".env.local"
PROD_FILE=".env.production"
BRANCH_FILE=".env.branch"

show_current() {
  if grep -q "pytonqwejaxagwywvitb" "$ENV_FILE" 2>/dev/null; then
    echo "Currently using: BRANCH (pytonqwejaxagwywvitb)"
  elif grep -q "zplyoslgguxtojgnkxlt" "$ENV_FILE" 2>/dev/null; then
    echo "Currently using: PRODUCTION (zplyoslgguxtojgnkxlt)"
  else
    echo "Currently using: UNKNOWN"
  fi
}

case "$1" in
  branch)
    cp "$BRANCH_FILE" "$ENV_FILE"
    echo "Switched to BRANCH database (pytonqwejaxagwywvitb)"
    echo "Restart your dev server (npm run dev) for changes to take effect."
    ;;
  production|prod)
    cp "$PROD_FILE" "$ENV_FILE"
    echo "Switched to PRODUCTION database (zplyoslgguxtojgnkxlt)"
    echo "Restart your dev server (npm run dev) for changes to take effect."
    ;;
  *)
    show_current
    echo ""
    echo "Usage: ./switch-db.sh [branch|production]"
    ;;
esac
