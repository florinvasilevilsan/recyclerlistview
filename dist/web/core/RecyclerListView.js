/***
 * DONE: Reduce layout processing on data insert
 * DONE: Add notify data set changed and notify data insert option in data source
 * DONE: Add on end reached callback
 * DONE: Make another class for render stack generator
 * DONE: Simplify rendering a loading footer
 * DONE: Anchor first visible index on any insert/delete data wise
 * DONE: Build Scroll to index
 * DONE: Give viewability callbacks
 * DONE: Add full render logic in cases like change of dimensions
 * DONE: Fix all proptypes
 * DONE: Add Initial render Index support
 * TODO: Destroy less frequently used items in recycle pool, this will help in case of too many types.
 * TODO: Add animated scroll to web scrollviewer
 * TODO: Animate list view transition, including add/remove
 * TODO: Implement sticky headers
 * TODO: Make viewability callbacks configurable
 * TODO: Observe size changes on web to optimize for reflowability
 * TODO: Solve //TSI
 */
import debounce from "lodash-es/debounce";
import * as PropTypes from "prop-types";
import * as React from "react";
import { ObjectUtil, Default } from "ts-object-utils";
import ContextProvider from "./dependencies/ContextProvider";
import DataProvider from "./dependencies/DataProvider";
import LayoutProvider from "./dependencies/LayoutProvider";
import CustomError from "./exceptions/CustomError";
import RecyclerListViewExceptions from "./exceptions/RecyclerListViewExceptions";
import LayoutManager from "./layoutmanager/LayoutManager";
import Messages from "./messages/Messages";
import VirtualRenderer from "./VirtualRenderer";
import { BaseItemAnimator } from "./ItemAnimator";
//#if [REACT-NATIVE]
//import ScrollComponent from "../platform/reactnative/scrollcomponent/ScrollComponent";
//import ViewRenderer from "../platform/reactnative/viewrenderer/ViewRenderer";
//import { DefaultJSItemAnimator as DefaultItemAnimator } from "../platform/reactnative/itemanimators/defaultjsanimator/DefaultJSItemAnimator";
//import { Platform } from "react-native";
//const IS_WEB = Platform.OS === "web";
//#endif
/***
 * To use on web, start importing from recyclerlistview/web. To make it even easier specify an alias in you builder of choice.
 */
