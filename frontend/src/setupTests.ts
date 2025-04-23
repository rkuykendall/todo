import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';
import React from 'react';

// Make React available in the global scope for tests
global.React = React;

// Increase timeout for async operations
configure({ asyncUtilTimeout: 5000 });
