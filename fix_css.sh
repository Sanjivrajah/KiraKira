#!/bin/bash
# Wrap the custom settings CSS in @layer components
sed -i '' -e 's|/\* ── Appearance settings ── \*/|@layer components {\n/* ── Appearance settings ── */|' src/app/globals.css
sed -i '' -e 's|/\* ── Settings mobile adjustments ── \*/|/* ── Settings mobile adjustments ── */|' src/app/globals.css
echo "}" >> src/app/globals.css
