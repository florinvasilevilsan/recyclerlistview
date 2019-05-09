import RecycleItemPool from "../utils/RecycleItemPool";
import CustomError from "./exceptions/CustomError";
import RecyclerListViewExceptions from "./exceptions/RecyclerListViewExceptions";
import ViewabilityTracker from "./ViewabilityTracker";
import { ObjectUtil, Default } from "ts-object-utils";
import TSCast from "../utils/TSCast";
export default class VirtualRenderer {
    constructor(renderStackChanged, scrollOnNextUpdate, isRecyclingEnabled) {
        this._layoutProvider = TSCast.cast(null); //TSI
        this._recyclePool = TSCast.cast(null); //TSI
        this._layoutManager = null;
        this._viewabilityTracker = null;
        //Keeps track of items that need to be rendered in the next render cycle
        this._renderStack = {};
        //Keeps track of keys of all the currently rendered indexes, can eventually replace renderStack as well if no new use cases come up
        this._renderStackIndexKeyMap = {};
        this._renderStackChanged = renderStackChanged;
        this._scrollOnNextUpdate = scrollOnNextUpdate;
        this._dimensions = null;
        this._params = null;
        this._isRecyclingEnabled = isRecyclingEnabled;
        this._isViewTrackerRunning = false;
        //Would be surprised if someone exceeds this
        this._startKey = 0;
        this.onVisibleItemsChanged = null;
        this._onEngagedItemsChanged = this._onEngagedItemsChanged.bind(this);
        this._onVisibleItemsChanged = this._onVisibleItemsChanged.bind(this);
    }
    getLayoutDimension() {
        if (this._layoutManager) {
            return this._layoutManager.getLayoutDimension();
        }
        return { height: 0, width: 0 };
    }
    updateOffset(offsetX, offsetY) {
        if (this._viewabilityTracker) {
            if (!this._isViewTrackerRunning) {
                this.startViewabilityTracker();
            }
            if (this._params && this._params.isHorizontal) {
                this._viewabilityTracker.updateOffset(offsetX);
            }
            else {
                this._viewabilityTracker.updateOffset(offsetY);
            }
        }
    }
    attachVisibleItemsListener(callback) {
        this.onVisibleItemsChanged = callback;
    }
    removeVisibleItemsListener() {
        this.onVisibleItemsChanged = null;
        if (this._viewabilityTracker) {
            this._viewabilityTracker.onVisibleRowsChanged = null;
        }
    }
    getLayoutManager() {
        return this._layoutManager;
    }
    setParamsAndDimensions(params, dim) {
        this._params = params;
        this._dimensions = dim;
    }
    setLayoutManager(layoutManager) {
        this._layoutManager = layoutManager;
        if (this._params) {
            this._layoutManager.reLayoutFromIndex(0, this._params.itemCount);
        }
    }
    setLayoutProvider(layoutProvider) {
        this._layoutProvider = layoutProvider;
    }
    getViewabilityTracker() {
        return this._viewabilityTracker;
    }
    refreshWithAnchor() {
        if (this._viewabilityTracker) {
            const firstVisibleIndex = this._viewabilityTracker.findFirstLogicallyVisibleIndex();
            this._prepareViewabilityTracker();
            let offset = 0;
            if (this._layoutManager && this._params) {
                const point = this._layoutManager.getOffsetForIndex(firstVisibleIndex);
                this._scrollOnNextUpdate(point);
                offset = this._params.isHorizontal ? point.x : point.y;
            }
            this._viewabilityTracker.forceRefreshWithOffset(offset);
        }
    }
    refresh() {
        if (this._viewabilityTracker) {
            this._prepareViewabilityTracker();
            if (this._viewabilityTracker.forceRefresh()) {
                if (this._params && this._params.isHorizontal) {
                    this._scrollOnNextUpdate({ x: this._viewabilityTracker.getLastOffset(), y: 0 });
                }
                else {
                    this._scrollOnNextUpdate({ x: 0, y: this._viewabilityTracker.getLastOffset() });
                }
            }
        }
    }
    getInitialOffset() {
        let offset = { x: 0, y: 0 };
        if (this._params) {
            const initialRenderIndex = Default.value(this._params.initialRenderIndex, 0);
            if (initialRenderIndex > 0 && this._layoutManager) {
                offset = this._layoutManager.getOffsetForIndex(initialRenderIndex);
                this._params.initialOffset = this._params.isHorizontal ? offset.x : offset.y;
            }
            else {
                if (this._params.isHorizontal) {
                    offset.x = Default.value(this._params.initialOffset, 0);
                    offset.y = 0;
                }
                else {
                    offset.y = Default.value(this._params.initialOffset, 0);
                    offset.x = 0;
                }
            }
        }
        return offset;
    }
    init() {
        this.getInitialOffset();
        this._recyclePool = new RecycleItemPool();
        if (this._params) {
            this._viewabilityTracker = new ViewabilityTracker(Default.value(this._params.renderAheadOffset, 0), Default.value(this._params.initialOffset, 0));
        }
        else {
            this._viewabilityTracker = new ViewabilityTracker(0, 0);
        }
        this._prepareViewabilityTracker();
    }
    startViewabilityTracker() {
        if (this._viewabilityTracker) {
            this._isViewTrackerRunning = true;
            this._viewabilityTracker.init();
        }
    }
    _getNewKey() {
        return this._startKey++;
    }
    _prepareViewabilityTracker() {
        if (this._viewabilityTracker && this._layoutManager && this._dimensions && this._params) {
            this._viewabilityTracker.onEngagedRowsChanged = this._onEngagedItemsChanged;
            if (this.onVisibleItemsChanged) {
                this._viewabilityTracker.onVisibleRowsChanged = this._onVisibleItemsChanged;
            }
            this._viewabilityTracker.setLayouts(this._layoutManager.getLayouts(), this._params.isHorizontal ?
                this._layoutManager.getLayoutDimension().width :
                this._layoutManager.getLayoutDimension().height);
            this._viewabilityTracker.setDimensions({
                height: this._dimensions.height,
                width: this._dimensions.width,
            }, Default.value(this._params.isHorizontal, false));
        }
        else {
            throw new CustomError(RecyclerListViewExceptions.initializationException);
        }
    }
    _onVisibleItemsChanged(all, now, notNow) {
        if (this.onVisibleItemsChanged) {
            this.onVisibleItemsChanged(all, now, notNow);
        }
    }
    _onEngagedItemsChanged(all, now, notNow) {
        const count = notNow.length;
        let resolvedIndex = 0;
        let disengagedIndex = 0;
        if (this._isRecyclingEnabled) {
            for (let i = 0; i < count; i++) {
                disengagedIndex = notNow[i];
                resolvedIndex = this._renderStackIndexKeyMap[disengagedIndex];
                if (this._params && disengagedIndex < this._params.itemCount) {
                    //All the items which are now not visible can go to the recycle pool, the pool only needs to maintain keys since
                    //react can link a view to a key automatically
                    this._recyclePool.putRecycledObject(this._layoutProvider.getLayoutTypeForIndex(disengagedIndex), resolvedIndex);
                }
                else {
                    //Type provider may not be available in this case, use most probable
                    const itemMeta = this._renderStack[resolvedIndex];
                    this._recyclePool.putRecycledObject(itemMeta.type ? itemMeta.type : 0, resolvedIndex);
                }
            }
        }
        if (this._updateRenderStack(now)) {
            //Ask Recycler View to update itself
            this._renderStackChanged(this._renderStack);
        }
    }
    //Updates render stack and reports whether anything has changed
    _updateRenderStack(itemIndexes) {
        const count = itemIndexes.length;
        let type = null;
        let availableKey = null;
        let itemMeta = null;
        let index = 0;
        let hasRenderStackChanged = false;
        for (let i = 0; i < count; i++) {
            index = itemIndexes[i];
            availableKey = this._renderStackIndexKeyMap[index];
            if (availableKey >= 0) {
                //Use if already rendered and remove from pool
                this._recyclePool.removeFromPool(availableKey);
                itemMeta = this._renderStack[availableKey];
                if (itemMeta.key !== availableKey) {
                    hasRenderStackChanged = true;
                    itemMeta.key = availableKey;
                }
            }
            else {
                hasRenderStackChanged = true;
                type = this._layoutProvider.getLayoutTypeForIndex(index);
                availableKey = this._recyclePool.getRecycledObject(type);
                if (availableKey) {
                    //If available in pool use that key instead
                    availableKey = parseInt(availableKey, 10);
                    itemMeta = this._renderStack[availableKey];
                    if (!itemMeta) {
                        itemMeta = {};
                        this._renderStack[availableKey] = itemMeta;
                    }
                    itemMeta.key = availableKey;
                    itemMeta.type = type;
                    //since this data index is no longer being rendered anywhere
                    if (!ObjectUtil.isNullOrUndefined(itemMeta.dataIndex)) {
                        delete this._renderStackIndexKeyMap[itemMeta.dataIndex];
                    }
                }
                else {
                    //Create new if no existing key is available
                    itemMeta = {};
                    availableKey = this._getNewKey();
                    itemMeta.key = availableKey;
                    itemMeta.type = type;
                    this._renderStack[availableKey] = itemMeta;
                }
                //TODO:Talha validate if this causes an issue
                //In case of mismatch in pool types we need to make sure only unique data indexes exist in render stack
                //keys are always integers for all practical purposes
                // alreadyRenderedAtKey = this._renderStackIndexKeyMap[index];
                // if (alreadyRenderedAtKey >= 0) {
                //     this._recyclePool.removeFromPool(alreadyRenderedAtKey);
                //     delete this._renderStack[alreadyRenderedAtKey];
                // }
            }
            this._renderStackIndexKeyMap[index] = itemMeta.key;
            itemMeta.dataIndex = index;
        }
        return hasRenderStackChanged;
    }
}
//# sourceMappingURL=VirtualRenderer.js.map