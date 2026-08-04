/**
 * Static locale registry.
 *
 * RequireJS resolved the active locale with a computed module id
 * (`"../../nls/" + lang`), which a bundler cannot follow. Listing them
 * explicitly keeps locale selection working after bundling.
 */
import cs from "./cs.js";
import de from "./de.js";
import en from "./en.js";
import es from "./es.js";
import fr from "./fr.js";
import hr from "./hr.js";
import hu from "./hu.js";
import nl from "./nl.js";
import pl from "./pl.js";
import pt from "./pt.js";
import ru from "./ru.js";
import sk from "./sk.js";
import sr from "./sr.js";
import tr from "./tr.js";

export const locales = { cs, de, en, es, fr, hr, hu, nl, pl, pt, ru, sk, sr, tr };

export default locales;
