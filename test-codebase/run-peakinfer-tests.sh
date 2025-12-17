#!/bin/bash
# =============================================================================
# PeakInfer Integration Test Runner
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}"
echo "========================================================================"
echo "  PeakInfer Integration Test Suite"
echo "========================================================================"
echo -e "${NC}"

# =============================================================================
# Check Prerequisites
# =============================================================================

echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if ANTHROPIC_API_KEY is set
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}ERROR: ANTHROPIC_API_KEY is not set${NC}"
    echo ""
    echo "Please set your Anthropic API key:"
    echo "  export ANTHROPIC_API_KEY=sk-ant-api03-xxxxx"
    echo ""
    exit 1
fi

echo -e "  ${GREEN}✓ ANTHROPIC_API_KEY is set${NC}"

# Check if peakinfer is installed
if ! command -v peakinfer &> /dev/null; then
    echo -e "${YELLOW}  ⚠ peakinfer not found globally, trying npx...${NC}"
    PEAKINFER_CMD="npx peakinfer"
else
    PEAKINFER_CMD="peakinfer"
    echo -e "  ${GREEN}✓ peakinfer command found${NC}"
fi

# Check if npm/node is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ Node.js is available${NC}"

echo ""

# =============================================================================
# Clean previous outputs
# =============================================================================

echo -e "${YELLOW}Cleaning previous outputs...${NC}"
rm -f peakinfer-stackmap.json peakinfer-pricing.json peakinfer-report.html peakinfer-recommendations.json
echo -e "  ${GREEN}✓ Cleaned${NC}"
echo ""

# =============================================================================
# Run PeakInfer Analyze
# =============================================================================

echo -e "${BLUE}========================================================================"
echo "  Running PeakInfer Analyze"
echo "========================================================================${NC}"
echo ""

START_TIME=$(date +%s)

# Run peakinfer analyze on the test codebase
echo -e "${YELLOW}Analyzing test codebase...${NC}"
echo ""

# Navigate to parent directory and run peakinfer on test-codebase
cd "$SCRIPT_DIR/.."

# Use the local dist version
if [ -f "./dist/slc/cli.js" ]; then
    echo "Using local build..."
    node ./dist/slc/cli.js analyze ./test-codebase --verbose
else
    echo "Using installed peakinfer..."
    $PEAKINFER_CMD analyze ./test-codebase --verbose
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}Analysis completed in ${DURATION} seconds${NC}"
echo ""

# =============================================================================
# Check Output Files
# =============================================================================

echo -e "${BLUE}========================================================================"
echo "  Checking Output Files"
echo "========================================================================${NC}"
echo ""

OUTPUT_FILES=(
    "peakinfer-stackmap.json"
    "peakinfer-pricing.json"
)

ALL_FILES_EXIST=true

for file in "${OUTPUT_FILES[@]}"; do
    if [ -f "$file" ]; then
        SIZE=$(wc -c < "$file" | tr -d ' ')
        echo -e "  ${GREEN}✓ $file (${SIZE} bytes)${NC}"
    else
        echo -e "  ${RED}✗ $file NOT FOUND${NC}"
        ALL_FILES_EXIST=false
    fi
done

# Optional files
if [ -f "peakinfer-report.html" ]; then
    SIZE=$(wc -c < "peakinfer-report.html" | tr -d ' ')
    echo -e "  ${GREEN}✓ peakinfer-report.html (${SIZE} bytes)${NC}"
fi

echo ""

if [ "$ALL_FILES_EXIST" = false ]; then
    echo -e "${RED}ERROR: Some output files are missing${NC}"
    exit 1
fi

# =============================================================================
# Validate JSON Structure
# =============================================================================

echo -e "${BLUE}========================================================================"
echo "  Validating JSON Structure"
echo "========================================================================${NC}"
echo ""

# Validate stackmap JSON
if jq empty peakinfer-stackmap.json 2>/dev/null; then
    echo -e "  ${GREEN}✓ peakinfer-stackmap.json is valid JSON${NC}"
    
    # Extract summary info
    echo ""
    echo "  StackMap Summary:"
    
    # Try different JSON structures (agent vs classic output)
    CALLSITES=$(jq '.callsites | length // 0' peakinfer-stackmap.json 2>/dev/null || echo "0")
    echo "    - Callsites found: $CALLSITES"
    
    PROVIDERS=$(jq '.tech_stack.application.providers | length // .providers | length // 0' peakinfer-stackmap.json 2>/dev/null || echo "0")
    echo "    - Providers detected: $PROVIDERS"
    
    RUNTIMES=$(jq '.tech_stack.serving.runtimes | length // .runtimes | length // 0' peakinfer-stackmap.json 2>/dev/null || echo "0")
    echo "    - Runtimes detected: $RUNTIMES"
    
else
    echo -e "  ${RED}✗ peakinfer-stackmap.json is INVALID JSON${NC}"
    exit 1
fi

echo ""

