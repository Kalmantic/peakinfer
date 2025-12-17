#!/bin/bash
#
# PeakInfer v1.5 Feature Demo Script
#
# This script demonstrates all the v1.5 features:
# - History Storage
# - Historical Comparison (--compare)
# - Deploy-Time Prediction (--predict)
# - Counterfactual Insights
# - Updated Output Ordering
#
# Usage: ./scripts/demo-v1.5.sh [project-path]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get project path (default to current directory)
PROJECT_PATH="${1:-.}"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           PeakInfer v1.5 Feature Demo                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if peakinfer is installed
if ! command -v peakinfer &> /dev/null; then
    echo -e "${RED}Error: peakinfer not found. Install with: npm install -g @kalmantic/peakinfer${NC}"
    exit 1
fi

# Show version
echo -e "${GREEN}Version:${NC}"
peakinfer --version
echo ""

# ============================================================================
# Demo 1: Basic Analysis (History Storage)
# ============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Demo 1: Basic Analysis (creates history entry)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Command:${NC} peakinfer analyze $PROJECT_PATH"
echo ""
read -p "Press Enter to run..." </dev/tty

peakinfer analyze "$PROJECT_PATH" || true

echo ""
echo -e "${GREEN}✓ Analysis complete. History saved to .peakinfer/history/${NC}"
echo ""

# ============================================================================
# Demo 2: Historical Comparison
# ============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Demo 2: Historical Comparison (--compare)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Command:${NC} peakinfer analyze $PROJECT_PATH --compare"
echo ""
echo "This compares current analysis with the most recent previous run."
echo "Shows: added/removed/modified inference points, new issues resolved."
echo ""
read -p "Press Enter to run..." </dev/tty

peakinfer analyze "$PROJECT_PATH" --compare || true

echo ""

# ============================================================================
# Demo 3: Deploy-Time Prediction
# ============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Demo 3: Deploy-Time Prediction (--predict)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Command:${NC} peakinfer analyze $PROJECT_PATH --predict --target-p95 2000"
echo ""
echo "This generates latency predictions for each inference point."
echo "Shows: risk levels, predicted p95/p99 latencies, budget check."
echo ""
read -p "Press Enter to run..." </dev/tty

peakinfer analyze "$PROJECT_PATH" --predict --target-p95 2000 || true

echo ""

# ============================================================================
# Demo 4: Full Analysis with All Features
# ============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Demo 4: Full Analysis (comparison + prediction + HTML)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Command:${NC} peakinfer analyze $PROJECT_PATH --compare --predict --target-p95 3000 --html"
echo ""
echo "This runs a complete analysis with all v1.5 features enabled."
echo "Output order: Comparison → Prediction → Counterfactuals → Drift → Details"
echo ""
read -p "Press Enter to run..." </dev/tty

peakinfer analyze "$PROJECT_PATH" --compare --predict --target-p95 3000 --html || true

echo ""

# ============================================================================
# Demo 5: Skip History (for quick checks)
# ============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Demo 5: Skip History Storage (--no-history)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Command:${NC} peakinfer analyze $PROJECT_PATH --no-history"
echo ""
echo "Use --no-history for quick checks that don't need tracking."
echo ""
read -p "Press Enter to run..." </dev/tty

peakinfer analyze "$PROJECT_PATH" --no-history || true

echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Demo Complete!                            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}v1.5 Features Demonstrated:${NC}"
echo ""
echo "  1. History Storage     - Automatic run tracking"
echo "  2. --compare [runId]   - See what changed since last run"
echo "  3. --predict           - Get latency risk predictions"
echo "  4. --target-p95 <ms>   - Set latency budget"
echo "  5. --no-history        - Skip history for quick checks"
echo "  6. Counterfactuals     - Always shows optimization opportunities"
echo "  7. Updated Output      - Decision-relevant info first"
echo ""
echo -e "${YELLOW}Key Benefits:${NC}"
echo ""
echo "  - Pre-deploy validation: --predict surfaces risks before deploy"
echo "  - Optimization insights: Counterfactuals show optimization ideas"
echo "  - Change tracking: --compare shows what changed since last run"
echo ""
echo -e "${BLUE}Try these commands:${NC}"
echo ""
echo "  peakinfer analyze . --compare --predict --target-p95 2000"
echo "  peakinfer analyze . --events logs.jsonl --compare --html --open"
echo ""
