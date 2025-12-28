#!/bin/bash
# =============================================================================
# SYNC VALIDATION SCRIPT
# Validates that synced files between peakinfer-site and peakinfer CLI are identical
# (modulo expected differences like import paths)
#
# Usage: ./scripts/validate-sync.sh [--strict]
#   --strict: Fail on ANY difference (no import path tolerance)
#
# Exit codes:
#   0: All files in sync (or only expected differences)
#   1: Files out of sync (unexpected differences)
#   2: Missing files or configuration error
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SITE_ROOT="$(cd "$CLI_ROOT/../peakinfer-site" 2>/dev/null && pwd)" || SITE_ROOT=""

# Synced file pairs: CLI path -> Site path
declare -A SYNC_PAIRS=(
  ["src/orchestrator.ts"]="lib/agents/static-orchestrator.ts"
  ["src/analysis-types.ts"]="lib/agents/types.ts"
  ["src/prompts/loader.ts"]="lib/prompts/loader.ts"
  ["prompts/unified-analyzer.yaml"]="prompts/unified-analyzer.yaml"
)

# Known import path differences to ignore (regex patterns)
IMPORT_DIFFS=(
  "import.*from '@/lib/"    # Site uses @/lib/, CLI uses ./
  "from '\.\./"              # Relative path differences
)

# Parse arguments
STRICT_MODE=false
if [[ "$1" == "--strict" ]]; then
  STRICT_MODE=true
fi

# Functions
print_header() {
  echo ""
  echo "======================================================================"
  echo " PeakInfer Sync Validation"
  echo "======================================================================"
  echo ""
}

print_status() {
  local status=$1
  local message=$2

  if [[ "$status" == "OK" ]]; then
    echo -e "${GREEN}[OK]${NC} $message"
  elif [[ "$status" == "WARN" ]]; then
    echo -e "${YELLOW}[WARN]${NC} $message"
  elif [[ "$status" == "FAIL" ]]; then
    echo -e "${RED}[FAIL]${NC} $message"
  else
    echo "[$status] $message"
  fi
}

check_site_exists() {
  if [[ -z "$SITE_ROOT" || ! -d "$SITE_ROOT" ]]; then
    print_status "WARN" "peakinfer-site not found at ../peakinfer-site"
    echo "       This is expected in CI or when only CLI repo is cloned."
    echo "       Skipping sync validation."
    exit 0
  fi
}

normalize_file() {
  local file=$1

  # Read file, normalize line endings, and remove SYNC NOTE headers
  cat "$file" 2>/dev/null | \
    tr -d '\r' | \
    sed '/^\/\*\*/,/^\*\//d' | \
    sed '/SYNC NOTE/d'
}

compare_files() {
  local cli_file=$1
  local site_file=$2
  local cli_path="$CLI_ROOT/$cli_file"
  local site_path="$SITE_ROOT/$site_file"

  # Check files exist
  if [[ ! -f "$cli_path" ]]; then
    print_status "FAIL" "$cli_file: CLI file missing"
    return 1
  fi

  if [[ ! -f "$site_path" ]]; then
    print_status "FAIL" "$site_file: Site file missing"
    return 1
  fi

  # Create temp files for comparison
  local tmp_cli=$(mktemp)
  local tmp_site=$(mktemp)

  normalize_file "$cli_path" > "$tmp_cli"
  normalize_file "$site_path" > "$tmp_site"

  # In non-strict mode, also normalize import paths
  if [[ "$STRICT_MODE" == "false" ]]; then
    # Normalize @/lib/ imports to relative
    sed -i.bak "s|from '@/lib/|from './|g" "$tmp_site" 2>/dev/null || \
      sed "s|from '@/lib/|from './|g" "$tmp_site" > "$tmp_site.new" && mv "$tmp_site.new" "$tmp_site"
  fi

  # Compare
  if diff -q "$tmp_cli" "$tmp_site" > /dev/null 2>&1; then
    print_status "OK" "$cli_file <-> $site_file"
    rm -f "$tmp_cli" "$tmp_site" "$tmp_cli.bak" "$tmp_site.bak"
    return 0
  else
    print_status "FAIL" "$cli_file <-> $site_file (DIFFERS)"

    # Show diff preview (first 10 lines)
    echo "       Diff preview:"
    diff "$tmp_cli" "$tmp_site" | head -20 | sed 's/^/       /'
    echo "       ..."

    rm -f "$tmp_cli" "$tmp_site" "$tmp_cli.bak" "$tmp_site.bak"
    return 1
  fi
}

# Main
print_header

echo "CLI Root:  $CLI_ROOT"
echo "Site Root: ${SITE_ROOT:-'(not found)'}"
echo ""

# Check if site exists
check_site_exists

echo "Mode: ${STRICT_MODE:+STRICT}${STRICT_MODE:-TOLERANT} (import path differences ${STRICT_MODE:+NOT }ignored)"
echo ""

# Run comparisons
failures=0
for cli_file in "${!SYNC_PAIRS[@]}"; do
  site_file="${SYNC_PAIRS[$cli_file]}"
  if ! compare_files "$cli_file" "$site_file"; then
    ((failures++))
  fi
done

echo ""
echo "======================================================================"

if [[ $failures -eq 0 ]]; then
  print_status "OK" "All ${#SYNC_PAIRS[@]} synced files are in sync"
  exit 0
else
  print_status "FAIL" "$failures of ${#SYNC_PAIRS[@]} files are OUT OF SYNC"
  echo ""
  echo "To fix:"
  echo "  1. Make changes in peakinfer-site first (source of truth)"
  echo "  2. Copy updated files to peakinfer CLI"
  echo "  3. Adapt imports (@/lib/ -> ./)"
  echo "  4. Run this script again to verify"
  exit 1
fi