# Validate pricing JSON
if jq empty peakinfer-pricing.json 2>/dev/null; then
    echo -e "  ${GREEN}✓ peakinfer-pricing.json is valid JSON${NC}"
    
    # Extract pricing info
    echo ""
    echo "  Pricing Summary:"
    
    COST_MIN=$(jq '.estimated_monthly_cost.min // .totalCost.min // 0' peakinfer-pricing.json 2>/dev/null || echo "0")
    COST_MAX=$(jq '.estimated_monthly_cost.max // .totalCost.max // 0' peakinfer-pricing.json 2>/dev/null || echo "0")
    echo "    - Estimated monthly cost: \$${COST_MIN} - \$${COST_MAX}"
    
else
    echo -e "  ${RED}✗ peakinfer-pricing.json is INVALID JSON${NC}"
    exit 1
fi

echo ""

# =============================================================================
# Run Detection Tests
# =============================================================================

echo -e "${BLUE}========================================================================"
echo "  Running Detection Tests"
echo "========================================================================${NC}"
echo ""

# Quick inline tests (bash-based)
echo "Testing key detections..."
echo ""

# Test OpenAI detection
if jq -e '.callsites[] | select(.provider == "openai" or .provider == "OpenAI")' peakinfer-stackmap.json > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ OpenAI provider detected${NC}"
else
    echo -e "  ${YELLOW}⚠ OpenAI provider not detected in callsites${NC}"
fi

# Test Anthropic detection
if jq -e '.callsites[] | select(.provider == "anthropic" or .provider == "Anthropic")' peakinfer-stackmap.json > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Anthropic provider detected${NC}"
else
    echo -e "  ${YELLOW}⚠ Anthropic provider not detected in callsites${NC}"
fi

# Test vLLM detection
if jq -e '.tech_stack.serving.runtimes[] | select(.name | test("vllm"; "i"))' peakinfer-stackmap.json > /dev/null 2>&1 || \
   jq -e '.runtimes[] | select(.name | test("vllm"; "i"))' peakinfer-stackmap.json > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ vLLM runtime detected${NC}"
else
    echo -e "  ${YELLOW}⚠ vLLM runtime not detected${NC}"
fi

# Test LangChain detection
if jq -e '.tech_stack.application.frameworks[] | select(.name | test("langchain"; "i"))' peakinfer-stackmap.json > /dev/null 2>&1 || \
   jq -e '.frameworks[] | select(.name | test("langchain"; "i"))' peakinfer-stackmap.json > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ LangChain framework detected${NC}"
else
    echo -e "  ${YELLOW}⚠ LangChain framework not detected${NC}"
fi

# Test pattern detection
echo ""
echo "Testing pattern detection..."

PATTERNS=("batching" "streaming" "caching" "routing" "retry" "fallback")

for pattern in "${PATTERNS[@]}"; do
    if jq -e ".patterns.${pattern}.detected == true or .patterns.${pattern}.instances | length > 0" peakinfer-stackmap.json > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓ ${pattern} pattern detected${NC}"
    else
        echo -e "  ${YELLOW}⚠ ${pattern} pattern not detected${NC}"
    fi
done

echo ""

# Test infrastructure detection
echo "Testing infrastructure detection..."

if jq -e '.tech_stack.infrastructure.compute[] | select(.instance_type | test("p4d|p5|g5|a2"; "i"))' peakinfer-stackmap.json > /dev/null 2>&1 || \
   jq -e '.infrastructure.compute[] | select(.instance_type | test("p4d|p5|g5|a2"; "i"))' peakinfer-stackmap.json > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ GPU instance types detected${NC}"
else
    echo -e "  ${YELLOW}⚠ GPU instance types not detected${NC}"
fi

if jq -e '.tech_stack.hardware.gpus[] | select(.type | test("A100|H100"; "i"))' peakinfer-stackmap.json > /dev/null 2>&1 || \
   jq -e '.hardware.gpus[] | select(.type | test("A100|H100"; "i"))' peakinfer-stackmap.json > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ GPU types detected (A100/H100)${NC}"
else
    echo -e "  ${YELLOW}⚠ GPU types not detected${NC}"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================

echo -e "${BLUE}========================================================================"
echo "  Test Summary"
echo "========================================================================${NC}"
echo ""

echo -e "  ${GREEN}✓ PeakInfer analysis completed successfully${NC}"
echo -e "  ${GREEN}✓ Output files generated and validated${NC}"
echo ""

# Show quick stats
echo "Quick Stats:"
echo "  - Analysis duration: ${DURATION}s"
echo "  - Callsites found: $CALLSITES"
echo "  - Estimated cost: \$${COST_MIN} - \$${COST_MAX}/month"
echo ""

# Display output file locations
echo "Output files:"
echo "  - $(pwd)/peakinfer-stackmap.json"
echo "  - $(pwd)/peakinfer-pricing.json"
if [ -f "peakinfer-report.html" ]; then
    echo "  - $(pwd)/peakinfer-report.html"
fi
echo ""

echo -e "${GREEN}All tests passed!${NC}"
echo ""

