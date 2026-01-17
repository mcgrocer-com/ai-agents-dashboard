/**
 * Vendor extractors index
 * Exports all site-specific extractors
 */

export { extractArgos } from "./argos";
export { extractAsda } from "./asda";
export { extractBoots } from "./boots";
export { extractCafepod } from "./cafepod";
export { extractCocaCola } from "./cocacola";
export { extractCostco } from "./costco";
export { extractHarrods } from "./harrods";
export { extractJohnLewis } from "./johnlewis";
export { extractLego } from "./lego";
export { extractMarksAndSpencer } from "./marksandspencer";
export { extractNext } from "./next";
export { extractOcado } from "./ocado";
export { extractSainsburys } from "./sainsburys";
export { extractSuperdrug } from "./superdrug";

export type { SiteExtractionResult, PageWithEvaluate, AvailabilityStatus } from "./types";
export { validateAvailability, extractCurrency, waitForContent } from "./types";
