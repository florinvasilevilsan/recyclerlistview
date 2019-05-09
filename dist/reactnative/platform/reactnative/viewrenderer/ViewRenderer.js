import * as React from "react";
import { View } from "react-native";
import BaseViewRenderer from "../../../core/viewrenderer/BaseViewRenderer";
/***
 * View renderer is responsible for creating a container of size provided by LayoutProvider and render content inside it.
 * Also enforces a logic to prevent re renders. RecyclerListView keeps moving these ViewRendereres around using transforms to enable recycling.
 * View renderer will only update if its position, dimensions or given data changes. Make sure to have a relevant shouldComponentUpdate as well.
 * This is second of the two things recycler works on. Implemented both for web and react native.
 */
export default class ViewRenderer extends BaseViewRenderer {
    constructor(props) {
        super(props);
        this._dim = { width: 0, height: 0 };
        this._viewRef = null;
        this._onLayout = this._onLayout.bind(this);
        this._setRef = this._setRef.bind(this);
    }
    render() {
        return this.props.forceNonDeterministicRendering ? (React.createElement(View, { ref: this._setRef, onLayout: this._onLayout, style: {
                flexDirection: this.props.isHorizontal ? "column" : "row",
                left: this.props.x,
                position: "absolute",
                top: this.props.y,
            } }, this.renderChild())) : (React.createElement(View, { ref: this._setRef, style: {
                left: this.props.x,
                position: "absolute",
                top: this.props.y,
                height: this.props.height,
                width: this.props.width,
            } }, this.renderChild()));
    }
    getRef() {
        return this._viewRef;
    }
    _setRef(view) {
        this._viewRef = view;
    }
    _onLayout(event) {
        //Preventing layout thrashing in super fast scrolls where RN messes up onLayout event
        const xDiff = Math.abs(this.props.x - event.nativeEvent.layout.x);
        const yDiff = Math.abs(this.props.y - event.nativeEvent.layout.y);
        if (xDiff < 1 && yDiff < 1 &&
            (this.props.height !== event.nativeEvent.layout.height ||
                this.props.width !== event.nativeEvent.layout.width)) {
            this._dim.height = event.nativeEvent.layout.height;
            this._dim.width = event.nativeEvent.layout.width;
            if (this.props.onSizeChanged) {
                this.props.onSizeChanged(this._dim, this.props.index);
            }
        }
    }
}
//# sourceMappingURL=ViewRenderer.js.map