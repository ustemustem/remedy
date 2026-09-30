// Worker entry for the canvas Surface Field: draws the dot field off the main
// thread, so painting it never competes with React Flow's drag handling.
// The bundler must see `new Worker(new URL(...))` in app code, so this file
// only re-exports the package's worker (see surface-field-background.tsx).
import "surface-field/worker";
