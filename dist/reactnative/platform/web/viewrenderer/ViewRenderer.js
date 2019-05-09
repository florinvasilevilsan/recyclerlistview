import * as React from "react";
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
        this._mainDiv = null;
        this._setRef = this._setRef.bind(this);
    }
    componentDidMount() {
        if (super.componentDidMount) {
            super.componentDidMount();
        }
        this._checkSizeChange();
    }
    componentDidUpdate() {
        this._checkSizeChange();
    }
    render() {
        const style = this.props.forceNonDeterministicRendering
            ? Object.assign({ transform: this._getTransform(), WebkitTransform: this._getTransform() }, styles.baseViewStyle) : Object.assign({ height: this.props.height, overflow: "hidden", width: this.props.width, transform: this._getTransform(), WebkitTransform: this._getTransform() }, styles.baseViewStyle);
        return (React.createElement("div", { ref: this._setRef, style: style }, this.renderChild()));
    }
    getRef() {
        return this._mainDiv;
    }
    _setRef(div) {
        this._mainDiv = div;
    }
    _getTransform() {
        return "translate(" + this.props.x + "px," + this.props.y + "px)";
    }
    _checkSizeChange() {
        if (this.props.forceNonDeterministicRendering && this.props.onSizeChanged) {
            const mainDiv = this._mainDiv;
            if (mainDiv) {
                this._dim.width = mainDiv.clientWidth;
                this._dim.height = mainDiv.clientHeight;
                if (this.props.width !== this._dim.width || this.props.height !== this._dim.height) {
                    this.props.onSizeChanged(this._dim, this.props.index);
                }
            }
        }
    }
}
const styles = {
    baseViewStyle: {
        alignItems: "stretch",
        borderWidth: 0,
        borderStyle: "solid",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        margin: 0,
        padding: 0,
        position: "absolute",
        minHeight: 0,
        minWidth: 0,
        left: 0,
        top: 0,
    },
};
//# sourceMappingURL=ViewRenderer.js.map