/**
 * Decides whether a request gets a web research step first (Groq's browser_search
 * tool). Plain creative requests
 * ("draw a flower", "a poem about rain") never are; requests that lean on real-world,
 * current or factual information are.
 */

const FACTUAL_CUES = [
    /\b(latest|current|currently|today|this (week|month|year)|recent|recently|news|trending)\b/i,
    /\b(accurate|accurately|authentic|historical|history of|fact|facts|factual|real-world)\b/i,
    /\b(research|look up|search the web|find out|references)\b/i,
    /\b(inspired by|based on|in the style of)\b/i,
    /\b(famous|landmark|monument|skyline|logo|flag of|map of)\b/i,
    /\b(19|20)\d{2}\b/,
];

/**
 * Capitalised words after the first one usually name a real person, place or thing
 * ("Draw the Eiffel Tower"). Common sentence starts and the pronoun "I" don't count.
 */
function hasProperNoun(prompt: string) {
    const words = prompt.split(/\s+/).slice(1);
    return words.some((word) => /^[A-Z][a-z]{2,}/.test(word) && !/^(I|A|An|The)$/.test(word));
}

export function shouldOfferWebSearch(prompt: string, enabled: boolean): boolean {
    if (!enabled) return false;
    return FACTUAL_CUES.some((cue) => cue.test(prompt)) || hasProperNoun(prompt);
}
