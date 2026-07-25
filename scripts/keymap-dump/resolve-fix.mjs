// The ts-client ships extensionless imports that only bundlers resolve.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'protobufjs/minimal') {
      return next(new URL('./pb-shim.mjs', import.meta.url).href, context);
    }
    const rewritable = specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('protobufjs/');
    if (rewritable && !specifier.endsWith('.js') && !specifier.endsWith('.json')) {
      try {
        return next(specifier + '.js', context);
      } catch {
        // fall through to the original specifier
      }
    }
    return next(specifier, context);
  },
});
