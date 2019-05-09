import * as React from "react";
import { ScrollView, View, } from "react-native";
import BaseScrollComponent from "../../../core/scrollcomponent/BaseScrollComponent";
import TSCast from "../../../utils/TSCast";
/***
 * The responsibility of a scroll component is to report its size, scroll events and provide a way to scroll to a given offset.
 * RecyclerListView works on top of this interface and doesn't care about the implementation. To support web we only had to provide
 * another component written on top of web elements
 */
export default class ScrollComponent extends BaseScrollComponent {
    constructor(args) {
        super(args);
        this._dummyOnLayout = TSCast.cast(null);
        this._scrollViewRef = null;
        this._onScroll = this._onScroll.bind(this);
        this._onLayout = this._onLayout.bind(this);
        this._height = 0;
        this._width = 0;
        this._isSizeChangedCalledOnce = false;
    }
    scrollTo(x, y, isAnimated) {
        if (this._scrollViewRef) {
            this._scrollViewRef.scrollTo({ x, y, animated: isAnimated });
        }
    }
    render() {
        const Scroller = TSCast.cast(this.props.externalScrollView); //TSI
        return (React.createElement(Scroller, Object.assign({ ref: (scrollView) => this._scrollViewRef = scrollView, removeClippedSubviews: false, scrollEventThrottle: this.props.scrollThrottle }, this.props, { horizontal: this.props.isHorizontal, onScroll: this._onScroll, onLayout: (!this._isSizeChangedCalledOnce || this.props.canChangeSize) ? this._onLayout : this._dummyOnLayout }),
            React.createElement(View, { style: { flexDirection: this.props.isHorizontal ? "row" : "column" } },
                React.createElement(View, { style: {
                        height: this.props.contentHeight,
                        width: this.props.contentWidth,
                    } }, this.props.children),
                this.props.renderFooter ? this.props.renderFooter() : null)));
    }
    _onScroll(event) {
        if (event) {
            this.props.onScroll(event.nativeEvent.contentOffset.x, event.nativeEvent.contentOffset.y, event);
        }
    }
    _onLayout(event) {
        if (this._height !== event.nativeEvent.layout.height || this._width !== event.nativeEvent.layout.width) {
            this._height = event.nativeEvent.layout.height;
            this._width = event.nativeEvent.layout.width;
            if (this.props.onSizeChanged) {
                this._isSizeChangedCalledOnce = true;
                this.props.onSizeChanged(event.nativeEvent.layout);
            }
        }
    }
}
ScrollComponent.defaultProps = {
    contentHeight: 0,
    contentWidth: 0,
    externalScrollView: TSCast.cast(ScrollView),
    isHorizontal: false,
    scrollThrottle: 16,
};
//# sourceMappingURL=ScrollComponent.js.map