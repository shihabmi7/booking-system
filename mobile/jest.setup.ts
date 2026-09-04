// React 19 refuses to apply a state update from outside act() unless the environment explicitly
// declares itself a test environment via this flag. jest-expo's preset doesn't set it, so without
// this every async setState in a component test logs "not configured to support act(...)" and the
// re-render never lands — which looks exactly like a component that doesn't update.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
