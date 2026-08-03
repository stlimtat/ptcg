export function executeEffect(script, context) {
    let ctx = { ...context };
    for (const node of script) {
        ctx = executeNode(node, ctx);
    }
    return ctx;
}
function executeNode(node, ctx) {
    if (node.op === "dealDamage") {
        const amount = node.amount === "coinFlipDouble"
            ? (ctx.rng?.() || Math.random()) >= 0.5
                ? 40
                : 0
            : node.amount;
        return {
            ...ctx,
            currentDamage: ctx.currentDamage + amount,
        };
    }
    if (node.op === "flipCoin") {
        const isHeads = (ctx.rng?.() || Math.random()) >= 0.5;
        const branch = isHeads ? node.onHeads : node.onTails;
        return executeEffect(branch, ctx);
    }
    if (node.op === "drawCards") {
        // Stub: drawing handled in game state, not here
        return ctx;
    }
    if (node.op === "discardEnergy") {
        // Stub
        return ctx;
    }
    if (node.op === "applyStatus") {
        // Stub
        return ctx;
    }
    if (node.op === "heal") {
        // Stub
        return ctx;
    }
    if (node.op === "modifyDamageTaken") {
        return {
            ...ctx,
            currentDamage: Math.max(0, ctx.currentDamage - node.amount),
        };
    }
    if (node.op === "modifyDamageDealt") {
        // Applied before damage, stub for now
        return ctx;
    }
    if (node.op === "custom") {
        // Stub: escape hatch, implemented elsewhere
        return ctx;
    }
    return ctx;
}
//# sourceMappingURL=interpreter.js.map