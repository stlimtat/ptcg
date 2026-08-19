import { getCard, getPokemon, nextRandom } from "../cardLookup.js";
import { ask, effectSteps } from "./choice.js";
import { shuffleDeck } from "./shuffle.js";
const opponentOf = (p) => (p === "p1" ? "p2" : "p1");
function patch(state, player, fields) {
    return { ...state, players: { ...state.players, [player]: { ...state.players[player], ...fields } } };
}
function draw(state, player, count) {
    const ps = state.players[player];
    const n = Math.min(count, ps.deck.length);
    return patch(state, player, { deck: ps.deck.slice(n), hand: [...ps.hand, ...ps.deck.slice(0, n)] });
}
/** Remove instances from every zone of a player, returning the trimmed state. */
function removeFromZones(state, player, ids) {
    const ps = state.players[player];
    const keep = (c) => !ids.has(c.instanceId);
    return patch(state, player, {
        hand: ps.hand.filter(keep),
        deck: ps.deck.filter(keep),
        discard: ps.discard.filter(keep),
    });
}
const isPokemon = (state, c) => getCard(state, c.cardId)?.type === "pokemon";
const isBasicEnergy = (state, c) => {
    const def = getCard(state, c.cardId);
    return def?.type === "energy" && def.basic === true;
};
/** ex / V / Radiant / ACE SPEC cards all have a Rule Box. */
export function hasRuleBox(state, c) {
    const def = getCard(state, c.cardId);
    if (!def)
        return false;
    if ((def.prizeValue ?? 1) > 1)
        return true;
    return (def.subtypes ?? []).some((s) => /^(ex|V|VMAX|VSTAR|Radiant|ACE SPEC)$/i.test(s));
}
const pokemonInPlay = (ps) => [ps.active, ...ps.bench].filter((p) => !!p);
function attachEnergyTo(state, player, energy, targetId) {
    const ps = state.players[player];
    const add = (p) => p.card.instanceId === targetId ? { ...p, attachedEnergy: [...p.attachedEnergy, energy] } : p;
    return patch(state, player, {
        active: ps.active ? add(ps.active) : null,
        bench: ps.bench.map(add),
    });
}
function benchPokemon(state, player, cards) {
    const ps = state.players[player];
    const room = Math.max(0, 5 - ps.bench.length);
    const placed = cards.slice(0, room);
    return patch(state, player, {
        bench: [
            ...ps.bench,
            ...placed.map((card) => ({
                card,
                damage: 0,
                attachedEnergy: [],
                attachedTools: [],
                statusConditions: [],
                placedOnTurn: state.turn,
            })),
        ],
    });
}
// ---------------------------------------------------------------------------
// Card implementations. Step 0 runs when the card is played; later steps run
// once the player has answered the choice the previous step asked for.
// ---------------------------------------------------------------------------
const searchDeckToHand = (effect, prompt, filter, count = 1, optional = true) => [
    (state, player) => ask(state, {
        player,
        prompt,
        options: state.players[player].deck.filter((c) => filter(state, c)).map((c) => c.instanceId),
        remaining: count,
        optional,
        effect,
        step: 1,
    }),
    (state, player, picked) => {
        const ids = new Set(picked.map((c) => c.instanceId));
        const ps = state.players[player];
        const next = patch(state, player, {
            deck: ps.deck.filter((c) => !ids.has(c.instanceId)),
            hand: [...ps.hand, ...picked],
        });
        return shuffleDeck(next, player);
    },
];
export const trainerEffects = {
    "Ultra Ball": [
        // Cost first: discarding 2 cards is what pays for the search.
        (state, player) => ask(state, {
            player,
            prompt: "Discard 2 cards from your hand",
            options: state.players[player].hand.map((c) => c.instanceId),
            remaining: 2,
            optional: false,
            effect: "Ultra Ball",
            step: 1,
        }),
        (state, player, picked) => {
            const ids = new Set(picked.map((c) => c.instanceId));
            const ps = state.players[player];
            const next = patch(state, player, {
                hand: ps.hand.filter((c) => !ids.has(c.instanceId)),
                discard: [...ps.discard, ...picked],
            });
            return ask(next, {
                player,
                prompt: "Search your deck for a Pokémon",
                options: next.players[player].deck.filter((c) => isPokemon(next, c)).map((c) => c.instanceId),
                remaining: 1,
                optional: true,
                effect: "Ultra Ball",
                step: 2,
            });
        },
        (state, player, picked) => {
            const ids = new Set(picked.map((c) => c.instanceId));
            const ps = state.players[player];
            return shuffleDeck(patch(state, player, { deck: ps.deck.filter((c) => !ids.has(c.instanceId)), hand: [...ps.hand, ...picked] }), player);
        },
    ],
    "Poké Pad": searchDeckToHand("Poké Pad", "Search your deck for a Pokémon without a Rule Box", (state, c) => isPokemon(state, c) && !hasRuleBox(state, c)),
    "Night Stretcher": [
        (state, player) => ask(state, {
            player,
            prompt: "Put a Pokémon or Basic Energy from your discard into your hand",
            options: state.players[player].discard
                .filter((c) => isPokemon(state, c) || isBasicEnergy(state, c))
                .map((c) => c.instanceId),
            remaining: 1,
            optional: true,
            effect: "Night Stretcher",
            step: 1,
        }),
        (state, player, picked) => {
            const ids = new Set(picked.map((c) => c.instanceId));
            const ps = state.players[player];
            return patch(state, player, {
                discard: ps.discard.filter((c) => !ids.has(c.instanceId)),
                hand: [...ps.hand, ...picked],
            });
        },
    ],
    "Lillie's Determination": [
        (state, player) => {
            const ps = state.players[player];
            const shuffled = shuffleDeck(patch(state, player, { deck: [...ps.deck, ...ps.hand], hand: [] }), player);
            return draw(shuffled, player, ps.prizes.length === 6 ? 8 : 6);
        },
    ],
    Judge: [
        (state, player) => {
            let next = state;
            for (const p of [player, opponentOf(player)]) {
                const ps = next.players[p];
                next = shuffleDeck(patch(next, p, { deck: [...ps.deck, ...ps.hand], hand: [] }), p);
                next = draw(next, p, 4);
            }
            return next;
        },
    ],
    "Boss's Orders": [
        (state, player) => ask(state, {
            player,
            prompt: "Switch in one of your opponent's Benched Pokémon",
            options: state.players[opponentOf(player)].bench.map((p) => p.card.instanceId),
            remaining: 1,
            optional: false,
            effect: "Boss's Orders",
            step: 1,
        }),
        (state, player, picked) => {
            const target = picked[0];
            const opp = opponentOf(player);
            const ops = state.players[opp];
            const gust = ops.bench.find((p) => p.card.instanceId === target?.instanceId);
            if (!gust || !ops.active)
                return state;
            return patch(state, opp, {
                active: { ...gust, statusConditions: [] },
                bench: [...ops.bench.filter((p) => p !== gust), ops.active],
            });
        },
    ],
    Switch: [
        (state, player) => ask(state, {
            player,
            prompt: "Switch your Active Pokémon with a Benched Pokémon",
            options: state.players[player].bench.map((p) => p.card.instanceId),
            remaining: 1,
            optional: false,
            effect: "Switch",
            step: 1,
        }),
        (state, player, picked) => {
            const ps = state.players[player];
            const incoming = ps.bench.find((p) => p.card.instanceId === picked[0]?.instanceId);
            if (!incoming || !ps.active)
                return state;
            return patch(state, player, {
                active: { ...incoming, statusConditions: [] },
                bench: [...ps.bench.filter((p) => p !== incoming), ps.active],
            });
        },
    ],
    "Buddy-Buddy Poffin": [
        (state, player) => ask(state, {
            player,
            prompt: "Search your deck for up to 2 Basic Pokémon with 70 HP or less",
            options: state.players[player].deck
                .filter((c) => {
                const def = getCard(state, c.cardId);
                return def?.type === "pokemon" && def.stage === 0 && def.hp <= 70;
            })
                .map((c) => c.instanceId),
            remaining: Math.min(2, Math.max(0, 5 - state.players[player].bench.length)),
            optional: true,
            effect: "Buddy-Buddy Poffin",
            step: 1,
        }),
        (state, player, picked) => {
            const ids = new Set(picked.map((c) => c.instanceId));
            const next = patch(state, player, { deck: state.players[player].deck.filter((c) => !ids.has(c.instanceId)) });
            return shuffleDeck(benchPokemon(next, player, picked), player);
        },
    ],
    Crispin: [
        (state, player) => ask(state, {
            player,
            prompt: "Search your deck for up to 2 Basic Energy of different types",
            options: state.players[player].deck.filter((c) => isBasicEnergy(state, c)).map((c) => c.instanceId),
            remaining: 2,
            optional: true,
            effect: "Crispin",
            step: 1,
        }),
        (state, player, picked) => {
            // Different types only: drop a second pick that duplicates the first.
            const typeOf = (c) => getCard(state, c.cardId)?.providesType;
            const chosen = picked.filter((c, i) => picked.findIndex((o) => typeOf(o) === typeOf(c)) === i);
            const ids = new Set(chosen.map((c) => c.instanceId));
            const ps = state.players[player];
            // First pick goes to hand, the rest gets attached.
            const [toHand, toAttach] = [chosen[0], chosen[1]];
            let next = patch(state, player, {
                deck: ps.deck.filter((c) => !ids.has(c.instanceId)),
                hand: toHand ? [...ps.hand, toHand] : ps.hand,
            });
            next = shuffleDeck(next, player);
            if (!toAttach)
                return next;
            return ask(next, {
                player,
                prompt: "Attach the other Energy to one of your Pokémon",
                options: pokemonInPlay(next.players[player]).map((p) => p.card.instanceId),
                picked: [toAttach.instanceId],
                remaining: 1,
                optional: false,
                effect: "Crispin",
                step: 2,
            });
        },
        (state, player, picked) => {
            // picked = [energy, target]
            const [energy, target] = picked;
            if (!energy || !target)
                return state;
            return attachEnergyTo(state, player, energy, target.instanceId);
        },
    ],
    "Crushing Hammer": [
        (state, player) => {
            const [value, next] = nextRandom(state);
            const heads = value >= 0.5;
            const logged = {
                ...next,
                log: [...next.log, { timestamp: Date.now(), player, message: `Crushing Hammer flip: ${heads ? "heads" : "tails"}` }],
            };
            if (!heads)
                return logged;
            const opp = opponentOf(player);
            return ask(logged, {
                player,
                prompt: "Discard an Energy from one of your opponent's Pokémon",
                options: pokemonInPlay(logged.players[opp]).flatMap((p) => p.attachedEnergy.map((e) => e.instanceId)),
                remaining: 1,
                optional: false,
                effect: "Crushing Hammer",
                step: 1,
            });
        },
        (state, player, picked) => {
            const opp = opponentOf(player);
            const energy = picked[0];
            if (!energy)
                return state;
            const strip = (p) => ({
                ...p,
                attachedEnergy: p.attachedEnergy.filter((e) => e.instanceId !== energy.instanceId),
            });
            const ops = state.players[opp];
            return patch(state, opp, {
                active: ops.active ? strip(ops.active) : null,
                bench: ops.bench.map(strip),
                discard: [...ops.discard, energy],
            });
        },
    ],
    "Lana's Aid": [
        (state, player) => ask(state, {
            player,
            prompt: "Put up to 3 Pokémon without a Rule Box or Basic Energy from your discard into your hand",
            options: state.players[player].discard
                .filter((c) => (isPokemon(state, c) && !hasRuleBox(state, c)) || isBasicEnergy(state, c))
                .map((c) => c.instanceId),
            remaining: 3,
            optional: true,
            effect: "Lana's Aid",
            step: 1,
        }),
        (state, player, picked) => {
            const ids = new Set(picked.map((c) => c.instanceId));
            const ps = state.players[player];
            return patch(state, player, {
                discard: ps.discard.filter((c) => !ids.has(c.instanceId)),
                hand: [...ps.hand, ...picked],
            });
        },
    ],
    Dawn: searchDeckToHand("Dawn", "Search your deck for a Basic, a Stage 1 and a Stage 2 Pokémon", (state, c) => isPokemon(state, c), 3),
    "Ciphermaniac's Codebreaking": [
        (state, player) => ask(state, {
            player,
            prompt: "Search your deck for 2 cards to put on top of it",
            options: state.players[player].deck.map((c) => c.instanceId),
            remaining: 2,
            optional: true,
            effect: "Ciphermaniac's Codebreaking",
            step: 1,
        }),
        (state, player, picked) => {
            const ids = new Set(picked.map((c) => c.instanceId));
            const ps = state.players[player];
            const shuffled = shuffleDeck(patch(state, player, { deck: ps.deck.filter((c) => !ids.has(c.instanceId)) }), player);
            return patch(shuffled, player, { deck: [...picked, ...shuffled.players[player].deck] });
        },
    ],
    "Unfair Stamp": [
        (state, player) => {
            let next = state;
            const opp = opponentOf(player);
            for (const [p, count] of [
                [player, 5],
                [opp, 2],
            ]) {
                const ps = next.players[p];
                next = shuffleDeck(patch(next, p, { deck: [...ps.deck, ...ps.hand], hand: [] }), p);
                next = draw(next, p, count);
            }
            return next;
        },
    ],
    "Rare Candy": [
        (state, player) => ask(state, {
            player,
            prompt: "Choose a Basic Pokémon in play to evolve",
            options: pokemonInPlay(state.players[player])
                .filter((p) => {
                const def = getCard(state, p.card.cardId);
                return def?.type === "pokemon" && def.stage === 0 && (p.placedOnTurn ?? -1) < state.turn;
            })
                .map((p) => p.card.instanceId),
            remaining: 1,
            optional: false,
            effect: "Rare Candy",
            step: 1,
        }),
        (state, player, picked) => {
            const basic = picked[0];
            const basicDef = basic && getCard(state, basic.cardId);
            if (!basicDef || basicDef.type !== "pokemon")
                return state;
            // Only a Stage 2 that evolves from that Basic's evolution line qualifies.
            const options = state.players[player].hand.filter((c) => {
                const def = getCard(state, c.cardId);
                if (def?.type !== "pokemon" || def.stage !== 2)
                    return false;
                const middle = state.cardRegistry
                    ? Object.values(state.cardRegistry).find((m) => m.type === "pokemon" && m.name === def.evolvesFrom)
                    : null;
                return !!middle && middle.type === "pokemon" && middle.evolvesFrom === basicDef.name;
            });
            return ask(state, {
                player,
                prompt: "Choose a Stage 2 card in your hand",
                options: options.map((c) => c.instanceId),
                picked: [basic.instanceId],
                remaining: 1,
                optional: false,
                effect: "Rare Candy",
                step: 2,
            });
        },
        (state, player, picked) => {
            const [basic, stage2] = picked;
            if (!basic || !stage2)
                return state;
            const ps = state.players[player];
            const evolve = (p) => p.card.instanceId === basic.instanceId
                ? { ...p, card: stage2, statusConditions: [], placedOnTurn: state.turn }
                : p;
            return patch(state, player, {
                hand: ps.hand.filter((c) => c.instanceId !== stage2.instanceId),
                active: ps.active ? evolve(ps.active) : null,
                bench: ps.bench.map(evolve),
                discard: [...ps.discard, basic],
            });
        },
    ],
    "Team Rocket's Petrel": searchDeckToHand("Team Rocket's Petrel", "Search your deck for a Trainer card", (state, c) => getCard(state, c.cardId)?.type === "trainer"),
    "Team Rocket's Transceiver": searchDeckToHand("Team Rocket's Transceiver", "Search your deck for a Team Rocket's Supporter", (state, c) => {
        const def = getCard(state, c.cardId);
        return def?.type === "trainer" && def.subtype === "supporter" && def.name.includes("Team Rocket");
    }),
    Cyrano: searchDeckToHand("Cyrano", "Search your deck for up to 3 Pokémon ex", (state, c) => {
        const def = getCard(state, c.cardId);
        return def?.type === "pokemon" && (def.subtypes ?? []).includes("ex");
    }, 3),
    Hilda: searchDeckToHand("Hilda", "Search your deck for an Evolution Pokémon and an Energy card", (state, c) => {
        const def = getCard(state, c.cardId);
        return def?.type === "energy" || (def?.type === "pokemon" && def.stage > 0);
    }, 2),
    // Look at the top 7 and take what you can find there.
    "Pokégear 3.0": lookAtTop("Pokégear 3.0", 7, 1, "Reveal a Supporter from the top 7 cards of your deck", (state, c) => {
        const def = getCard(state, c.cardId);
        return def?.type === "trainer" && def.subtype === "supporter";
    }),
    "Bug Catching Set": lookAtTop("Bug Catching Set", 7, 2, "Reveal up to 2 Grass Pokémon or Basic Grass Energy from the top 7", (state, c) => {
        const def = getCard(state, c.cardId);
        if (def?.type === "pokemon")
            return (def.types ?? []).includes("Grass");
        return def?.type === "energy" && def.basic === true && def.providesType === "Grass";
    }),
    "Energy Switch": [
        (state, player) => ask(state, {
            player,
            prompt: "Move a Basic Energy from one of your Pokémon",
            options: pokemonInPlay(state.players[player]).flatMap((p) => p.attachedEnergy.filter((e) => isBasicEnergy(state, e)).map((e) => e.instanceId)),
            remaining: 1,
            optional: false,
            effect: "Energy Switch",
            step: 1,
        }),
        (state, player, picked) => {
            const energy = picked[0];
            if (!energy)
                return state;
            const ps = state.players[player];
            const source = pokemonInPlay(ps).find((p) => p.attachedEnergy.some((e) => e.instanceId === energy.instanceId));
            return ask(state, {
                player,
                prompt: "Move it to another of your Pokémon",
                options: pokemonInPlay(ps)
                    .filter((p) => p !== source)
                    .map((p) => p.card.instanceId),
                picked: [energy.instanceId],
                remaining: 1,
                optional: false,
                effect: "Energy Switch",
                step: 2,
            });
        },
        (state, player, picked) => {
            const [energy, target] = picked;
            if (!energy || !target)
                return state;
            const ps = state.players[player];
            const strip = (p) => ({
                ...p,
                attachedEnergy: p.attachedEnergy.filter((e) => e.instanceId !== energy.instanceId),
            });
            const stripped = patch(state, player, {
                active: ps.active ? strip(ps.active) : null,
                bench: ps.bench.map(strip),
            });
            return attachEnergyTo(stripped, player, energy, target.instanceId);
        },
    ],
    "Wondrous Patch": [
        (state, player) => ask(state, {
            player,
            prompt: "Attach a Basic Psychic Energy from your discard to a Benched Psychic Pokémon",
            options: state.players[player].discard
                .filter((c) => {
                const def = getCard(state, c.cardId);
                return def?.type === "energy" && def.basic === true && def.providesType === "Psychic";
            })
                .map((c) => c.instanceId),
            remaining: 1,
            optional: false,
            effect: "Wondrous Patch",
            step: 1,
        }),
        (state, player, picked) => {
            const energy = picked[0];
            if (!energy)
                return state;
            return ask(state, {
                player,
                prompt: "Choose a Benched Psychic Pokémon",
                options: state.players[player].bench
                    .filter((p) => {
                    const def = getCard(state, p.card.cardId);
                    return def?.type === "pokemon" && def.types.includes("Psychic");
                })
                    .map((p) => p.card.instanceId),
                picked: [energy.instanceId],
                remaining: 1,
                optional: false,
                effect: "Wondrous Patch",
                step: 2,
            });
        },
        (state, player, picked) => {
            const [energy, target] = picked;
            if (!energy || !target)
                return state;
            const ps = state.players[player];
            const attached = attachEnergyTo(state, player, energy, target.instanceId);
            return patch(attached, player, {
                discard: ps.discard.filter((c) => c.instanceId !== energy.instanceId),
            });
        },
    ],
    "Sacred Ash": [
        (state, player) => ask(state, {
            player,
            prompt: "Shuffle up to 5 Pokémon from your discard pile into your deck",
            options: state.players[player].discard.filter((c) => isPokemon(state, c)).map((c) => c.instanceId),
            remaining: 5,
            optional: true,
            effect: "Sacred Ash",
            step: 1,
        }),
        (state, player, picked) => {
            const ids = new Set(picked.map((c) => c.instanceId));
            const ps = state.players[player];
            return shuffleDeck(patch(state, player, {
                discard: ps.discard.filter((c) => !ids.has(c.instanceId)),
                deck: [...ps.deck, ...picked],
            }), player);
        },
    ],
    // "Team Rocket's" cards care whether your board is all Team Rocket's Pokémon.
    "Team Rocket's Ariana": [
        (state, player) => {
            const ps = state.players[player];
            const board = pokemonInPlay(ps);
            const allRocket = board.length > 0 && board.every((p) => getPokemon(state, p.card.cardId)?.name.startsWith("Team Rocket's"));
            const target = allRocket ? 8 : 5;
            return draw(state, player, Math.max(0, target - ps.hand.length));
        },
    ],
    "Team Rocket's Proton": searchDeckToHand("Team Rocket's Proton", "Search your deck for up to 3 Basic Team Rocket's Pokémon", (state, c) => {
        const def = getPokemon(state, c.cardId);
        return def?.stage === 0 && def.name.startsWith("Team Rocket's");
    }, 3),
    "Team Rocket's Archer": [
        (state, player) => {
            let next = state;
            const opp = opponentOf(player);
            for (const [p, count] of [
                [player, 5],
                [opp, 3],
            ]) {
                const ps = next.players[p];
                next = shuffleDeck(patch(next, p, { deck: [...ps.deck, ...ps.hand], hand: [] }), p);
                next = draw(next, p, count);
            }
            return next;
        },
    ],
    "Team Rocket's Giovanni": [
        (state, player) => ask(state, {
            player,
            prompt: "Switch your Active Team Rocket's Pokémon with a Benched one",
            options: state.players[player].bench
                .filter((p) => getPokemon(state, p.card.cardId)?.name.startsWith("Team Rocket's"))
                .map((p) => p.card.instanceId),
            remaining: 1,
            optional: false,
            effect: "Team Rocket's Giovanni",
            step: 1,
        }),
        (state, player, picked) => {
            const ps = state.players[player];
            const incoming = ps.bench.find((p) => p.card.instanceId === picked[0]?.instanceId);
            if (!incoming || !ps.active)
                return state;
            const switched = patch(state, player, {
                active: { ...incoming, statusConditions: [] },
                bench: [...ps.bench.filter((p) => p !== incoming), ps.active],
            });
            // "If you do" — the gust only happens because the switch happened.
            const opp = opponentOf(player);
            return ask(switched, {
                player,
                prompt: "Switch in one of your opponent's Benched Pokémon",
                options: switched.players[opp].bench.map((p) => p.card.instanceId),
                remaining: 1,
                optional: false,
                effect: "Team Rocket's Giovanni",
                step: 2,
            });
        },
        (state, player, picked) => {
            const opp = opponentOf(player);
            const ops = state.players[opp];
            const gust = ops.bench.find((p) => p.card.instanceId === picked[0]?.instanceId);
            if (!gust || !ops.active)
                return state;
            return patch(state, opp, {
                active: { ...gust, statusConditions: [] },
                bench: [...ops.bench.filter((p) => p !== gust), ops.active],
            });
        },
    ],
    "Rosa's Encouragement": [
        (state, player) => ask(state, {
            player,
            prompt: "Attach up to 2 Basic Energy from your discard to a Stage 2 Pokémon",
            options: state.players[player].discard.filter((c) => isBasicEnergy(state, c)).map((c) => c.instanceId),
            remaining: 2,
            optional: true,
            effect: "Rosa's Encouragement",
            step: 1,
        }),
        (state, player, picked) => {
            if (picked.length === 0)
                return state;
            return ask(state, {
                player,
                prompt: "Choose a Stage 2 Pokémon to attach them to",
                options: pokemonInPlay(state.players[player])
                    .filter((p) => getPokemon(state, p.card.cardId)?.stage === 2)
                    .map((p) => p.card.instanceId),
                picked: picked.map((c) => c.instanceId),
                remaining: 1,
                optional: false,
                effect: "Rosa's Encouragement",
                step: 2,
            });
        },
        (state, player, picked) => {
            const target = picked[picked.length - 1];
            const energies = picked.slice(0, -1);
            if (!target || energies.length === 0)
                return state;
            const ids = new Set(energies.map((c) => c.instanceId));
            let next = patch(state, player, {
                discard: state.players[player].discard.filter((c) => !ids.has(c.instanceId)),
            });
            for (const energy of energies)
                next = attachEnergyTo(next, player, energy, target.instanceId);
            return next;
        },
    ],
    "Jumbo Ice Cream": [
        (state, player) => {
            const active = state.players[player].active;
            if (!active || active.attachedEnergy.length < 3)
                return state;
            return patch(state, player, { active: { ...active, damage: Math.max(0, active.damage - 80) } });
        },
    ],
    // Dusk Ball digs from the *bottom* of the deck.
    "Dusk Ball": [
        (state, player) => {
            const deck = state.players[player].deck;
            const bottom = deck.slice(Math.max(0, deck.length - 7));
            return ask(state, {
                player,
                prompt: "Look at the bottom 7 cards of your deck and reveal a Pokémon",
                options: bottom.filter((c) => isPokemon(state, c)).map((c) => c.instanceId),
                remaining: 1,
                optional: true,
                effect: "Dusk Ball",
                step: 1,
            });
        },
        (state, player, picked) => {
            const ids = new Set(picked.map((c) => c.instanceId));
            const ps = state.players[player];
            return shuffleDeck(patch(state, player, { deck: ps.deck.filter((c) => !ids.has(c.instanceId)), hand: [...ps.hand, ...picked] }), player);
        },
    ],
    "Special Red Card": [
        (state, player) => {
            const opp = opponentOf(player);
            const ops = state.players[opp];
            if (ops.hand.length === 0)
                return state;
            const next = patch(state, opp, { hand: [], deck: [...ops.deck, ...ops.hand] });
            return draw(next, opp, 3);
        },
    ],
};
function lookAtTop(effect, depth, count, prompt, filter) {
    return [
        (state, player) => {
            const top = state.players[player].deck.slice(0, depth);
            return ask(state, {
                player,
                prompt,
                options: top.filter((c) => filter(state, c)).map((c) => c.instanceId),
                remaining: count,
                optional: true,
                effect,
                step: 1,
            });
        },
        (state, player, picked) => {
            const ids = new Set(picked.map((c) => c.instanceId));
            const ps = state.players[player];
            return shuffleDeck(patch(state, player, { deck: ps.deck.filter((c) => !ids.has(c.instanceId)), hand: [...ps.hand, ...picked] }), player);
        },
    ];
}
for (const [name, steps] of Object.entries(trainerEffects))
    effectSteps.set(name, steps);
