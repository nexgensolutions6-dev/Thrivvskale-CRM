// Stand-in for the `server-only` package in the Vitest (Node) environment.
// The real package throws unless resolved with the `react-server` condition,
// which Next applies in the server bundle and Vitest does not.
export {}
