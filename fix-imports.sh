#!/bin/bash
echo "🔧 Fixing imports..."

# Fix lib/ imports
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "./node_modules/*" ! -path "./.next/*" \
    -exec perl -i -pe "s|from '(\\.\\./)+lib/|from '\@/lib/|g" {} \;

# Fix components/ imports  
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "./node_modules/*" ! -path "./.next/*" \
    -exec perl -i -pe "s|from '(\\.\\./)+components/|from '\@/components/|g" {} \;

# Fix hooks/ imports
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "./node_modules/*" ! -path "./.next/*" \
    -exec perl -i -pe "s|from '(\\.\\./)+hooks/|from '\@/hooks/|g" {} \;

# Fix types/ imports
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "./node_modules/*" ! -path "./.next/*" \
    -exec perl -i -pe "s|from '(\\.\\./)+types/|from '\@/types/|g" {} \;

echo "✅ Done!"
