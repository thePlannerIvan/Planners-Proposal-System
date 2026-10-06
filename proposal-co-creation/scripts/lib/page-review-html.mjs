import { pathToFileURL } from 'node:url';
import { moduleScript } from './planners-modules.mjs';
const {renderContentReview} = await import(pathToFileURL(moduleScript('planners-review-core', 'scripts/render-content-review.mjs')));
export const renderPageReviewHtml = options => renderContentReview({...options,feedbackContractVersion:'1.0.0'});
