import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';

// Increase timeout for async operations
configure({ asyncUtilTimeout: 5000 });