//#if [WEB]
import ScrollComponent from "../platform/web/scrollcomponent/ScrollComponent";
import ViewRenderer from "../platform/web/viewrenderer/ViewRenderer";
import { DefaultWebItemAnimator as DefaultItemAnimator } from "../platform/web/itemanimators/DefaultWebItemAnimator";
const IS_WEB = true;
//#endif
const refreshRequestDebouncer = debounce((executable) => {
    executable();
});
export default class RecyclerListView extends React.Component {
    constructor(props) {
        super(props);
        this._onEndReachedCalled = false;
        this._initComplete = false;
        this._relayoutReqIndex = -1;
        this._params = {
            initialOffset: 0,
            initialRenderIndex: 0,
            isHorizontal: false,
            itemCount: 0,
            renderAheadOffset: 250,
        };
        this._layout = { height: 0, width: 0 };
        this._pendingScrollToOffset = null;
        this._tempDim = { height: 0, width: 0 };
        this._initialOffset = 0;
        this._scrollComponent = null;
        this._defaultItemAnimator = new DefaultItemAnimator();
        this._onScroll = this._onScroll.bind(this);
        this._onSizeChanged = this._onSizeChanged.bind(this);
        this._dataHasChanged = this._dataHasChanged.bind(this);
        this.scrollToOffset = this.scrollToOffset.bind(this);
        this._renderStackWhenReady = this._renderStackWhenReady.bind(this);
        this._onViewContainerSizeChange = this._onViewContainerSizeChange.bind(this);
        this._virtualRenderer = new VirtualRenderer(this._renderStackWhenReady, (offset) => {
            this._pendingScrollToOffset = offset;
        }, !props.disableRecycling);
        this.state = {
            renderStack: {},
        };
    }
    componentWillReceiveProps(newProps) {
        this._assertDependencyPresence(newProps);
        this._checkAndChangeLayouts(newProps);
        if (!this.props.onVisibleIndexesChanged) {
            this._virtualRenderer.removeVisibleItemsListener();
        }
        else {
            this._virtualRenderer.attachVisibleItemsListener(this.props.onVisibleIndexesChanged);
        }
    }
    componentDidUpdate() {
        if (this._pendingScrollToOffset) {
            const offset = this._pendingScrollToOffset;
            this._pendingScrollToOffset = null;
            if (this.props.isHorizontal) {
                offset.y = 0;
            }
            else {
                offset.x = 0;
            }
            setTimeout(() => {
                this.scrollToOffset(offset.x, offset.y, false);
            }, 0);
        }
        this._processOnEndReached();
        this._checkAndChangeLayouts(this.props);
    }
    componentWillUnmount() {
        if (this.props.contextProvider) {
            const uniqueKey = this.props.contextProvider.getUniqueKey();
            if (uniqueKey) {
                this.props.contextProvider.save(uniqueKey, this.getCurrentScrollOffset());
                if (this.props.forceNonDeterministicRendering) {
                    if (this._virtualRenderer) {
                        const layoutManager = this._virtualRenderer.getLayoutManager();
                        if (layoutManager) {
                            const layoutsToCache = layoutManager.getLayouts();
                            this.props.contextProvider.save(uniqueKey + "_layouts", JSON.stringify({ layoutArray: layoutsToCache }));
                        }
                    }
                }
            }
        }
    }
    componentWillMount() {
        if (this.props.contextProvider) {
            const uniqueKey = this.props.contextProvider.getUniqueKey();
            if (uniqueKey) {
                const offset = this.props.contextProvider.get(uniqueKey);
                if (typeof offset === "number" && offset > 0) {
                    this._initialOffset = offset;
                }
                if (this.props.forceNonDeterministicRendering) {
                    const cachedLayouts = this.props.contextProvider.get(uniqueKey + "_layouts");
                    if (cachedLayouts && typeof cachedLayouts === "string") {
                        this._cachedLayouts = JSON.parse(cachedLayouts).layoutArray;
                    }
                }
                this.props.contextProvider.remove(uniqueKey);
            }
        }
    }
    scrollToIndex(index, animate) {
        const layoutManager = this._virtualRenderer.getLayoutManager();
        if (layoutManager) {
            const offsets = layoutManager.getOffsetForIndex(index);
            this.scrollToOffset(offsets.x, offsets.y, animate);
        }
        else {
            console.warn(Messages.WARN_SCROLL_TO_INDEX); //tslint:disable-line
        }
    }
    scrollToItem(data, animate) {
        const count = this.props.dataProvider.getSize();
        for (let i = 0; i < count; i++) {
            if (this.props.dataProvider.getDataForIndex(i) === data) {
                this.scrollToIndex(i, animate);
                break;
            }
        }
    }
    scrollToTop(animate) {
        this.scrollToOffset(0, 0, animate);
    }
    scrollToEnd(animate) {
        const lastIndex = this.props.dataProvider.getSize() - 1;
        this.scrollToIndex(lastIndex, animate);
    }
    scrollToOffset(x, y, animate = false) {
        if (this._scrollComponent) {
            this._scrollComponent.scrollTo(x, y, animate);
        }
    }
    getCurrentScrollOffset() {
        const viewabilityTracker = this._virtualRenderer.getViewabilityTracker();
        return viewabilityTracker ? viewabilityTracker.getLastOffset() : 0;
    }
    findApproxFirstVisibleIndex() {
        const viewabilityTracker = this._virtualRenderer.getViewabilityTracker();
        return viewabilityTracker ? viewabilityTracker.findFirstLogicallyVisibleIndex() : 0;
    }
    render() {
        return (React.createElement(ScrollComponent, Object.assign({ ref: (scrollComponent) => this._scrollComponent = scrollComponent }, this.props, this.props.scrollViewProps, { onScroll: this._onScroll, onSizeChanged: this._onSizeChanged, contentHeight: this._initComplete ? this._virtualRenderer.getLayoutDimension().height : 0, contentWidth: this._initComplete ? this._virtualRenderer.getLayoutDimension().width : 0 }), this._generateRenderStack()));
    }
    _checkAndChangeLayouts(newProps, forceFullRender) {
        this._params.isHorizontal = newProps.isHorizontal;
        this._params.itemCount = newProps.dataProvider.getSize();
        this._virtualRenderer.setParamsAndDimensions(this._params, this._layout);
        if (forceFullRender || this.props.layoutProvider !== newProps.layoutProvider || this.props.isHorizontal !== newProps.isHorizontal) {
            //TODO:Talha use old layout manager
            this._virtualRenderer.setLayoutManager(new LayoutManager(newProps.layoutProvider, this._layout, newProps.isHorizontal));
            this._virtualRenderer.refreshWithAnchor();
            this._refreshViewability();
        }
        else if (this.props.dataProvider !== newProps.dataProvider) {
            const layoutManager = this._virtualRenderer.getLayoutManager();
            if (layoutManager) {
                layoutManager.reLayoutFromIndex(newProps.dataProvider.getFirstIndexToProcessInternal(), newProps.dataProvider.getSize());
                this._virtualRenderer.refresh();
            }
        }
        else if (this._relayoutReqIndex >= 0) {
            const layoutManager = this._virtualRenderer.getLayoutManager();
            if (layoutManager) {
                layoutManager.reLayoutFromIndex(this._relayoutReqIndex, newProps.dataProvider.getSize());
                this._relayoutReqIndex = -1;
                this._refreshViewability();
            }
        }
    }
    _refreshViewability() {
        this._virtualRenderer.refresh();
        this._queueStateRefresh();
    }
    _queueStateRefresh() {
        refreshRequestDebouncer(() => {
            this.setState((prevState) => {
                return prevState;
            });
        });
    }
    _onSizeChanged(layout) {
        const hasHeightChanged = this._layout.height !== layout.height;
        const hasWidthChanged = this._layout.width !== layout.width;
        this._layout.height = layout.height;
        this._layout.width = layout.width;
        if (layout.height === 0 || layout.width === 0) {
            throw new CustomError(RecyclerListViewExceptions.layoutException);
        }
        if (!this._initComplete) {
            this._initComplete = true;
            this._initTrackers();
            this._processOnEndReached();
        }
        else {
            if ((hasHeightChanged && hasWidthChanged) ||
                (hasHeightChanged && this.props.isHorizontal) ||
                (hasWidthChanged && !this.props.isHorizontal)) {
                this._checkAndChangeLayouts(this.props, true);
            }
            else {
                this._refreshViewability();
            }
        }
    }
    _renderStackWhenReady(stack) {
        this.setState(() => {
            return { renderStack: stack };
        });
    }
    _initTrackers() {
        this._assertDependencyPresence(this.props);
        if (this.props.onVisibleIndexesChanged) {
            this._virtualRenderer.attachVisibleItemsListener(this.props.onVisibleIndexesChanged);
        }
        this._params = {
            initialOffset: this.props.initialOffset ? this.props.initialOffset : this._initialOffset,
            initialRenderIndex: this.props.initialRenderIndex,
            isHorizontal: this.props.isHorizontal,
            itemCount: this.props.dataProvider.getSize(),
            renderAheadOffset: this.props.renderAheadOffset,
        };
        this._virtualRenderer.setParamsAndDimensions(this._params, this._layout);
        this._virtualRenderer.setLayoutManager(new LayoutManager(this.props.layoutProvider, this._layout, this.props.isHorizontal, this._cachedLayouts));
        this._virtualRenderer.setLayoutProvider(this.props.layoutProvider);
        this._virtualRenderer.init();
        const offset = this._virtualRenderer.getInitialOffset();
        if (offset.y > 0 || offset.x > 0) {
            this._pendingScrollToOffset = offset;
            this.setState({});
        }
        else {
            this._virtualRenderer.startViewabilityTracker();
        }
    }
    _assertDependencyPresence(props) {
        if (!props.dataProvider || !props.layoutProvider) {
            throw new CustomError(RecyclerListViewExceptions.unresolvedDependenciesException);
        }
    }
    _assertType(type) {
        if (!type && type !== 0) {
            throw new CustomError(RecyclerListViewExceptions.itemTypeNullException);
        }
    }
    _dataHasChanged(row1, row2) {
        return this.props.dataProvider.rowHasChanged(row1, row2);
    }
    _renderRowUsingMeta(itemMeta) {
        const dataSize = this.props.dataProvider.getSize();
        const dataIndex = itemMeta.dataIndex;
        if (!ObjectUtil.isNullOrUndefined(dataIndex) && dataIndex < dataSize) {
            const itemRect = this._virtualRenderer.getLayoutManager().getLayouts()[dataIndex];
            const data = this.props.dataProvider.getDataForIndex(dataIndex);
            const type = this.props.layoutProvider.getLayoutTypeForIndex(dataIndex);
            this._assertType(type);
            if (!this.props.forceNonDeterministicRendering) {
                this._checkExpectedDimensionDiscrepancy(itemRect, type, dataIndex);
            }
            return (React.createElement(ViewRenderer, { key: itemMeta.key, data: data, dataHasChanged: this._dataHasChanged, x: itemRect.x, y: itemRect.y, layoutType: type, index: dataIndex, layoutProvider: this.props.layoutProvider, forceNonDeterministicRendering: this.props.forceNonDeterministicRendering, isHorizontal: this.props.isHorizontal, onSizeChanged: this._onViewContainerSizeChange, childRenderer: this.props.rowRenderer, height: itemRect.height, width: itemRect.width, itemAnimator: Default.value(this.props.itemAnimator, this._defaultItemAnimator), extendedState: this.props.extendedState }));
        }
        return null;
    }
    _onViewContainerSizeChange(dim, index) {
        //Cannot be null here
        this._virtualRenderer.getLayoutManager().overrideLayout(index, dim);
        if (this._relayoutReqIndex === -1) {
            this._relayoutReqIndex = index;
        }
        else {
            this._relayoutReqIndex = Math.min(this._relayoutReqIndex, index);
        }
        this._queueStateRefresh();
    }
    _checkExpectedDimensionDiscrepancy(itemRect, type, index) {
        //Cannot be null here
        const layoutManager = this._virtualRenderer.getLayoutManager();
        layoutManager.setMaxBounds(this._tempDim);
        this.props.layoutProvider.setLayoutForType(type, this._tempDim, index);
        //TODO:Talha calling private method, find an alternative and remove this
        layoutManager.setMaxBounds(this._tempDim);
        if (itemRect.height !== this._tempDim.height || itemRect.width !== this._tempDim.width) {
            if (this._relayoutReqIndex === -1) {
                this._relayoutReqIndex = index;
            }
            else {
                this._relayoutReqIndex = Math.min(this._relayoutReqIndex, index);
            }
        }
    }
    _generateRenderStack() {
        const renderedItems = [];
        for (const key in this.state.renderStack) {
            if (this.state.renderStack.hasOwnProperty(key)) {
                renderedItems.push(this._renderRowUsingMeta(this.state.renderStack[key]));
            }
        }
        return renderedItems;
    }
    _onScroll(offsetX, offsetY, rawEvent) {
        this._virtualRenderer.updateOffset(offsetX, offsetY);
        if (this.props.onScroll) {
            this.props.onScroll(rawEvent, offsetX, offsetY);
        }
        this._processOnEndReached();
    }
    _processOnEndReached() {
        if (this.props.onEndReached && this._virtualRenderer) {
            const layout = this._virtualRenderer.getLayoutDimension();
            const windowBound = this.props.isHorizontal ? layout.width - this._layout.width : layout.height - this._layout.height;
            const viewabilityTracker = this._virtualRenderer.getViewabilityTracker();
            const lastOffset = viewabilityTracker ? viewabilityTracker.getLastOffset() : 0;
            if (windowBound - lastOffset <= Default.value(this.props.onEndReachedThreshold, 0)) {
                if (!this._onEndReachedCalled) {
                    this._onEndReachedCalled = true;
                    this.props.onEndReached();
                }
            }
            else {
                this._onEndReachedCalled = false;
            }
        }
    }
}
RecyclerListView.defaultProps = {
    canChangeSize: false,
    disableRecycling: false,
    initialOffset: 0,
    initialRenderIndex: 0,
    isHorizontal: false,
    onEndReachedThreshold: 0,
    renderAheadOffset: IS_WEB ? 1000 : 250,
};
RecyclerListView.propTypes = {};
RecyclerListView.propTypes = {
    //Refer the sample
    layoutProvider: PropTypes.instanceOf(LayoutProvider).isRequired,
    //Refer the sample
    dataProvider: PropTypes.instanceOf(DataProvider).isRequired,
    //Used to maintain scroll position in case view gets destroyed e.g, cases of back navigation
    contextProvider: PropTypes.instanceOf(ContextProvider),
    //Methods which returns react component to be rendered. You get type of view and data in the callback.
    rowRenderer: PropTypes.func.isRequired,
    //Initial offset you want to start rendering from, very useful if you want to maintain scroll context across pages.
    initialOffset: PropTypes.number,
    //Specify how many pixels in advance do you want views to be rendered. Increasing this value can help reduce blanks (if any). However keeping this as low
    //as possible should be the intent. Higher values also increase re-render compute
    renderAheadOffset: PropTypes.number,
    //Whether the listview is horizontally scrollable. Both use staggeredGrid implementation
    isHorizontal: PropTypes.bool,
    //On scroll callback onScroll(rawEvent, offsetX, offsetY), note you get offsets no need to read scrollTop/scrollLeft
    onScroll: PropTypes.func,
    //Provide your own ScrollView Component. The contract for the scroll event should match the native scroll event contract, i.e.
    // scrollEvent = { nativeEvent: { contentOffset: { x: offset, y: offset } } }
    //Note: Please extend BaseScrollView to achieve expected behaviour
    externalScrollView: PropTypes.func,
    //Callback given when user scrolls to the end of the list or footer just becomes visible, useful in incremental loading scenarios
    onEndReached: PropTypes.func,
    //Specify how many pixels in advance you onEndReached callback
    onEndReachedThreshold: PropTypes.number,
    //Provides visible index, helpful in sending impression events etc, onVisibleIndexesChanged(all, now, notNow)
    onVisibleIndexesChanged: PropTypes.func,
    //Provide this method if you want to render a footer. Helpful in showing a loader while doing incremental loads.
    renderFooter: PropTypes.func,
    //Specify the initial item index you want rendering to start from. Preferred over initialOffset if both are specified.
    initialRenderIndex: PropTypes.number,
    //iOS only. Scroll throttle duration.
    scrollThrottle: PropTypes.number,
    //Specify if size can change, listview will automatically relayout items. For web, works only with useWindowScroll = true
    canChangeSize: PropTypes.bool,
    //Web only. Specify how far away the first list item is from window top. This is an adjustment for better optimization.
    distanceFromWindow: PropTypes.number,
    //Web only. Layout elements in window instead of a scrollable div.
    useWindowScroll: PropTypes.bool,
    //Turns off recycling. You still get progressive rendering and all other features. Good for lazy rendering. This should not be used in most cases.
    disableRecycling: PropTypes.bool,
    //Default is false, if enabled dimensions provided in layout provider will not be strictly enforced.
    //Rendered dimensions will be used to relayout items. Slower if enabled.
    forceNonDeterministicRendering: PropTypes.bool,
    //In some cases the data passed at row level may not contain all the info that the item depends upon, you can keep all other info
    //outside and pass it down via this prop. Changing this object will cause everything to re-render. Make sure you don't change
    //it often to ensure performance. Re-renders are heavy.
    extendedState: PropTypes.object,
    //Enables animating RecyclerListView item cells e.g, shift, add, remove etc. This prop can be used to pass an external item animation implementation.
    //Look into BaseItemAnimator/DefaultJSItemAnimator/DefaultNativeItemAnimator/DefaultWebItemAnimator for more info.
    //By default there are few animations, to disable completely simply pass blank new BaseItemAnimator() object. Remember, create
    //one object and keep it do not create multiple object of type BaseItemAnimator.
    //Note: You might want to look into DefaultNativeItemAnimator to check an implementation based on LayoutAnimation. By default,
    //animations are JS driven to avoid workflow interference. Also, please note LayoutAnimation is buggy on Android.
    itemAnimator: PropTypes.instanceOf(BaseItemAnimator),
    //For TS use case, not necessary with JS use.
    //For all props that need to be proxied to inner/external scrollview. Put them in an object and they'll be spread
    //and passed down.
    scrollViewProps: PropTypes.object,
};
//# sourceMappingURL=RecyclerListView.js.map