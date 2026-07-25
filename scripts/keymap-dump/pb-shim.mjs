// protobufjs/minimal is CJS; its named exports aren't statically detectable,
// so re-export them explicitly for the ts-client's `import * as _m0` usage.
import pb from 'protobufjs/minimal.js';

export const { Writer, Reader, util, roots, configure, build, rpc, types, verifier, wrappers } = pb;
export default pb;
