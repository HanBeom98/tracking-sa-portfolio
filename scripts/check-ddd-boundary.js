#!/usr/bin/env node
// Compatibility entry point; this checks browser/DOM patterns, not all DDD rules.
import { runApplicationBrowserBoundary } from './check-application-browser-boundary.js';
runApplicationBrowserBoundary();
