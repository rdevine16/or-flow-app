#!/bin/bash
# =============================================================================
# ORbit Claude Code Workflow Setup
# =============================================================================
# Run this script from your ORbit project root directory.
# It creates the directory structure and copies workflow files into place.
#
# Usage:
#   chmod +x setup-workflow.sh
#   ./setup-workflow.sh
#
# What it does:
#   1. Creates .claude/commands/ and .claude/agents/ directories
#   2. Creates docs/ directory
#   3. Copies all workflow files into place
#   4. Backs up your existing CLAUDE.md (if any)
#   5. Does NOT overwrite docs/active-feature.md if it already has content
# =============================================================================

set -euo pipefail

echo "🚀 Setting up ORbit Claude Code workflow..."
echo ""

# Check we're in a git repo
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Run this from your ORbit project root."
    exit 1
fi

# Create directories
echo "📁 Creating directory structure..."
mkdir -p .claude/commands
mkdir -p .claude/agents
mkdir -p docs

# Backup existing CLAUDE.md
if [ -f "CLAUDE.md" ]; then
    echo "📦 Backing up existing CLAUDE.md to CLAUDE.md.backup"
    cp CLAUDE.md CLAUDE.md.backup
fi

echo ""
echo "✅ Directory structure created:"
echo ""
echo "  .claude/"
echo "  ├── commands/"
echo "  │   ├── audit.md        → /audit (analyze & plan features)"
echo "  │   ├── phase-start.md  → /phase-start (resume next phase)"
echo "  │   ├── wrap-up.md      → /wrap-up (end session cleanly)"
echo "  │   ├── fix.md          → /fix (quick targeted fixes)"
echo "  │   └── migrate.md      → /migrate (create DB migrations)"
echo "  └── agents/"
echo "      ├── tester.md       → Test runner (isolated context)"
echo "      ├── reviewer.md     → Code reviewer (isolated context)"
echo "      └── explorer.md     → Codebase investigator (isolated context)"
echo ""
echo "  docs/"
echo "  ├── architecture.md     → Database, triggers, analytics pipeline"
echo "  ├── ios-architecture.md → SwiftUI app structure, MVVM, repos"
echo "  └── active-feature.md   → Current feature spec (template)"
echo ""
echo "  CLAUDE.md               → Lean project context (~100 lines)"
echo ""
echo "============================================================"
echo ""
echo "📋 Next steps:"
echo ""
echo "  1. Review CLAUDE.md and customize for your current project state"
echo "  2. Review docs/architecture.md — fill in any missing tables or triggers"
echo "  3. Write your first feature spec in docs/active-feature.md"
echo "  4. Open Claude Code and run: /audit"
echo ""
echo "🔄 Daily workflow:"
echo "  /audit           → Plan a new feature"
echo "  /phase-start     → Start or resume work"
echo "  /wrap-up         → End session cleanly"
echo "  /fix <desc>      → Quick targeted fix"
echo "  /migrate <desc>  → Create a DB migration"
echo ""
echo "  Ctrl+T           → Toggle task list visibility"
echo "  /compact          → Reclaim context mid-session"
echo "  /context          → See what's using your context"
echo "  claude --continue → Resume last session"
echo ""
echo "✅ Setup complete!"
