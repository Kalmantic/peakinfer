#!/bin/bash
# =============================================================================
# PeakInfer Sync Script
# =============================================================================
# Development convenience script to sync source-of-truth files from peakinfer-site.
#
# IMPORTANT: This script is for DEVELOPMENT ONLY.
# The peakinfer CLI is fully self-contained and does NOT depend on peakinfer-site
# at runtime. All synced files are committed to this repo for enterprise auditability.
#
# Usage:
#   ./scripts/sync-from-site.sh [--dry-run] [--check]
#
# Options:
#   --dry-run   Show what would be synced without making changes
#   --check     Exit with error if files are out of sync (for CI)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(dirname "$SCRIPT_DIR")"
SITE_ROOT="$(dirname "$CLI_ROOT")/peakinfer-site"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Sync mappings: CLI_PATH <- SITE_PATH
declare -A SYNC_FILES=(
    ["src/orchestrator.ts"]="lib/agents/static-orchestrator.ts"
    ["src/analysis-types.ts"]="lib/agents/types.ts"
    ["src/prompts/loader.ts"]="lib/prompts/loader.ts"
    ["prompts/unified-analyzer.yaml"]="prompts/unified-analyzer.yaml"
)

# Parse arguments
DRY_RUN=false
CHECK_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --check)
            CHECK_MODE=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check if peakinfer-site exists
if [ ! -d "$SITE_ROOT" ]; then
    echo -e "${YELLOW}Warning: peakinfer-site not found at $SITE_ROOT${NC}"
    echo "This is expected in production/CI environments."
    echo "The CLI is fully self-contained and doesn't require peakinfer-site."
    exit 0
fi

echo "=== PeakInfer Sync ==="
echo "Source: $SITE_ROOT"
echo "Target: $CLI_ROOT"
echo ""

SYNC_HEADER="/**
 * SYNC NOTE: This file is synced from peakinfer-site (source of truth).
 * DO NOT modify directly in the CLI repo.
 *
 * Source: peakinfer-site/%SOURCE_PATH%
 * Last synced: %DATE%
 *
 * To modify: Edit in peakinfer-site, then run: ./scripts/sync-from-site.sh
 */

"

YAML_SYNC_HEADER="# =============================================================================
# SYNC NOTE: This file is synced from peakinfer-site (source of truth).
# DO NOT modify directly in the CLI repo.
#
# Source: peakinfer-site/%SOURCE_PATH%
# Last synced: %DATE%
#
# To modify: Edit in peakinfer-site, then run: ./scripts/sync-from-site.sh
# =============================================================================

"

OUT_OF_SYNC=0
SYNCED=0

for CLI_PATH in "${!SYNC_FILES[@]}"; do
    SITE_PATH="${SYNC_FILES[$CLI_PATH]}"
    CLI_FILE="$CLI_ROOT/$CLI_PATH"
    SITE_FILE="$SITE_ROOT/$SITE_PATH"

    if [ ! -f "$SITE_FILE" ]; then
        echo -e "${YELLOW}[SKIP] $SITE_PATH not found in peakinfer-site${NC}"
        continue
    fi

    # Read source file
    SOURCE_CONTENT=$(cat "$SITE_FILE")

    # Prepare sync header
    DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    if [[ "$CLI_PATH" == *.yaml ]]; then
        HEADER="${YAML_SYNC_HEADER//%SOURCE_PATH%/$SITE_PATH}"
        HEADER="${HEADER//%DATE%/$DATE}"
    else
        HEADER="${SYNC_HEADER//%SOURCE_PATH%/$SITE_PATH}"
        HEADER="${HEADER//%DATE%/$DATE}"
    fi

    # Transform imports for CLI context
    if [[ "$CLI_PATH" == *.ts ]]; then
        # Replace @/lib/ imports with relative imports
        SOURCE_CONTENT=$(echo "$SOURCE_CONTENT" | sed "s|from '@/lib/|from './|g")
        SOURCE_CONTENT=$(echo "$SOURCE_CONTENT" | sed "s|import '@/lib/|import './|g")
    fi

    NEW_CONTENT="${HEADER}${SOURCE_CONTENT}"

    # Check if file exists and compare
    if [ -f "$CLI_FILE" ]; then
        # Strip sync header from existing file for comparison (compare actual content)
        EXISTING_CONTENT=$(cat "$CLI_FILE")

        # Simple content comparison (ignoring header)
        # Extract content after sync header
        if [[ "$CLI_PATH" == *.yaml ]]; then
            EXISTING_BODY=$(echo "$EXISTING_CONTENT" | sed -n '/^# ====/,/^# ====/!p' | tail -n +2)
            NEW_BODY=$(echo "$SOURCE_CONTENT")
        else
            EXISTING_BODY=$(echo "$EXISTING_CONTENT" | sed -n '/^\*\//,$p' | tail -n +2)
            NEW_BODY=$(echo "$SOURCE_CONTENT")
        fi

        if [ "$EXISTING_BODY" = "$NEW_BODY" ]; then
            echo -e "${GREEN}[OK] $CLI_PATH is in sync${NC}"
            continue
        fi
    fi

    # Files differ
    OUT_OF_SYNC=$((OUT_OF_SYNC + 1))

    if [ "$CHECK_MODE" = true ]; then
        echo -e "${RED}[OUT OF SYNC] $CLI_PATH <- $SITE_PATH${NC}"
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN] Would sync: $CLI_PATH <- $SITE_PATH${NC}"
    else
        # Create directory if needed
        mkdir -p "$(dirname "$CLI_FILE")"

        # Write synced file
        echo "$NEW_CONTENT" > "$CLI_FILE"
        echo -e "${GREEN}[SYNCED] $CLI_PATH <- $SITE_PATH${NC}"
        SYNCED=$((SYNCED + 1))
    fi
done

echo ""
echo "=== Summary ==="

if [ "$CHECK_MODE" = true ]; then
    if [ $OUT_OF_SYNC -gt 0 ]; then
        echo -e "${RED}$OUT_OF_SYNC file(s) out of sync${NC}"
        echo "Run './scripts/sync-from-site.sh' to sync"
        exit 1
    else
        echo -e "${GREEN}All files in sync${NC}"
        exit 0
    fi
fi

if [ "$DRY_RUN" = true ]; then
    echo "$OUT_OF_SYNC file(s) would be synced"
else
    echo "$SYNCED file(s) synced"
fi

echo ""
echo "Remember: peakinfer CLI is fully self-contained."
echo "Synced files are committed to git for enterprise auditability."
