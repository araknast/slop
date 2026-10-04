import { domMax } from 'framer-motion';

// Loaded after first paint: keeps framer-motion's animation/layout engine out of the startup bundle.
export default domMax;
