import * as React from "react";
import BaseScrollComponent from "../../../core/scrollcomponent/BaseScrollComponent";
import ScrollViewer from "./ScrollViewer";
/***
 * The responsibility of a scroll component is to report its size, scroll events and provide a way to scroll to a given offset.
 * RecyclerListView works on top of this interface and doesn't care about the implementation. To support web we only had to provide
 * another component written on top of web elements
 */
export default class ScrollComponent extends BaseScrollComponent {
    constructor(args) {
        super(args);
        this._scrollViewRef = null;
        this._onScroll = this._onScroll.bind(this);
        this._onSizeChanged = this._onSizeChanged.bind(this);
        this._height = 0;
        this._width = 0;
    }
    scrollTo(x, y, animated) {
        if (this._scrollViewRef) {
            this._scrollViewRef.scrollTo({ x, y, animated });
        }
    }
    render() {
        const Scroller = this.props.externalScrollView; //TSI
        return (React.createElement(Scroller, Object.assign({ ref: (scrollView) => this._scrollViewRef = scrollView }, this.props, { horizontal: this.props.isHorizontal, onScroll: this._onScroll, onSizeChanged: this._onSizeChanged }),
            React.createElement("div", { style: {
                    height: this.props.contentHeight,
                    width: this.props.contentWidth,
                } }, this.props.children),
            this.props.renderFooter ? React.createElement("div", { style: this.props.isHorizontal ? {
                    left: this.props.contentWidth,
                    position: "absolute",
                    top: 0,
                } : undefined }, this.props.renderFooter()) : null));
    }
    _onScroll(e) {
        this.props.onScroll(e.nativeEvent.contentOffset.x, e.nativeEvent.contentOffset.y, e);
    }
    _onSizeChanged(event) {
        if (this.props.onSizeChanged) {
            this.props.onSizeChanged(event);
        }
    }
}
ScrollComponent.defaultProps = {
    contentHeight: 0,
    contentWidth: 0,
    externalScrollView: ScrollViewer,
    isHorizontal: false,
    scrollThrottle: 16,
    canChangeSize: false,
};
//# sourceMappingURL=ScrollComponent.js.map