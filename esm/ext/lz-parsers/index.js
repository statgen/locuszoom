import { makeBed12Parser } from './bed';
import { makeGWASParser } from './gwas/parsers';
import { guessGWAS } from './gwas/sniffers';
import { makePlinkLdParser } from './ld';

// Support UMD (single symbol export)
const all = { makeBed12Parser, makeGWASParser, guessGWAS, makePlinkLdParser };

export default all;

export { makeBed12Parser, makeGWASParser, guessGWAS, makePlinkLdParser };
