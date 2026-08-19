import { Policy } from "./episode.js";
/** Uniform over legal actions. The floor any learned policy has to beat. */
export declare const randomPolicy: (rng?: () => number) => Policy;
/**
 * Hand-written baseline: play the deck out roughly the way a person would, so
 * deck comparisons measure the deck rather than the noise of random play.
 *
 * ponytail: a priority ordering, not a search. It exists to give training a
 * non-trivial opponent and to make deck win rates mean something.
 */
export declare const heuristicPolicy: (rng?: () => number) => Policy;
/**
 * Decision-time search: rank the legal actions with the heuristic, then settle
 * the top few by actually playing the game out from each and seeing who wins.
 *
 * Flat Monte Carlo rather than a tree — for a game this size, spending the
 * budget on rollouts from a shortlist beats spending it on tree bookkeeping,
 * and it needs no learned value function.
 *
 * ponytail: candidates/rollouts are the two knobs that matter; both cost linear
 * time, so raise them only as far as the evaluation budget allows.
 */
export declare const rolloutPolicy: (options?: {
    candidates?: number;
    rollouts?: number;
    rng?: () => number;
}) => Policy;
//# sourceMappingURL=policies.d.ts.map