#!/bin/bash
# PeakInfer Integration Test Runner
# Runs all collector tests with proper setup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           PeakInfer Integration Test Runner                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Project Root: $PROJECT_ROOT"
echo "Test Dir: $TEST_DIR"
echo ""

# Check if project is built
if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo "Building project..."
    cd "$PROJECT_ROOT"
    npm run build
    echo "Build complete."
    echo ""
fi

# Check environment variables
echo "Checking environment configuration..."
echo ""

if [ -n "$SNOWFLAKE_ACCOUNT" ] && [ -n "$SNOWFLAKE_USER" ]; then
    echo "  ✅ Snowflake: Configured (Account: $SNOWFLAKE_ACCOUNT)"
else
    echo "  ⚠️  Snowflake: Not configured (will be skipped)"
    echo "      Set: SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD,"
    echo "           SNOWFLAKE_DATABASE, SNOWFLAKE_WAREHOUSE"
fi

if [ -n "$DATABRICKS_HOST" ] && [ -n "$DATABRICKS_TOKEN" ]; then
    echo "  ✅ Databricks: Configured (Host: $DATABRICKS_HOST)"
else
    echo "  ⚠️  Databricks: Not configured (will be skipped)"
    echo "      Set: DATABRICKS_HOST, DATABRICKS_TOKEN"
fi

echo "  ✅ Terraform: Local configs available"
echo "  ✅ Hardware Detection: Sample codebase available"
echo "  ✅ Codebase Analysis: Sample codebase available"
echo ""

# Run the full test suite
echo "Running integration tests..."
echo ""

cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/test-all.js"

echo ""
echo "Test run complete."
