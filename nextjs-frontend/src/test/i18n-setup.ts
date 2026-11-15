// Loads both dictionaries before each test file, as `src/instrumentation.ts` does when the server starts:
// shared modules translate through `translate-client`, which reads the dictionaries `translate.ts` registers.
import "@/lib/i18n/translate";
