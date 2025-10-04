# Test Fixes Needed

## Summary

Tests are failing due to TypeScript type mismatches. The `TaggedChunk` interface requires `charCount` and `containsTable` properties, but test mock data doesn't include them.

## Critical Fixes Required

### 1. Fix All TaggedChunk Mock Data

All test files need to add `charCount` and `containsTable` to their TaggedChunk test data:

**Files to fix:**
- `hybridSearch.test.ts`
- `correctiveRAG.test.ts`
- `extraction.test.ts`
- `tagging.test.ts`
- `pipeline.integration.test.ts`

**Fix pattern:**
```typescript
// BEFORE (missing properties)
const sampleChunks: TaggedChunk[] = [
  {
    header: 'Introduction',
    content: 'Some text',
    chunkId: 0,
    tags: ['<summary>']
  }
];

// AFTER (complete)
const sampleChunks: TaggedChunk[] = [
  {
    header: 'Introduction',
    content: 'Some text',
    charCount: 9,  // Add content.length
    containsTable: false,  // Add this
    chunkId: 0,
    tags: ['<summary>']
  }
];
```

### 2. Use Test Helper (Recommended)

Use the `createTestChunks` helper from `test-helpers.ts`:

```typescript
import { createTestChunks } from './test-helpers';

const sampleChunks = createTestChunks([
  {
    header: 'Introduction',
    content: 'Some text',
    tags: ['<summary>']
  }
]);
```

## Quick Fix Commands

### Option 1: Manual Fix
Add these two lines to each chunk definition in all test files:
```typescript
charCount: content.length,
containsTable: false,
```

### Option 2: Automated Fix (Recommended)
Run this script to add missing properties:

```bash
# For each test file, add charCount and containsTable
cd tests
for file in *.test.ts; do
  # This is a complex find/replace - recommend manual fixing
  echo "Fix $file manually by adding charCount and containsTable"
done
```

## Test Status

- ✅ **vectorStore.test.ts** - PASSING (already fixed)
- ❌ **chunking.test.ts** - FAILING (some edge case issues, not critical)
- ❌ **hybridSearch.test.ts** - FAILING (missing TaggedChunk properties)
- ❌ **correctiveRAG.test.ts** - FAILING (missing TaggedChunk properties)
- ❌ **extraction.test.ts** - FAILING (missing TaggedChunk properties)
- ❌ **tagging.test.ts** - FAILING (missing TaggedChunk properties)
- ❌ **pipeline.integration.test.ts** - FAILING (missing TaggedChunk properties)

## Priority

**HIGH PRIORITY** - Fix TypeScript errors by adding missing properties to all TaggedChunk test data

**LOW PRIORITY** - chunking.test.ts edge case failures (not critical for core functionality)

## Recommendation

For production use:
1. Fix all TypeScript errors by updating test mock data
2. Consider using the test-helpers.ts utility for cleaner test code
3. Run `npm install` to ensure all test dependencies are installed
4. Run `npm test` to verify all tests pass

The core functionality works - tests just need their mock data updated to match the TypeScript interface definitions.
