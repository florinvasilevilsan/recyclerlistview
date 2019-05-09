/***
 * Recycle pool for maintaining recyclable items, supports segregation by type as well.
 * Availability check, add/remove etc are all O(1), uses two maps to achieve constant time operation
 */
export default class RecycleItemPool {
    constructor() {
        this._recyclableObjectMap = {};
        this._availabilitySet = {};
    }
    putRecycledObject(objectType, object) {
        objectType = this._stringify(objectType);
        const objectSet = this._getRelevantSet(objectType);
        if (!this._availabilitySet[object]) {
            objectSet[object] = null;
            this._availabilitySet[object] = objectType;
        }
    }
    getRecycledObject(objectType) {
        objectType = this._stringify(objectType);
        const objectSet = this._getRelevantSet(objectType);
        let recycledObject = null;
        for (const property in objectSet) {
            if (objectSet.hasOwnProperty(property)) {
                recycledObject = property;
                break;
            }
        }
        if (recycledObject) {
            delete objectSet[recycledObject];
            delete this._availabilitySet[recycledObject];
        }
        return recycledObject;
    }
    removeFromPool(object) {
        if (this._availabilitySet[object]) {
            delete this._getRelevantSet(this._availabilitySet[object])[object];
            delete this._availabilitySet[object];
            return true;
        }
        return false;
    }
    clearAll() {
        this._recyclableObjectMap = {};
        this._availabilitySet = {};
    }
    _getRelevantSet(objectType) {
        let objectSet = this._recyclableObjectMap[objectType];
        if (!objectSet) {
            objectSet = {};
            this._recyclableObjectMap[objectType] = objectSet;
        }
        return objectSet;
    }
    _stringify(objectType) {
        if (typeof objectType === "number") {
            objectType = objectType.toString();
        }
        return objectType;
    }
}
//# sourceMappingURL=RecycleItemPool.js.map