/** Extra play restrictions beyond "it is a Trainer in your hand". */
export const trainerPlayable = {
    "Ultra Ball": (state, player) => state.players[player].hand.length >= 3,
    "Unfair Stamp": (state, player) => state.players[player].koedLastTurn === true,
    "Boss's Orders": (state, player) => state.players[opponentOf(player)].bench.length > 0,
    Switch: (state, player) => state.players[player].bench.length > 0,
    "Rosa's Encouragement": (state, player) => state.players[player].prizes.length > state.players[opponentOf(player)].prizes.length,
    "Special Red Card": (state, player) => state.players[player === "p1" ? "p2" : "p1"].prizes.length <= 3,
    "Team Rocket's Archer": (state, player) => state.players[player].koedLastTurn === true,
    "Team Rocket's Giovanni": (state, player) => {
        const ps = state.players[player];
        return (!!ps.active &&
            getPokemon(state, ps.active.card.cardId)?.name.startsWith("Team Rocket's") === true &&
            ps.bench.some((p) => getPokemon(state, p.card.cardId)?.name.startsWith("Team Rocket's")) &&
            state.players[player === "p1" ? "p2" : "p1"].bench.length > 0);
    },
    "Jumbo Ice Cream": (state, player) => (state.players[player].active?.attachedEnergy.length ?? 0) >= 3,
    "Energy Switch": (state, player) => [state.players[player].active, ...state.players[player].bench].filter((p) => p).length > 1,
    "Rare Candy": (state, player) => state.turn > 1 &&
        pokemonInPlay(state.players[player]).some((p) => {
            const def = getCard(state, p.card.cardId);
            return def?.type === "pokemon" && def.stage === 0 && (p.placedOnTurn ?? -1) < state.turn;
        }),
};
export function applyTrainerEffect(state, trainerName, player) {
    const steps = trainerEffects[trainerName];
    if (!steps)
        return state; // ponytail: unimplemented card is a no-op, tracked by the coverage test
    return steps[0](state, player, []);
}
export const isTrainerImplemented = (name) => name in trainerEffects;
// Kept for the removed helper's callers.
export { removeFromZones };
//# sourceMappingURL=trainers.js.map