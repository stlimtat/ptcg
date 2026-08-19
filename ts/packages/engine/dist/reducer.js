import { actionRegistry } from "./actions/index.js";
export function applyAction(state, action) {
    const handler = actionRegistry.get(action.type);
    if (!handler) {
        throw new Error(`Unknown action type: ${action.type}`);
    }
    if (!handler.isLegal(state, action)) {
        throw new Error(`Illegal action: ${action.type}`);
    }
    return handler.apply(state, action);
}
//# sourceMappingURL=reducer.js.map