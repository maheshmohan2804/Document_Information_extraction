# Test Suite Documentation

Comprehensive test suite for the Corrective RAG Pipeline system.

## Test Structure

```
tests/
├── jest.config.js              # Jest configuration
├── chunking.test.ts            # Unit tests for document chunking
├── tagging.test.ts             # Unit tests for chunk tagging
├── vectorStore.test.ts         # Unit tests for vector storage
├── hybridSearch.test.ts        # Unit tests for hybrid search (BM25 + semantic)
├── correctiveRAG.test.ts       # Unit tests for corrective RAG retrieval
├── extraction.test.ts          # Unit tests for document extraction
├── pipeline.integration.test.ts # Integration tests for complete pipeline
└── README.md                   # This file
```

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Only Unit Tests

```bash
npm run test:unit
```

### Run Only Integration Tests

```bash
npm run test:integration
```

## Test Coverage

### Unit Tests

#### 1. **Chunking Module** (`chunking.test.ts`)
- Header-based markdown chunking
- Combining small chunks
- Preserving tables as single chunks
- Splitting large chunks at paragraph boundaries
- Recursive chunking fallback for plain text
- Overlap handling in recursive chunking
- Edge cases (empty input, very short input, headers only)

#### 2. **Tagging Module** (`tagging.test.ts`)
- JSON response parsing
- Handling markdown code blocks in responses
- Fallback parsing for non-JSON responses
- Metadata extraction priority (first found wins)
- Error handling (API errors, invalid JSON)
- Tag distribution across chunks

#### 3. **Vector Store Module** (`vectorStore.test.ts`)
- Adding chunks and generating embeddings
- Semantic search with similarity scoring
- Tag-based filtering
- Top-K retrieval
- Edge cases (empty store, empty query, special characters)
- Embedding consistency and uniqueness

#### 4. **Hybrid Search Module** (`hybridSearch.test.ts`)
- Combining semantic and BM25 search
- Alpha parameter control (0=BM25 only, 1=semantic only, 0.5=balanced)
- Tag filtering (single and multiple tags)
- Score normalization and sorting
- BM25 keyword matching
- Edge cases (empty query, no matches, special characters)

#### 5. **Corrective RAG Module** (`correctiveRAG.test.ts`)
- Relevance grading (HIGH, MEDIUM, REJECT)
- Query rewriting with feedback
- Iterative retrieval with query refinement
- Max iteration limits
- Error handling (API failures)

#### 6. **Extraction Module** (`extraction.test.ts`)
- Extracting all document fields from JSON
- Handling markdown code blocks
- Fallback to defaults on parsing failure
- Custom query answering
- Error handling

### Integration Tests

#### 7. **Pipeline Integration** (`pipeline.integration.test.ts`)
- End-to-end PDF processing
- Markdown to HTML fallback
- Query mode execution
- Error handling (PDF conversion, network errors)
- Output validation

## Test Mocking

### External Dependencies

The test suite uses mocks for:

1. **Groq SDK**: LLM API calls are mocked to return predictable responses
2. **Fetch API**: PDF conversion API calls are mocked
3. **File System**: Optional mocking for file operations

### Mock Patterns

```typescript
// Mocking Groq SDK
jest.mock('groq-sdk');
import Groq from 'groq-sdk';

(Groq as jest.MockedClass<typeof Groq>).mockImplementation(() => ({
  chat: {
    completions: {
      create: mockCreate
    }
  }
} as any));

// Mocking fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ /* response data */ })
});
```

## Writing New Tests

### Test Template

```typescript
import { yourFunction } from '../src/yourModule';

describe('YourModule', () => {
  beforeEach(() => {
    // Setup before each test
    jest.clearAllMocks();
  });

  describe('Feature name', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test input';

      // Act
      const result = yourFunction(input);

      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### Best Practices

1. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
2. **Descriptive Names**: Use clear, descriptive test names
3. **One Assertion Per Test**: Focus each test on a single behavior
4. **Mock External Dependencies**: Mock all external API calls and file operations
5. **Clean Up**: Use `beforeEach` and `afterEach` for setup/teardown
6. **Edge Cases**: Test boundary conditions and error scenarios

## Coverage Goals

- **Line Coverage**: > 80%
- **Branch Coverage**: > 75%
- **Function Coverage**: > 85%
- **Statement Coverage**: > 80%

## Continuous Integration

Tests should be run in CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    npm install
    npm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/coverage-final.json
```

## Troubleshooting

### Common Issues

1. **Module not found errors**
   - Ensure all dependencies are installed: `npm install`
   - Check import paths in test files

2. **Async timeout errors**
   - Increase timeout in jest.config.js: `testTimeout: 30000`
   - Ensure all async operations are properly awaited

3. **Mock not working**
   - Clear mocks between tests: `jest.clearAllMocks()`
   - Check mock implementation order

4. **Coverage not generated**
   - Ensure jest.config.js has correct `collectCoverageFrom` patterns
   - Check that tests are actually running

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure tests pass locally
3. Maintain or improve coverage percentage
4. Update this README if adding new test files
